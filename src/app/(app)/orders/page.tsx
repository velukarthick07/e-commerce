"use client";

import Link from "next/link";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { PageHeader } from "@/components/common/PageHeader";
import { OrdersView } from "@/components/orders/OrdersView";
import { useAuth } from "@/context/AuthContext";

export default function OrdersPage() {
  const { can } = useAuth();

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Every order across online and local channels"
        actions={
          can("local-orders:create") ? (
            <Button component={Link} href="/local-orders/new" variant="contained" startIcon={<AddIcon />}>
              New Local Order
            </Button>
          ) : null
        }
      />
      <OrdersView />
    </>
  );
}
