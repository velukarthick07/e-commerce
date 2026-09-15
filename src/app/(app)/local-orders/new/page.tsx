"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { CustomerPicker } from "@/components/local-order/CustomerPicker";
import { ProductPicker, type PickedVariant } from "@/components/local-order/ProductPicker";
import { OrderSummary, type CartLine } from "@/components/local-order/OrderSummary";
import { post, getOne, ApiError } from "@/services/api/client";
import { useToast } from "@/context/ToastContext";
import { useDebounce } from "@/hooks/useDebounce";
import type {
  CustomerDto,
  OrderDetailDto,
  QuoteDto,
  StoreSettingsDto,
} from "@/types/models";

const ORDER_TYPES = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE_ORDER", label: "Phone order" },
  { value: "WHATSAPP_ORDER", label: "WhatsApp order" },
  { value: "LOCAL_DELIVERY", label: "Local delivery" },
  { value: "STORE_PICKUP", label: "Store pickup" },
];

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", key: "cash" },
  { value: "UPI", label: "UPI", key: "upi" },
  { value: "CARD", label: "Card", key: "card" },
  { value: "COD", label: "Cash on delivery", key: "cod" },
  { value: "ONLINE_PAYMENT", label: "Online payment", key: "onlinePayment" },
] as const;

export default function NewLocalOrderPage() {
  const router = useRouter();
  const toast = useToast();

  const [settings, setSettings] = useState<StoreSettingsDto | null>(null);
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  const [orderType, setOrderType] = useState("WALK_IN");
  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "PICKUP">("PICKUP");
  const [couponCode, setCouponCode] = useState("");
  const [manualDiscount, setManualDiscount] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PENDING">("PAID");
  const [notes, setNotes] = useState("");

  const [address, setAddress] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
  });

  const [quoteState, setQuoteState] = useState<{
    key: string;
    quote: QuoteDto | null;
    error: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Settings drive delivery defaults and which payment methods are offered.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getOne<StoreSettingsDto>("/settings");
        if (!cancelled) setSettings(result);
      } catch {
        /* fall back to permissive defaults below */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefill the address from the selected customer, and reset the delivery
  // charge when fulfilment changes. Both derive from other state, so they are
  // adjusted during render (React's documented alternative to an effect)
  // rather than in an effect that would trigger a second render pass.
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (customer && prefilledFor !== customer.id) {
    setPrefilledFor(customer.id);
    const preferred = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
    if (preferred) {
      setAddress({
        addressLine1: preferred.line1,
        addressLine2: preferred.line2 ?? "",
        city: preferred.city,
        state: preferred.state,
        postalCode: preferred.postalCode,
      });
    }
  }

  const chargeKey = `${deliveryType}|${settings?.deliverySettings.defaultDeliveryCharge ?? ""}`;
  const [chargeAppliedFor, setChargeAppliedFor] = useState(chargeKey);
  if (settings && chargeAppliedFor !== chargeKey) {
    setChargeAppliedFor(chargeKey);
    setDeliveryCharge(
      deliveryType === "DELIVERY" ? String(settings.deliverySettings.defaultDeliveryCharge) : "0"
    );
  }

  const cartQuantities = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.variantId, l.quantity])),
    [lines]
  );

  const addVariant = useCallback(
    (picked: PickedVariant) => {
      const stock = picked.variant.inventory?.currentStock ?? 0;

      setLines((current) => {
        const existing = current.find((l) => l.variantId === picked.variant.id);
        if (existing) {
          if (existing.quantity >= stock) {
            toast.warning(`Only ${stock} units of ${picked.product.name} are in stock`);
            return current;
          }
          return current.map((l) =>
            l.variantId === picked.variant.id ? { ...l, quantity: l.quantity + 1 } : l
          );
        }
        if (stock <= 0) {
          toast.warning(`${picked.product.name} is out of stock`);
          return current;
        }
        return [
          ...current,
          {
            variantId: picked.variant.id,
            productId: picked.product.id,
            productName: picked.product.name,
            variantName: picked.variant.name,
            sku: picked.variant.sku,
            unitPrice: picked.variant.discountPrice ?? picked.variant.sellingPrice,
            mrp: picked.variant.mrp,
            quantity: 1,
            availableStock: stock,
          },
        ];
      });
    },
    [toast]
  );

  const changeQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setLines((current) => current.filter((l) => l.variantId !== variantId));
      return;
    }
    setLines((current) =>
      current.map((l) =>
        l.variantId === variantId
          ? { ...l, quantity: Math.min(quantity, l.availableStock) }
          : l
      )
    );
  };

  // Re-quote on the server whenever anything that affects money changes.
  const quoteKey = JSON.stringify({
    items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    couponCode: useDebounce(couponCode, 500),
    manualDiscount: useDebounce(manualDiscount, 500),
    deliveryCharge: useDebounce(deliveryCharge, 500),
  });

  const hasItems = lines.length > 0;
  const quoting = hasItems && quoteState?.key !== quoteKey;
  const quote = quoteState?.key === quoteKey ? quoteState.quote : null;
  const quoteError = quoteState?.key === quoteKey ? quoteState.error : null;

  useEffect(() => {
    const payload = JSON.parse(quoteKey) as {
      items: { variantId: string; quantity: number }[];
      couponCode: string;
      manualDiscount: string;
      deliveryCharge: string;
    };

    if (payload.items.length === 0) return;

    let cancelled = false;

    void (async () => {
      try {
        const { data } = await post<QuoteDto>("/orders/quote", {
          items: payload.items,
          couponCode: payload.couponCode.trim().toUpperCase(),
          manualDiscount: Number(payload.manualDiscount) || 0,
          deliveryCharge: Number(payload.deliveryCharge) || 0,
        });
        if (!cancelled) setQuoteState({ key: quoteKey, quote: data, error: null });
      } catch (error) {
        if (!cancelled) {
          setQuoteState({
            key: quoteKey,
            quote: null,
            error: error instanceof ApiError ? error.message : "Unable to calculate totals",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quoteKey]);

  const enabledPaymentMethods = PAYMENT_METHODS.filter(
    (method) => !settings || settings.paymentSettings[method.key]
  );

  const canSubmit =
    !!customer && lines.length > 0 && !quoting && !quoteError && !submitting;

  const submit = async () => {
    if (!customer) {
      toast.warning("Select a customer first");
      return;
    }
    if (lines.length === 0) {
      toast.warning("Add at least one product");
      return;
    }

    setSubmitting(true);
    try {
      const result = await post<OrderDetailDto>("/local-orders", {
        customerId: customer.id,
        orderType,
        deliveryType,
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        ...(deliveryType === "DELIVERY" ? address : {}),
        couponCode: couponCode.trim().toUpperCase(),
        manualDiscount: Number(manualDiscount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        paymentMethod,
        paymentStatus,
        notes,
      });

      toast.success(result.message);
      router.push(`/orders/${result.data.id}`);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Unable to create the order. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="New Local Order"
        subtitle="Walk-in, phone and WhatsApp orders taken at the counter"
        breadcrumbs={[
          { label: "Local Orders", href: "/local-orders" },
          { label: "New order" },
        ]}
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1.35fr 1fr" },
          alignItems: "start",
        }}
      >
        {/* Left: customer + products */}
        <Box sx={{ display: "grid", gap: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>
                1 · Customer
              </Typography>
              <CustomerPicker customer={customer} onChange={setCustomer} />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>
                2 · Products
              </Typography>
              <ProductPicker onAdd={addVariant} cartQuantities={cartQuantities} />
            </CardContent>
          </Card>
        </Box>

        {/* Right: cart + checkout. Sticky on desktop so totals stay in view. */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            position: { lg: "sticky" },
            top: { lg: 88 },
          }}
        >
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 1 }}>
                3 · Order Summary
              </Typography>

              {quoteError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {quoteError}
                </Alert>
              )}

              <OrderSummary
                lines={lines}
                quote={quote}
                quoting={quoting}
                onQuantityChange={changeQuantity}
                onRemove={(id) => setLines((c) => c.filter((l) => l.variantId !== id))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>
                4 · Checkout
              </Typography>

              <Box sx={{ display: "grid", gap: 2 }}>
                <TextField
                  select
                  label="Order type"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                >
                  {ORDER_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                    Fulfilment
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={deliveryType}
                    onChange={(_, value) => value && setDeliveryType(value)}
                  >
                    <ToggleButton value="PICKUP" disabled={settings ? !settings.deliverySettings.enablePickup : false}>
                      Store pickup
                    </ToggleButton>
                    <ToggleButton value="DELIVERY" disabled={settings ? !settings.deliverySettings.enableDelivery : false}>
                      Delivery
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {deliveryType === "DELIVERY" && (
                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    <TextField
                      label="Address line 1"
                      value={address.addressLine1}
                      onChange={(e) => setAddress((a) => ({ ...a, addressLine1: e.target.value }))}
                      required
                    />
                    <TextField
                      label="Address line 2"
                      value={address.addressLine2}
                      onChange={(e) => setAddress((a) => ({ ...a, addressLine2: e.target.value }))}
                    />
                    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "1fr 1fr" }}>
                      <TextField
                        label="City"
                        value={address.city}
                        onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                        required
                      />
                      <TextField
                        label="State"
                        value={address.state}
                        onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                      />
                    </Box>
                    <TextField
                      label="Postal code"
                      value={address.postalCode}
                      onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                    />
                  </Box>
                )}

                <Divider />

                <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "1fr 1fr" }}>
                  <TextField
                    label="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="WELCOME10"
                  />
                  <TextField
                    label="Manual discount"
                    type="number"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      },
                    }}
                  />
                </Box>

                <TextField
                  label="Delivery charge"
                  type="number"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value)}
                  disabled={deliveryType === "PICKUP"}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    },
                  }}
                />

                <Divider />

                <TextField
                  select
                  label="Payment method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {enabledPaymentMethods.map((method) => (
                    <MenuItem key={method.value} value={method.value}>
                      {method.label}
                    </MenuItem>
                  ))}
                </TextField>

                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={paymentStatus}
                  onChange={(_, value) => value && setPaymentStatus(value)}
                >
                  <ToggleButton value="PAID">Paid now</ToggleButton>
                  <ToggleButton value="PENDING">Payment pending</ToggleButton>
                </ToggleButtonGroup>

                <TextField
                  label="Order notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  rows={2}
                />

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={!canSubmit}
                  loading={submitting}
                  onClick={submit}
                  startIcon={<CheckCircleOutlineIcon />}
                >
                  Confirm order
                </Button>

                {!customer && lines.length > 0 && (
                  <Typography variant="caption" sx={{ textAlign: "center", color: "warning.main" }}>
                    Select a customer to confirm this order
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </>
  );
}
