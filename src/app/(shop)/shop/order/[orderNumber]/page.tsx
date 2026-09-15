import { OrderConfirmationView } from "@/components/shop/OrderConfirmationView";

type Params = Promise<{ orderNumber: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber}` };
}

export default async function OrderPage({ params }: { params: Params }) {
  const { orderNumber } = await params;
  return <OrderConfirmationView orderNumber={decodeURIComponent(orderNumber)} />;
}
