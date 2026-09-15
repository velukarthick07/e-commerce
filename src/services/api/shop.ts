"use client";

import { api, del, getList, getOne, patch, post, put } from "./client";
import type {
  AddressInput,
  CartLine,
  PhoneLookup,
  ShopAddress,
  ShopCategory,
  ShopCustomer,
  ShopOrder,
  ShopOrderSummary,
  ShopProduct,
  ShopProductDetail,
  ShopQuote,
  StoreInfo,
} from "@/types/shop";
import type { DeliveryType, PaymentMethod } from "@/generated/prisma/enums";

/** Typed wrappers over the public `/api/shop` surface. */
export const shopApi = {
  catalogue: (params: Record<string, unknown>) =>
    getList<ShopProduct>("/shop/catalogue", params),

  product: (slug: string) => getOne<ShopProductDetail>(`/shop/catalogue/${slug}`),

  categories: () => getList<ShopCategory>("/shop/categories"),

  store: () => getOne<StoreInfo>("/shop/store"),

  quote: (body: {
    items: { variantId: string; quantity: number }[];
    couponCode?: string;
    deliveryType: DeliveryType;
  }) => post<ShopQuote>("/shop/quote", body).then((r) => r.data),

  lookup: (phone: string) =>
    post<PhoneLookup>("/shop/lookup", { phone }).then((r) => r.data),

  requestOtp: (phone: string) =>
    post<{ sent: boolean; expiresInSeconds: number; devCode?: string }>(
      "/shop/auth/otp",
      { phone }
    ).then((r) => r.data),

  verifyOtp: (phone: string, code: string, name?: string) =>
    post<
      | { needsName: true }
      | { needsName?: false; customer: ShopCustomer; isNew: boolean }
    >("/shop/auth/verify", { phone, code, ...(name ? { name } : {}) }).then(
      (r) => r.data
    ),

  logout: () => post<{ loggedOut: boolean }>("/shop/auth/logout"),

  me: () => getOne<ShopCustomer>("/shop/auth/me"),

  updateProfile: (body: { name: string; email?: string }) =>
    patch<ShopCustomer>("/shop/profile", body).then((r) => r.data),

  addresses: () => getList<ShopAddress>("/shop/addresses").then((r) => r.data),

  addAddress: (body: AddressInput) =>
    post<ShopAddress>("/shop/addresses", body).then((r) => r.data),

  updateAddress: (id: string, body: AddressInput) =>
    put<ShopAddress>(`/shop/addresses/${id}`, body).then((r) => r.data),

  setDefaultAddress: (id: string) =>
    post<ShopAddress[]>(`/shop/addresses/${id}/default`).then((r) => r.data),

  removeAddress: (id: string) => del(`/shop/addresses/${id}`),

  placeOrder: (body: {
    items: { variantId: string; quantity: number }[];
    name: string;
    phone: string;
    email?: string;
    deliveryType: DeliveryType;
    addressId?: string;
    address?: AddressInput;
    saveAddress?: boolean;
    deliveryNotes?: string;
    couponCode?: string;
    paymentMethod: PaymentMethod;
  }) => post<ShopOrder>("/shop/orders", body),

  myOrders: () => getList<ShopOrderSummary>("/shop/orders").then((r) => r.data),

  myOrder: (orderNumber: string) =>
    getOne<ShopOrder>(`/shop/orders/${orderNumber}`),

  track: (orderNumber: string, phone: string) =>
    post<ShopOrder>("/shop/track", { orderNumber, phone }).then((r) => r.data),
};

/** The shape `/api/shop/quote` and the checkout both expect for cart lines. */
export function toQuoteItems(items: CartLine[]) {
  return items.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
}

export { api };
