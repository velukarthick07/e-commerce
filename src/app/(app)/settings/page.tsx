"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { useOne } from "@/hooks/useApiResource";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { put, ApiError } from "@/services/api/client";
import type { StoreSettingsDto } from "@/types/models";

const TABS = [
  "Store information",
  "Delivery",
  "Payments",
  "Tax",
  "Orders",
  "Notifications",
  "Security",
  "Preferences",
];

export default function SettingsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, setData } = useOne<StoreSettingsDto>("/settings");

  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState<StoreSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);

  // The editable draft mirrors the fetched settings. Deriving it during render
  // (React's documented alternative to an effect) avoids a second render pass.
  const [syncedFrom, setSyncedFrom] = useState<StoreSettingsDto | null>(null);
  if (data && data !== syncedFrom) {
    setSyncedFrom(data);
    setDraft(structuredClone(data));
  }

  const readOnly = !can("settings:update");

  const set = <K extends keyof StoreSettingsDto>(key: K, value: StoreSettingsDto[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const setGroup = <G extends keyof StoreSettingsDto>(
    group: G,
    key: string,
    value: unknown
  ) =>
    setDraft((d) =>
      d
        ? { ...d, [group]: { ...(d[group] as Record<string, unknown>), [key]: value } }
        : d
    );

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await put<StoreSettingsDto>("/settings", draft);
      toast.success(result.message);
      setData(result.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <>
        <PageHeader title="Settings" />
        <Skeleton variant="rounded" height={480} />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Settings" />
        <Alert severity="error">{error}</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Store details and the business rules the backend enforces"
        actions={
          !readOnly ? (
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon />}
              loading={saving}
              onClick={save}
            >
              Save changes
            </Button>
          ) : null
        }
      />

      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your role can view settings but not change them.
        </Alert>
      )}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "220px 1fr" }, alignItems: "start" }}>
        <Card>
          <Tabs
            orientation="vertical"
            value={tab}
            onChange={(_, value) => setTab(value)}
            sx={{
              borderBottom: "none",
              "& .MuiTabs-indicator": { left: 0, width: 3 },
              "& .MuiTab-root": { alignItems: "flex-start", textAlign: "left", px: 2.5 },
            }}
          >
            {TABS.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Card>

        <Card>
          <CardContent>
            {tab === 0 && (
              <Section title="Store information">
                <Grid>
                  <TextField label="Store name" value={draft.storeName} disabled={readOnly} onChange={(e) => set("storeName", e.target.value)} />
                  <TextField label="Legal name" value={draft.legalName ?? ""} disabled={readOnly} onChange={(e) => set("legalName", e.target.value)} />
                  <TextField label="Email" value={draft.email ?? ""} disabled={readOnly} onChange={(e) => set("email", e.target.value)} />
                  <TextField label="Phone" value={draft.phone ?? ""} disabled={readOnly} onChange={(e) => set("phone", e.target.value)} />
                  <Full>
                    <TextField label="Address line 1" value={draft.addressLine1 ?? ""} disabled={readOnly} onChange={(e) => set("addressLine1", e.target.value)} />
                  </Full>
                  <Full>
                    <TextField label="Address line 2" value={draft.addressLine2 ?? ""} disabled={readOnly} onChange={(e) => set("addressLine2", e.target.value)} />
                  </Full>
                  <TextField label="City" value={draft.city ?? ""} disabled={readOnly} onChange={(e) => set("city", e.target.value)} />
                  <TextField label="State" value={draft.state ?? ""} disabled={readOnly} onChange={(e) => set("state", e.target.value)} />
                  <TextField label="Postal code" value={draft.postalCode ?? ""} disabled={readOnly} onChange={(e) => set("postalCode", e.target.value)} />
                  <TextField label="Country" value={draft.country} disabled={readOnly} onChange={(e) => set("country", e.target.value)} />
                  <TextField label="GST number" value={draft.gstNumber ?? ""} disabled={readOnly} onChange={(e) => set("gstNumber", e.target.value)} />
                  <TextField label="FSSAI licence" value={draft.fssaiLicense ?? ""} disabled={readOnly} onChange={(e) => set("fssaiLicense", e.target.value)} />
                  <TextField label="Currency symbol" value={draft.currencySymbol} disabled={readOnly} onChange={(e) => set("currencySymbol", e.target.value)} />
                  <TextField label="Timezone" value={draft.timezone} disabled={readOnly} onChange={(e) => set("timezone", e.target.value)} />
                </Grid>
              </Section>
            )}

            {tab === 1 && (
              <Section title="Delivery settings" subtitle="Applied as defaults on the local order screen">
                <Toggle label="Offer delivery" checked={draft.deliverySettings.enableDelivery} disabled={readOnly} onChange={(v) => setGroup("deliverySettings", "enableDelivery", v)} />
                <Toggle label="Offer store pickup" checked={draft.deliverySettings.enablePickup} disabled={readOnly} onChange={(v) => setGroup("deliverySettings", "enablePickup", v)} />
                <Divider sx={{ my: 2 }} />
                <Grid>
                  <Money label="Default delivery charge" value={draft.deliverySettings.defaultDeliveryCharge} disabled={readOnly} onChange={(v) => setGroup("deliverySettings", "defaultDeliveryCharge", v)} />
                  <Money label="Free delivery above" value={draft.deliverySettings.freeDeliveryAbove} disabled={readOnly} onChange={(v) => setGroup("deliverySettings", "freeDeliveryAbove", v)} />
                  <Money label="Maximum delivery charge" value={draft.deliverySettings.maxDeliveryCharge} disabled={readOnly} onChange={(v) => setGroup("deliverySettings", "maxDeliveryCharge", v)} />
                  <TextField label="Delivery radius (km)" type="number" value={draft.deliverySettings.deliveryRadiusKm} disabled={readOnly} onChange={(e) => setGroup("deliverySettings", "deliveryRadiusKm", Number(e.target.value))} />
                </Grid>
              </Section>
            )}

            {tab === 2 && (
              <Section title="Payment methods" subtitle="Only enabled methods appear at checkout">
                {([
                  ["cash", "Cash"],
                  ["card", "Card"],
                  ["upi", "UPI"],
                  ["cod", "Cash on delivery"],
                  ["onlinePayment", "Online payment"],
                ] as const).map(([key, label]) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={draft.paymentSettings[key]}
                    disabled={readOnly}
                    onChange={(v) => setGroup("paymentSettings", key, v)}
                  />
                ))}
              </Section>
            )}

            {tab === 3 && (
              <Section title="Tax settings" subtitle="Controls how GST is applied to every order total">
                <Toggle label="Apply tax to orders" checked={draft.taxSettings.taxEnabled} disabled={readOnly} onChange={(v) => setGroup("taxSettings", "taxEnabled", v)} />
                <Toggle
                  label="Prices already include tax (MRP-based)"
                  checked={draft.taxSettings.pricesIncludeTax}
                  disabled={readOnly}
                  onChange={(v) => setGroup("taxSettings", "pricesIncludeTax", v)}
                />
                <Alert severity="info" sx={{ my: 2 }}>
                  {draft.taxSettings.pricesIncludeTax
                    ? "Tax is extracted from the price for reporting — the customer pays the listed price."
                    : "Tax is added on top of the price, so the total will exceed the listed MRP."}
                </Alert>
                <Grid>
                  <TextField
                    label="Default tax rate"
                    type="number"
                    value={draft.taxSettings.defaultTaxRate}
                    disabled={readOnly}
                    onChange={(e) => setGroup("taxSettings", "defaultTaxRate", Number(e.target.value))}
                    slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                  />
                </Grid>
              </Section>
            )}

            {tab === 4 && (
              <Section title="Order rules" subtitle="Enforced by the backend on every order">
                <Toggle label="Allow backorders (sell beyond available stock)" checked={draft.orderSettings.allowBackorders} disabled={readOnly} onChange={(v) => setGroup("orderSettings", "allowBackorders", v)} />
                <Toggle label="Never sell expired batches" checked={draft.orderSettings.blockExpiredStock} disabled={readOnly} onChange={(v) => setGroup("orderSettings", "blockExpiredStock", v)} />
                <Toggle label="Auto-confirm local orders" checked={draft.orderSettings.autoConfirmLocalOrders} disabled={readOnly} onChange={(v) => setGroup("orderSettings", "autoConfirmLocalOrders", v)} />
                <Toggle label="Low stock alerts" checked={draft.orderSettings.lowStockAlert} disabled={readOnly} onChange={(v) => setGroup("orderSettings", "lowStockAlert", v)} />
                <Divider sx={{ my: 2 }} />
                <Grid>
                  <TextField
                    label="Maximum manual discount"
                    type="number"
                    value={draft.orderSettings.maxManualDiscountPercent}
                    disabled={readOnly}
                    onChange={(e) => setGroup("orderSettings", "maxManualDiscountPercent", Number(e.target.value))}
                    helperText="Staff cannot discount beyond this share of the subtotal"
                    slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                  />
                </Grid>
              </Section>
            )}

            {tab === 5 && (
              <Section title="Notifications">
                {([
                  ["lowStockEmails", "Low stock emails"],
                  ["expiryAlerts", "Expiry alerts"],
                  ["newOrderAlerts", "New order alerts"],
                  ["dailySummary", "Daily summary"],
                ] as const).map(([key, label]) => (
                  <Toggle key={key} label={label} checked={draft.notificationSettings[key]} disabled={readOnly} onChange={(v) => setGroup("notificationSettings", key, v)} />
                ))}
                <Alert severity="info" sx={{ mt: 2 }}>
                  Preferences are stored now; connect an email provider to start dispatching them.
                </Alert>
              </Section>
            )}

            {tab === 6 && (
              <Section title="Security">
                <Toggle label="Enforce strong passwords" checked={draft.securitySettings.enforceStrongPasswords} disabled={readOnly} onChange={(v) => setGroup("securitySettings", "enforceStrongPasswords", v)} />
                <Divider sx={{ my: 2 }} />
                <Grid>
                  <TextField
                    label="Session timeout (minutes)"
                    type="number"
                    value={draft.securitySettings.sessionTimeoutMinutes}
                    disabled={readOnly}
                    onChange={(e) => setGroup("securitySettings", "sessionTimeoutMinutes", Number(e.target.value))}
                  />
                </Grid>
                <Button href="/settings/profile" sx={{ mt: 2 }}>
                  Change your password
                </Button>
              </Section>
            )}

            {tab === 7 && (
              <Section title="Application preferences">
                <Grid>
                  <TextField
                    select
                    label="Date format"
                    value={draft.preferences.dateFormat}
                    disabled={readOnly}
                    onChange={(e) => setGroup("preferences", "dateFormat", e.target.value)}
                  >
                    <MenuItem value="dd/MM/yyyy">DD/MM/YYYY</MenuItem>
                    <MenuItem value="MM/dd/yyyy">MM/DD/YYYY</MenuItem>
                    <MenuItem value="yyyy-MM-dd">YYYY-MM-DD</MenuItem>
                  </TextField>
                  <TextField
                    label="Rows per page"
                    type="number"
                    value={draft.preferences.rowsPerPage}
                    disabled={readOnly}
                    onChange={(e) => setGroup("preferences", "rowsPerPage", Number(e.target.value))}
                  />
                </Grid>
                <Toggle label="Compact tables" checked={draft.preferences.compactTables} disabled={readOnly} onChange={(v) => setGroup("preferences", "compactTables", v)} />
              </Section>
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="h5">{title}</Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ display: "block", mb: 2 }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={{ mt: subtitle ? 0 : 2 }}>{children}</Box>
    </Box>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
      {children}
    </Box>
  );
}

function Full({ children }: { children: React.ReactNode }) {
  return <Box sx={{ gridColumn: { sm: "span 2" } }}>{children}</Box>;
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <FormControlLabel
      sx={{ display: "flex", ml: 0 }}
      control={<Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />}
      label={<Typography sx={{ fontSize: 14 }}>{label}</Typography>}
    />
  );
}

function Money({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <TextField
      label={label}
      type="number"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
    />
  );
}
