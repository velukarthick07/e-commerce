/** Serialised API shapes (Decimals arrive as numbers, Dates as ISO strings). */

export type RoleNameDto = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF";

export type OrderStatusDto =
  | "PENDING" | "CONFIRMED" | "PROCESSING" | "PACKED" | "SHIPPED"
  | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";

export type PaymentStatusDto = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentMethodDto = "CASH" | "CARD" | "UPI" | "ONLINE_PAYMENT" | "COD";
export type OrderChannelDto = "ONLINE" | "LOCAL";
export type OrderTypeDto =
  | "LOCAL_DELIVERY" | "STORE_PICKUP" | "WALK_IN"
  | "PHONE_ORDER" | "WHATSAPP_ORDER" | "ONLINE_ORDER";
export type DeliveryTypeDto = "DELIVERY" | "PICKUP";
export type DiscountTypeDto = "PERCENTAGE" | "FIXED_AMOUNT";
export type ProductTypeDto =
  | "FOOD" | "OIL" | "PERSONAL_CARE" | "HOUSEHOLD" | "GROCERY" | "OTHER";
export type InventoryTxTypeDto =
  | "STOCK_ADDED" | "STOCK_REMOVED" | "ORDER_DEDUCTION"
  | "RETURN" | "MANUAL_ADJUSTMENT" | "EXPIRED_STOCK";

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: RoleNameDto;
  roleLabel: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: number | null;
  parent?: { id: number; name: string } | null;
  children?: CategoryDto[];
  _count?: { products: number; subProducts: number; children: number };
}

export interface InventoryDto {
  id: number;
  currentStock: number;
  reservedStock: number;
  minStock: number;
  maxStock: number;
  lastRestockedAt: string | null;
}

export interface VariantDto {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  mrp: number;
  sellingPrice: number;
  discountPrice: number | null;
  weightGrams: number | null;
  volumeMl: number | null;
  imageUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  inventory: InventoryDto | null;
}

export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode: string | null;
  brand: string | null;
  description: string | null;
  shortDescription: string | null;
  images: string[];
  mrp: number;
  sellingPrice: number;
  discountPrice: number | null;
  taxRate: number;
  hsnCode: string | null;
  minStock: number;
  maxStock: number;
  unit: string;
  netQuantity: string | null;
  weight: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  isFeatured: boolean;
  isActive: boolean;
  productType: ProductTypeDto;
  ingredients: string | null;
  nutritionalInfo: Record<string, string> | null;
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
  createdAt: string;
  categoryId: number;
  subcategoryId: number | null;
  category: { id: number; name: string; parentId?: number | null };
  subcategory: { id: number; name: string } | null;
  variants: VariantDto[];
}

export interface SearchProductDto {
  id: string;
  name: string;
  sku: string;
  brand: string | null;
  images: string[];
  unit: string;
  taxRate: number;
  category: { id: number; name: string };
  variants: VariantDto[];
}

