import bcrypt from "bcryptjs";

/**
 * Password hashing lives apart from `lib/auth` (which is `server-only`) so
 * that Node scripts such as the seeder can reuse it.
 */
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
