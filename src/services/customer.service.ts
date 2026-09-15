import { customerRepository } from "@/repositories/customer.repository";
import { BusinessRuleError, ConflictError } from "@/lib/errors";
import { assertFound } from "@/lib/utils";
import type {
  CreateCustomerInput,
} from "@/validators/customer.validator";
import type { z } from "zod";
import type { quickCustomerSchema } from "@/validators/customer.validator";

type QuickCustomerInput = z.infer<typeof quickCustomerSchema>;

/** Guarantees exactly one default address when any address is present. */
function normaliseAddresses(addresses: CreateCustomerInput["addresses"]) {
  if (!addresses || addresses.length === 0) return [];
  const hasDefault = addresses.some((a) => a.isDefault);
  return addresses.map((a, i) => ({
    label: a.label,
    line1: a.line1,
    line2: a.line2 || null,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    landmark: a.landmark || null,
    isDefault: hasDefault ? a.isDefault : i === 0,
  }));
}

export const customerService = {
  list: customerRepository.list,
  search: customerRepository.search,
  orderHistory: customerRepository.orderHistory,

  async getById(id: string) {
    return assertFound(await customerRepository.findById(id), "Customer");
  },

  async create(input: CreateCustomerInput) {
    const existing = await customerRepository.findByPhone(input.phone);
    if (existing) {
      throw new ConflictError(
        `${existing.name} is already registered with this phone number`,
        { customerId: existing.id }
      );
    }

    const addresses = normaliseAddresses(input.addresses);

    return customerRepository.create({
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      isActive: input.isActive,
      notes: input.notes || null,
      ...(addresses.length > 0 ? { addresses: { create: addresses } } : {}),
    });
  },

  /** Used by "+ New Customer" on the local-order screen; reuses an existing
   *  record when the phone number already exists so staff are never blocked. */
  async quickCreate(input: QuickCustomerInput) {
    const existing = await customerRepository.findByPhone(input.phone);
    if (existing) return { customer: existing, reused: true };

    const customer = await customerRepository.create({
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      ...(input.line1
        ? {
            addresses: {
              create: {
                line1: input.line1,
                city: input.city ?? "",
                state: input.state ?? "",
                postalCode: input.postalCode ?? "",
                isDefault: true,
              },
            },
          }
        : {}),
    });

    return { customer, reused: false };
  },

  async update(id: string, input: Partial<CreateCustomerInput>) {
    await this.getById(id);

    if (input.phone) {
      const other = await customerRepository.findByPhone(input.phone);
      if (other && other.id !== id) {
        throw new ConflictError("Another customer already uses this phone number");
      }
    }

    await customerRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    });

    if (input.addresses) {
      const addresses = normaliseAddresses(input.addresses);
      await customerRepository.replaceAddresses(
        id,
        addresses.map((a) => ({ ...a, customerId: id }))
      );
    }

    return this.getById(id);
  },

  async remove(id: string) {
    await this.getById(id);

    const orders = await customerRepository.countOrders(id);
    if (orders > 0) {
      throw new BusinessRuleError(
        `This customer has ${orders} order${orders === 1 ? "" : "s"}. Deactivate them instead of deleting.`
      );
    }

    await customerRepository.delete(id);
    return { id };
  },
};
