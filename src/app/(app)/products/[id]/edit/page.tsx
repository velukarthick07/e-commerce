"use client";

import { use } from "react";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useOne } from "@/hooks/useApiResource";
import type { ProductDto } from "@/types/models";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, loading, error } = useOne<ProductDto>(`/products/${id}`);

  if (loading) {
    return (
      <>
        <PageHeader title="Edit Product" />
        <Skeleton variant="rounded" height={520} />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Edit Product" breadcrumbs={[{ label: "Products", href: "/products" }]} />
        <Alert severity="error">{error ?? "This product could not be found."}</Alert>
      </>
    );
  }

  return <ProductForm product={data} />;
}
