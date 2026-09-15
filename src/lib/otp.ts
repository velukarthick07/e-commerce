import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { BusinessRuleError } from "./errors";
import { normalisePhone } from "./phone";

export type OtpPurpose = "LOGIN" | "CHECKOUT";

const CODE_LENGTH = 6;
const TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MINUTES = 15;

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is required to issue OTPs");
  return value;
}

/**
 * Codes are stored as a keyed HMAC rather than in plain text. A six-digit code
 * has too little entropy for a plain hash to help — brute-forcing 10^6 hashes
 * is trivial — so the digest is keyed with the server secret, which an
 * attacker holding only a database dump does not have.
 */
function digest(phone: string, code: string): string {
  return createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");
}

function matches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Whether the API may echo the code back to the caller.
 *
 * There is no SMS provider wired up in this build, so outside production the
 * code is returned in the response (and always logged server-side) to keep the
 * flow usable. Sending real messages means implementing `deliverOtp` below;
 * nothing else has to change.
 */
export function otpEchoEnabled(): boolean {
  if (process.env.OTP_ECHO === "true") return true;
  if (process.env.OTP_ECHO === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Delivery seam. Swap the body for an SMS gateway call (MSG91, Twilio,
 * Gupshup…) and the rest of the auth flow is unchanged.
 */
async function deliverOtp(phone: string, code: string): Promise<void> {
  console.info(`[otp] ${phone} -> ${code} (valid ${TTL_MINUTES} minutes)`);
}

export const otpService = {
  /**
   * Issues a code for a phone number. Previous unconsumed challenges for the
   * same number are invalidated so only the newest code ever works.
   */
  async issue(rawPhone: string, purpose: OtpPurpose = "LOGIN") {
    const phone = normalisePhone(rawPhone);

    const windowStart = new Date(Date.now() - SEND_WINDOW_MINUTES * 60_000);
    const recent = await prisma.otpChallenge.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (recent >= MAX_SENDS_PER_WINDOW) {
      throw new BusinessRuleError(
        `Too many codes requested. Please wait ${SEND_WINDOW_MINUTES} minutes and try again.`
      );
    }

    // Retire any outstanding code for this number.
    await prisma.otpChallenge.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
    const challenge = await prisma.otpChallenge.create({
      data: {
        phone,
        purpose,
        codeHash: digest(phone, code),
        expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
      },
      select: { id: true, expiresAt: true },
    });

    await deliverOtp(phone, code);

    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      expiresInSeconds: TTL_MINUTES * 60,
      /** Only populated when there is no real SMS channel — see `otpEchoEnabled`. */
      devCode: otpEchoEnabled() ? code : undefined,
    };
  },

  /**
   * Checks a code, consuming it unless told otherwise.
   *
   * `consume: false` exists for the sign-up handshake: a brand-new number
   * verifies once to learn that it has no account yet, then verifies again
   * with a name to finish registering. Failed attempts still count against
   * the limit either way, so leaving the code live costs nothing.
   */
  async verify(
    rawPhone: string,
    code: string,
    opts: { consume?: boolean } = {}
  ): Promise<void> {
    const phone = normalisePhone(rawPhone);

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) {
      throw new BusinessRuleError("Request a new code and try again");
    }
    if (challenge.expiresAt < new Date()) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new BusinessRuleError("That code has expired. Request a new one.");
    }
    if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new BusinessRuleError("Too many incorrect attempts. Request a new code.");
    }

    if (!matches(challenge.codeHash, digest(phone, code.trim()))) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      const left = MAX_VERIFY_ATTEMPTS - challenge.attempts - 1;
      throw new BusinessRuleError(
        left > 0
          ? `That code is not correct. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "That code is not correct. Request a new one."
      );
    }

    if (opts.consume !== false) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
    }
  },
};
