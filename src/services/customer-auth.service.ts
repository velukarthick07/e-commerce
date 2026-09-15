import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { otpService } from "@/lib/otp";
import { normalisePhone } from "@/lib/phone";
import { signCustomerToken } from "@/lib/jwt";
import { customerRepository } from "@/repositories/customer.repository";
import type { StorefrontAddressInput } from "@/validators/storefront.validator";

const MAX_ADDRESSES = 10;

type CustomerRow = NonNullable<
  Awaited<ReturnType<typeof customerRepository.findByPhone>>
>;

function publicCustomer(customer: CustomerRow) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    addresses: customer.addresses,
  };
}

export const customerAuthService = {
  /** Step 1 — issue a code. Reveals nothing about whether the number is known. */
  async requestOtp(phone: string) {
    const result = await otpService.issue(normalisePhone(phone), "LOGIN");
    return {
      sent: true,
      expiresInSeconds: result.expiresInSeconds,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
  },

  /**
   * Step 2 — check the code and sign in.
   *
   * A number with no customer record yet gets `needsName: true` instead of a
   * session; the client collects a name and calls back with it. The code is
   * left live for that second call rather than forcing a fresh SMS.
   */
  async verifyOtp(rawPhone: string, code: string, name?: string) {
    const phone = normalisePhone(rawPhone);
    const existing = await customerRepository.findByPhone(phone);

    if (!existing && !name) {
      await otpService.verify(phone, code, { consume: false });
      return { needsName: true as const };
    }

    await otpService.verify(phone, code);

    if (existing && !existing.isActive) {
      throw new BusinessRuleError(
        "This account is on hold. Please contact the store for help."
      );
    }

    const customer =
      existing ??
      (await customerRepository.create({ name: name!.trim(), phone, email: null }));

    await customerRepository.touchLogin(customer.id);

    const token = await signCustomerToken({
      sub: customer.id,
      phone: customer.phone,
      name: customer.name,
    });

    return {
      needsName: false as const,
      token,
      customer: publicCustomer(customer),
      isNew: !existing,
    };
  },

  async me(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError("Customer");
    return {
      ...publicCustomer(customer),
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
    };
  },

  async updateProfile(customerId: string, input: { name: string; email?: string }) {
    await customerRepository.update(customerId, {
      name: input.name,
      email: input.email ?? null,
    });
    return this.me(customerId);
  },

  listAddresses(customerId: string) {
    return customerRepository.addressesFor(customerId);
  },

  async addAddress(customerId: string, input: StorefrontAddressInput) {
    const count = await customerRepository.countAddresses(customerId);
    if (count >= MAX_ADDRESSES) {
      throw new ConflictError(
        `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`
      );
    }
    return customerRepository.createAddress(customerId, {
      label: input.label,
      line1: input.line1,
      line2: input.line2 || null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      landmark: input.landmark || null,
      isDefault: input.isDefault,
    });
  },

  async updateAddress(
    customerId: string,
    addressId: string,
    input: StorefrontAddressInput
  ) {
    const existing = await customerRepository.findAddress(addressId, customerId);
    if (!existing) throw new NotFoundError("Address");

    return customerRepository.updateAddress(addressId, customerId, {
      label: input.label,
      line1: input.line1,
      line2: input.line2 || null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      landmark: input.landmark || null,
      // An address that is already the default cannot be un-defaulted by
      // editing it — the customer has to promote a different one instead.
      isDefault: input.isDefault || existing.isDefault,
    });
  },

  async setDefaultAddress(customerId: string, addressId: string) {
    const existing = await customerRepository.findAddress(addressId, customerId);
    if (!existing) throw new NotFoundError("Address");
    return customerRepository.setDefaultAddress(addressId, customerId);
  },

  async removeAddress(customerId: string, addressId: string) {
    const existing = await customerRepository.findAddress(addressId, customerId);
    if (!existing) throw new NotFoundError("Address");
    return customerRepository.deleteAddress(addressId, customerId);
  },
};
