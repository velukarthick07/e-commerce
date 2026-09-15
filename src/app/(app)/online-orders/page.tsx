"use client";

import Link from "next/link";
import Button from "@mui/material/Button";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { OrdersView } from "@/components/orders/OrdersView";

/**
 * Orders placed by customers on the storefront. They arrive as PENDING and
 * wait here to be confirmed, packed and dispatched — the same status actions
 * as any other order, on the order detail screen.
 */
export default function OnlineOrdersPage() {
  return (
    <>
      <PageHeader
        title="Online Orders"
        subtitle="Orders placed by customers on the shop — confirm, pack and dispatch"
        actions={
          <Button
            component={Link}
            href="/shop"
            target="_blank"
            variant="outlined"
            startIcon={<StorefrontOutlinedIcon />}
          >
            View shop
          </Button>
        }
      />
      <OrdersView
        showChannelFilter={false}
        defaultChannel="ONLINE"
        emptyTitle="No online orders yet"
        emptyDescription="Orders customers place on the storefront will appear here."
      />
    </>
  );
}
