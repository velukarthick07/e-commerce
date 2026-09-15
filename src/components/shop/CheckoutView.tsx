"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { OrderTotals } from "./OrderTotals";
import { CouponField } from "./CouponField";
import { OtpSignIn } from "./OtpSignIn";
import {
  AddressFormDialog,
  emptyAddress,
  type AddressFormValues,
} from "./AddressFormDialog";
import { useCart } from "@/hooks/useCart";
import { useShopQuote } from "@/hooks/useShopQuote";
import { useShopAuth } from "@/context/ShopAuthContext";
import { useToast } from "@/context/ToastContext";
import { shopApi, toQuoteItems } from "@/services/api/shop";
import { ApiError } from "@/services/api/client";
import { rememberOrder } from "@/lib/shop/recent-order";
import { formatMoney } from "@/lib/format";
import { normalisePhone } from "@/lib/phone";
import { placeOrderSchema, storefrontAddressSchema } from "@/validators/storefront.validator";
import type { DeliveryType, PaymentMethod } from "@/generated/prisma/enums";
import type { PhoneLookup, ShopAddress, StoreInfo } from "@/types/shop";

type CheckoutPayload = Parameters<typeof shopApi.placeOrder>[0];

const PAYMENT_LABELS: Record<string, { label: string; hint: string }> = {
  COD: { label: "Cash on delivery", hint: "Pay the delivery partner in cash" },
  UPI: { label: "UPI on delivery", hint: "Scan and pay when your order arrives" },
  ONLINE_PAYMENT: { label: "Pay online", hint: "Card, UPI or net banking" },
  CARD: { label: "Card on delivery", hint: "Pay by card at your door" },
  CASH: { label: "Cash", hint: "Pay in cash" },
};

/** Turns a ZodError into `{ field: message }` for inline display. */
function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

