"use client";

import Link from "next/link";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { PageHeader } from "@/components/common/PageHeader";
import { OrdersView } from "@/components/orders/OrdersView";
import { useAuth } from "@/context/AuthContext";

export default function LocalOrdersPage() {
  const { can } = useAuth();

  const newOrderButton = can("local-orders:create") ? (
    <Button component={Link} href="/local-orders/new" variant="contained" startIcon={<AddIcon />}>
      New Local Order
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Local Orders"
        subtitle="Walk-in, phone, WhatsApp and local delivery orders"
        actions={newOrderButton}
      />
      <OrdersView
        endpoint="/local-orders"
        showChannelFilter={false}
        emptyTitle="No local orders yet"
        emptyDescription="Local orders created at the counter will appear here."
        emptyAction={newOrderButton}
      />
    </>
  );
}
