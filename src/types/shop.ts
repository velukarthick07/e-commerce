import type {
  DeliveryType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductType,
} from "@/generated/prisma/enums";

export interface ShopVariant {
  id: string;
  name: string;
  sku: string;
  mrp: number;
  sellingPrice: number;
  discountPrice: number | null;
  weightGrams: number | null;
  volumeMl: number | null;
  imageUrl: string | null;
  isDefault: boolean;
  sortOrder: number;
  /** Derived server-side so every surface agrees on the sell price. */
  effectivePrice: number;
  savings: number;
  discountPercent: number;
  availableStock: number;
  inStock: boolean;
}

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  images: string[];
  shortDescription: string | null;
  unit: string;
  netQuantity: string | null;
  mrp: number;
  sellingPrice: number;
  discountPrice: number | null;
  productType: ProductType;
  isFeatured: boolean;
  createdAt: string;
  category: { id: number; name: string; slug: string };
  variants: ShopVariant[];
  priceFrom: number;
  priceTo: number;
  maxDiscountPercent: number;
  inStock: boolean;
}

export interface ShopProductDetail extends ShopProduct {
  description: string | null;
  ingredients: string | null;
  allergens: string | null;
  dietaryInfo: string | null;
  storageInstructions: string | null;
  preparationInstructions: string | null;
  shelfLifeDays: number | null;
  countryOfOrigin: string | null;
  manufacturer: string | null;
  packer: string | null;
  fssaiLicense: string | null;
  oilType: string | null;
  extractionMethod: string | null;
  packagingType: string | null;
  fragrance: string | null;
  weight: number | null;
  subcategory: { id: number; name: string; slug: string } | null;
  related: ShopProduct[];
}

export interface ShopCategory {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: number | null;
  productCount: number;
  children: {
    id: number;
    name: string;
    slug: string;
    imageUrl: string | null;
    productCount: number;
  }[];
}

export interface ShopAddress {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  landmark: string | null;
  isDefault: boolean;
}

/** What the client sends when saving or submitting an address. */
export interface AddressInput {
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  landmark?: string | null;
  isDefault?: boolean;
}

export interface ShopCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  addresses: ShopAddress[];
  totalOrders?: number;
  totalSpent?: number;
}

export interface StoreInfo {
  storeName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  currencySymbol: string;
  delivery: {
    enableDelivery: boolean;
    enablePickup: boolean;
    defaultDeliveryCharge: number;
    freeDeliveryAbove: number;
  };
  paymentMethods: PaymentMethod[];
  brands: string[];
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  quantity: number;
  mrp: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface ShopQuote {
  lines: QuoteLine[];
  subtotal: number;
  itemDiscount: number;
  couponDiscount: number;
  manualDiscount: number;
  discountTotal: number;
  taxAmount: number;
  deliveryCharge: number;
  grandTotal: number;
  appliedCoupon: { id: string; code: string } | null;
  freeDeliveryAbove: number;
  amountToFreeDelivery: number;
}

export interface ShopOrderItem {
  id: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  mrp: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  product: { slug: string; unit: string } | null;
}

export interface ShopOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  orderType: string;
  deliveryType: DeliveryType;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  deliveryNotes: string | null;
  subtotal: number;
  discountTotal: number;
  taxAmount: number;
  deliveryCharge: number;
  grandTotal: number;
  couponCode: string | null;
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: ShopOrderItem[];
  payments: { method: PaymentMethod; status: PaymentStatus }[];
  statusHistory: { status: OrderStatus; createdAt: string }[];
}

export interface ShopOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryType: DeliveryType;
  grandTotal: number;
  placedAt: string;
  deliveredAt: string | null;
  items: {
    productName: string;
    variantName: string;
    imageUrl: string | null;
    quantity: number;
  }[];
  _count: { items: number };
}

/** Masked hints returned for an unrecognised-until-verified phone number. */
export type PhoneLookup =
  | { found: false }
  | {
      found: true;
      verified: true;
      name: string;
      email: string | null;
      addresses: ShopAddress[];
    }
  | {
      found: true;
      verified: false;
      maskedName: string;
      maskedAddress: string | null;
      addressCount: number;
    };

/** A line in the browser-held cart. Prices are for display; the server re-quotes. */
export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  unit: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
  availableStock: number;
}