export interface AddressDto {
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

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  addresses: AddressDto[];
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface OrderItemDto {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  mrp: number;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  product?: { id: string; name: string; images: string[]; unit: string };
}

export interface PaymentDto {
  id: string;
  paymentNumber: string;
  amount: number;
  method: PaymentMethodDto;
  status: PaymentStatusDto;
  transactionId: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  order?: { id: string; orderNumber: string; grandTotal: number; channel: OrderChannelDto };
  customer?: { id: string; name: string; phone: string };
  recordedBy?: { id: number; name: string } | null;
}

export interface OrderListDto {
  id: string;
  orderNumber: string;
  channel: OrderChannelDto;
  orderType: OrderTypeDto;
  status: OrderStatusDto;
  paymentStatus: PaymentStatusDto;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryTypeDto;
  subtotal: number;
  discountTotal: number;
  taxAmount: number;
  deliveryCharge: number;
  grandTotal: number;
  placedAt: string;
  createdBy: { id: number; name: string } | null;
  _count: { items: number };
}

export interface OrderDetailDto extends Omit<OrderListDto, "_count"> {
  customerEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  deliveryNotes: string | null;
  itemDiscount: number;
  couponDiscount: number;
  manualDiscount: number;
  couponCode: string | null;
  notes: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  customer: CustomerDto;
  items: OrderItemDto[];
  payments: PaymentDto[];
  statusHistory: { id: string; status: OrderStatusDto; note: string | null; createdAt: string }[];
  coupon: { id: string; code: string } | null;
  transactions: {
    id: string;
    quantity: number;
    variantId: string;
    batch: { id: string; batchNumber: string; expiryDate: string | null } | null;
  }[];
}

export interface QuoteLineDto {
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

export interface QuoteDto {
  lines: QuoteLineDto[];
  subtotal: number;
  itemDiscount: number;
  couponDiscount: number;
  manualDiscount: number;
  discountTotal: number;
  taxAmount: number;
  deliveryCharge: number;
  grandTotal: number;
  appliedCoupon: { id: string; code: string } | null;
}

export interface InventoryRowDto {
  id: number;
  currentStock: number;
  reservedStock: number;
  minStock: number;
  maxStock: number;
  lastRestockedAt: string | null;
  variant: { id: string; name: string; sku: string; barcode: string | null; mrp: number; sellingPrice: number; isActive: boolean };
  product: { id: string; name: string; sku: string; unit: string; images: string[]; isActive: boolean; category: { id: number; name: string } };
}

export interface BatchDto {
  id: string;
  batchNumber: string;
  productId: string;
  variantId: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  bestBeforeDate: string | null;
  quantity: number;
  remainingQuantity: number;
  purchasePrice: number | null;
  mrp: number | null;
  sellingPrice: number | null;
  receivedDate: string;
  isActive: boolean;
  product: { id: string; name: string; sku: string; unit: string; category?: { id: number; name: string } };
  variant: { id: string; name: string; sku: string };
}

export interface InventoryTxDto {
  id: string;
  type: InventoryTxTypeDto;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType: string | null;
  createdAt: string;
  note: string | null;
  product: { id: string; name: string; sku: string };
  variant: { id: string; name: string; sku: string };
  batch: { id: string; batchNumber: string; expiryDate: string | null } | null;
  user: { id: number; name: string } | null;
  order: { id: string; orderNumber: string } | null;
}

export interface CouponDto {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountTypeDto;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number };
}

export interface UserDto {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roleId: number;
  role: { id: number; name: RoleNameDto; label: string };
  createdAt: string;
}

export interface StoreSettingsDto {
  id: number;
  storeName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  gstNumber: string | null;
  fssaiLicense: string | null;
  logoUrl: string | null;
  currency: string;
  currencySymbol: string;
  timezone: string;
  deliverySettings: { enableDelivery: boolean; enablePickup: boolean; defaultDeliveryCharge: number; freeDeliveryAbove: number; maxDeliveryCharge: number; deliveryRadiusKm: number };
  paymentSettings: { cash: boolean; card: boolean; upi: boolean; onlinePayment: boolean; cod: boolean };
  taxSettings: { taxEnabled: boolean; pricesIncludeTax: boolean; defaultTaxRate: number };
  orderSettings: { allowBackorders: boolean; blockExpiredStock: boolean; maxManualDiscountPercent: number; lowStockAlert: boolean; autoConfirmLocalOrders: boolean };
  notificationSettings: { lowStockEmails: boolean; expiryAlerts: boolean; newOrderAlerts: boolean; dailySummary: boolean };
  securitySettings: { sessionTimeoutMinutes: number; enforceStrongPasswords: boolean };
  preferences: { dateFormat: string; rowsPerPage: number; compactTables: boolean };
}

export interface DashboardDto {
  cards: {
    todaySales: number; todaySalesChange: number; totalSales: number;
    totalOrders: number; todayOrders: number; todayOrdersChange: number;
    localOrders: number; onlineOrders: number; pendingOrders: number;
    completedOrders: number; totalCustomers: number; newCustomersToday: number;
    totalProducts: number; activeProducts: number;
  };
  salesSeries: { bucket: string; revenue: number; orders: number }[];
  ordersOverview: { channel: OrderChannelDto; status: OrderStatusDto; count: number }[];
  statusBreakdown: { status: OrderStatusDto; count: number }[];
  topProducts: { productId: string; name: string; sku: string; image: string | null; units: number; revenue: number; avgPrice: number }[];
  lowStock: { id: number; currentStock: number; minStock: number; variant: { id: string; name: string; sku: string }; product: { id: string; name: string; unit: string; images: string[] } }[];
  expiring: { id: string; batchNumber: string; expiryDate: string | null; remainingQuantity: number; product: { id: string; name: string; unit: string }; variant: { id: string; name: string; sku: string } }[];
}