function formatAddress(address: ShopAddress) {
  return [address.line1, address.line2, address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

export function CheckoutView({ store }: { store: StoreInfo }) {
  const router = useRouter();
  const toast = useToast();
  const { items, isEmpty, clear } = useCart();
  const { customer, refresh, ready } = useShopAuth();

  const [coupon, setCoupon] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    store.delivery.enableDelivery ? "DELIVERY" : "PICKUP"
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    store.paymentMethods[0] ?? "COD"
  );

  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [address, setAddress] = useState<AddressFormValues>(emptyAddress);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);

  const [lookup, setLookup] = useState<PhoneLookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // Adjust-during-render rather than an effect: when the signed-in customer
  // resolves (or changes), their details become the form's starting point.
  const [syncedCustomerId, setSyncedCustomerId] = useState<string | null>(null);
  if (customer && syncedCustomerId !== customer.id) {
    setSyncedCustomerId(customer.id);
    setContact({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
    });
    setSelectedAddressId(
      customer.addresses.find((a) => a.isDefault)?.id ?? customer.addresses[0]?.id ?? ""
    );
    setLookup(null);
  }
  if (!customer && syncedCustomerId !== null) {
    setSyncedCustomerId(null);
  }

  const { quote, error: quoteError, stale } = useShopQuote(items, coupon, deliveryType);
  const couponError = coupon && quote && !quote.appliedCoupon ? quoteError : null;

  const savedAddresses = customer?.addresses ?? [];
  const usingSavedAddress = Boolean(customer && selectedAddressId);

  /**
   * When a guest types a number we already know, we say so — but only in
   * masked form. Releasing the real name and address to anyone who can type a
   * phone number would make this a lookup service, so the full details arrive
   * only after they prove the number is theirs.
   */
  async function handlePhoneBlur() {
    const phone = normalisePhone(contact.phone);
    if (customer || phone.length !== 10) return;
    setLookingUp(true);
    try {
      const result = await shopApi.lookup(phone);
      setLookup(result);
      if (result.found && result.verified) {
        setContact((c) => ({
          ...c,
          name: c.name || result.name,
          email: c.email || result.email || "",
        }));
        const preferred =
          result.addresses.find((a) => a.isDefault) ?? result.addresses[0];
        if (preferred) setAddress(addressToForm(preferred));
      }
    } catch {
      setLookup(null);
    } finally {
      setLookingUp(false);
    }
  }

  function addressToForm(a: ShopAddress): AddressFormValues {
    return {
      label: a.label,
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      landmark: a.landmark ?? "",
      isDefault: a.isDefault,
    };
  }

  async function handleSaveNewAddress(values: AddressFormValues) {
    setSavingAddress(true);
    try {
      const saved = await shopApi.addAddress({
        label: values.label,
        line1: values.line1,
        line2: values.line2 || undefined,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode,
        landmark: values.landmark || undefined,
        isDefault: values.isDefault,
      });
      await refresh();
      setSelectedAddressId(saved.id);
      setAddressDialogOpen(false);
      toast.success("Address saved");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save that address"
      );
    } finally {
      setSavingAddress(false);
    }
  }

  function buildPayload(): CheckoutPayload {
    const payload: CheckoutPayload = {
      items: toQuoteItems(items),
      name: contact.name,
      phone: contact.phone,
      email: contact.email || undefined,
      deliveryType,
      saveAddress,
      deliveryNotes: deliveryNotes || undefined,
      // Only a code the pricing endpoint actually accepted is sent on, so a
      // mistyped coupon can never fail the order itself.
      couponCode: quote?.appliedCoupon?.code || undefined,
      paymentMethod,
    };

    if (deliveryType === "DELIVERY") {
      if (usingSavedAddress) {
        payload.addressId = selectedAddressId;
      } else {
        payload.address = {
          label: address.label,
          line1: address.line1,
          line2: address.line2 || undefined,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          landmark: address.landmark || undefined,
          isDefault: address.isDefault,
        };
      }
    }

    return payload;
  }

  async function placeOrder() {
    setSubmitError(null);

    // Validate with the very schema the API uses, so the messages the shopper
    // sees inline are the ones the server would have sent back.
    const payload = buildPayload();
    const parsed = placeOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const flat = fieldErrorsFrom(parsed.error);
      // The schema reports a missing address as one issue; the inline form
      // needs it spread across the fields the shopper can actually fix.
      if (flat.address && !usingSavedAddress) {
        const inner = storefrontAddressSchema.safeParse(payload.address ?? {});
        if (!inner.success) Object.assign(flat, fieldErrorsFrom(inner.error));
      }
      setErrors(flat);
      setSubmitError("Please check the highlighted fields.");
      return;
    }

    setErrors({});
    setPlacing(true);
    try {
      const result = await shopApi.placeOrder(payload);
      const order = result.data;
      rememberOrder(order.orderNumber, order.customerPhone);
      clear();
      toast.success(result.message);
      router.push(`/shop/order/${order.orderNumber}`);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "We could not place your order. Please try again.";
      setSubmitError(message);
      if (error instanceof ApiError && error.fields) {
        setErrors(
          Object.fromEntries(
            Object.entries(error.fields).map(([key, list]) => [key, list[0] ?? ""])
          )
        );
      }
    } finally {
      setPlacing(false);
    }
  }

  if (isEmpty) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Nothing to check out
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Your cart is empty.
          </Typography>
          <Button component={Link} href="/shop" variant="contained">
            Browse products
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Checkout
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
          alignItems: "start",
        }}
      >
        <Stack spacing={2.5}>
          {/* ---------------- Contact ---------------- */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
            >
              <Typography variant="h4">Your details</Typography>
              {customer ? (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<CheckCircleOutlinedIcon />}
                  label="Signed in"
                />
              ) : null}
            </Stack>

            {customer ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                Signed in as {customer.name}. Check the details below and carry on.
              </Alert>
            ) : null}

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              }}
            >
              <TextField
                label="Mobile number"
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                onBlur={handlePhoneBlur}
                disabled={Boolean(customer)}
                inputMode="numeric"
                autoComplete="tel"
                error={Boolean(errors.phone)}
                helperText={errors.phone}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">+91</InputAdornment>,
                    endAdornment: lookingUp ? (
                      <InputAdornment position="end">
                        <CircularProgress size={16} />
                      </InputAdornment>
                    ) : null,
                  },
                }}
              />
              <TextField
                label="Full name"
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                autoComplete="name"
                error={Boolean(errors.name)}
                helperText={errors.name}
              />
              <TextField
                label="Email (optional)"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                autoComplete="email"
                type="email"
                error={Boolean(errors.email)}
                helperText={errors.email}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />
            </Box>

            {!customer && lookup?.found && !lookup.verified ? (
              <Alert
                severity="info"
                sx={{ mt: 2 }}
                action={
                  <Button size="small" onClick={() => setSignInOpen(true)}>
                    Verify
                  </Button>
                }
              >
                Welcome back, <strong>{lookup.maskedName}</strong>! Verify this
                number to fill in your saved details
                {lookup.addressCount > 0
                  ? ` and ${lookup.addressCount} saved address${lookup.addressCount === 1 ? "" : "es"}`
                  : ""}
                .
              </Alert>
            ) : null}

            {!customer && lookup?.found === false ? (
              <Typography variant="caption" sx={{ display: "block", mt: 1.5 }}>
                First time here? No account needed — just fill in the details below.
              </Typography>
            ) : null}
          </Paper>

          {/* ---------------- Delivery ---------------- */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              How would you like it?
            </Typography>

            <ToggleButtonGroup
              exclusive
              value={deliveryType}
              onChange={(_, next: DeliveryType | null) => next && setDeliveryType(next)}
              sx={{ mb: 2.5, flexWrap: "wrap", gap: 1 }}
            >
              {store.delivery.enableDelivery ? (
                <ToggleButton
                  value="DELIVERY"
                  sx={{ px: 2.5, py: 1.25, textTransform: "none", borderRadius: 2, border: "1px solid !important", borderColor: "divider !important" }}
                >
                  <HomeOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                  Home delivery
                </ToggleButton>
              ) : null}
              {store.delivery.enablePickup ? (
                <ToggleButton
                  value="PICKUP"
                  sx={{ px: 2.5, py: 1.25, textTransform: "none", borderRadius: 2, border: "1px solid !important", borderColor: "divider !important" }}
                >
                  <StorefrontOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                  Collect from store
                </ToggleButton>
              ) : null}
            </ToggleButtonGroup>

            {deliveryType === "PICKUP" ? (
              <Alert severity="info">
                Collect from {store.storeName}
                {store.city ? `, ${store.city}` : ""}. We&apos;ll call you on{" "}
                {contact.phone || "your mobile"} when it&apos;s ready.
              </Alert>
            ) : savedAddresses.length > 0 && customer ? (
              <Stack spacing={1.5}>
                <RadioGroup
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                >
                  {savedAddresses.map((saved) => (
                    <Card
                      key={saved.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        mb: 1,
                        borderColor:
                          selectedAddressId === saved.id ? "primary.main" : "divider",
                        bgcolor:
                          selectedAddressId === saved.id ? "primary.light" : "transparent",
                      }}
                    >
                      <FormControlLabel
                        value={saved.id}
                        control={<Radio />}
                        sx={{ alignItems: "flex-start", m: 0, width: "100%" }}
                        label={
                          <Box sx={{ pt: 0.75 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <Typography variant="subtitle2" sx={{ color: "text.primary" }}>
                                {saved.label}
                              </Typography>
                              {saved.isDefault ? (
                                <Chip size="small" label="Default" color="primary" variant="outlined" />
                              ) : null}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {formatAddress(saved)}
                            </Typography>
                          </Box>
                        }
                      />
                    </Card>
                  ))}
                </RadioGroup>

                <Button
                  startIcon={<AddLocationAltOutlinedIcon />}
                  onClick={() => setAddressDialogOpen(true)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Add a new address
                </Button>
              </Stack>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                }}
              >
                <TextField
                  select
                  label="Save as"
                  value={address.label}
                  onChange={(e) => setAddress((a) => ({ ...a, label: e.target.value }))}
                >
                  {["Home", "Work", "Other"].map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="PIN code"
                  value={address.postalCode}
                  onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  error={Boolean(errors.postalCode)}
                  helperText={errors.postalCode}
                />
                <TextField
                  label="House / flat, street"
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  autoComplete="address-line1"
                  error={Boolean(errors.line1)}
                  helperText={errors.line1}
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                />
                <TextField
                  label="Area / locality (optional)"
                  value={address.line2}
                  onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                  autoComplete="address-line2"
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                />
                <TextField
                  label="City"
                  value={address.city}
                  onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                  autoComplete="address-level2"
                  error={Boolean(errors.city)}
                  helperText={errors.city}
                />
                <TextField
                  label="State"
                  value={address.state}
                  onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                  autoComplete="address-level1"
                  error={Boolean(errors.state)}
                  helperText={errors.state}
                />
                <TextField
                  label="Landmark (optional)"
                  value={address.landmark}
                  onChange={(e) => setAddress((a) => ({ ...a, landmark: e.target.value }))}
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                />
                {customer ? (
                  <FormControlLabel
                    sx={{ gridColumn: { sm: "1 / -1" } }}
                    control={
                      <Checkbox
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                      />
                    }
                    label="Save this address to my account"
                  />
                ) : null}
              </Box>
            )}

            <TextField
              label="Delivery instructions (optional)"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              sx={{ mt: 2 }}
            />
          </Paper>

          {/* ---------------- Payment ---------------- */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Payment
            </Typography>
            <RadioGroup
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              {store.paymentMethods.map((method) => {
                const meta = PAYMENT_LABELS[method] ?? { label: method, hint: "" };
                return (
                  <FormControlLabel
                    key={method}
                    value={method}
                    control={<Radio />}
                    sx={{ alignItems: "flex-start", mb: 1, mr: 0 }}
                    label={
                      <Box sx={{ pt: 0.75 }}>
                        <Typography variant="subtitle2" sx={{ color: "text.primary" }}>
                          {meta.label}
                        </Typography>
                        <Typography variant="caption">{meta.hint}</Typography>
                      </Box>
                    }
                  />
                );
              })}
            </RadioGroup>
          </Paper>
        </Stack>

        {/* ---------------- Summary ---------------- */}
        <Paper
          variant="outlined"
          sx={{ p: 2.5, borderRadius: 3, position: { md: "sticky" }, top: { md: 96 } }}
        >
          <Typography variant="h4" sx={{ mb: 2 }}>
            Order summary
          </Typography>

          <Stack spacing={1} sx={{ mb: 2 }}>
            {items.map((line) => (
              <Stack
                key={line.variantId}
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between" }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
                  {line.productName}{" "}
                  <Box component="span" sx={{ color: "text.disabled" }}>
                    × {line.quantity}
                  </Box>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                  {formatMoney(line.unitPrice * line.quantity)}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <CouponField
            applied={quote?.appliedCoupon?.code ?? null}
            error={couponError}
            onApply={setCoupon}
            onClear={() => setCoupon("")}
          />

          <Divider sx={{ my: 2 }} />

          <OrderTotals quote={quote} stale={stale} showFreeDeliveryProgress={false} />

          {submitError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {submitError}
            </Alert>
          ) : null}

          <Button
            variant="contained"
            size="large"
            fullWidth
            sx={{ mt: 2.5 }}
            loading={placing}
            disabled={!quote || !ready}
            onClick={placeOrder}
          >
            Place order · {quote ? formatMoney(quote.grandTotal) : "…"}
          </Button>

          <Typography variant="caption" sx={{ display: "block", mt: 1.5, textAlign: "center" }}>
            You&apos;ll be able to track this order with your mobile number.
          </Typography>
        </Paper>
      </Box>

      {/* Verify-to-autofill, for a guest whose number we recognise. */}
      <Dialog open={signInOpen} onClose={() => setSignInOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Verify your number</DialogTitle>
        <DialogContent dividers>
          <OtpSignIn
            compact
            lockPhone
            defaultPhone={contact.phone}
            onSuccess={async () => {
              setSignInOpen(false);
              await refresh();
              toast.success("Verified — your saved details are filled in");
            }}
          />
        </DialogContent>
      </Dialog>

      <AddressFormDialog
        key={addressDialogOpen ? "open" : "closed"}
        open={addressDialogOpen}
        initial={emptyAddress}
        title="Add a delivery address"
        saving={savingAddress}
        onClose={() => setAddressDialogOpen(false)}
        onSubmit={handleSaveNewAddress}
      />
    </Container>
  );
}
