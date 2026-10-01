import { notFound } from "next/navigation";
import { refreshInvoice } from "@/lib/server/invoices";
import { PayInvoice } from "@/components/pay-invoice";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/pay/[id]">) {
  const { id } = await params;
  const inv = await refreshInvoice(id);
  return { title: inv ? `Pay ${inv.merchant_name} $${inv.amount_usd} — Fairtape` : "Pay — Fairtape" };
}

export default async function PayPage({ params, searchParams }: PageProps<"/pay/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const inv = await refreshInvoice(id);
  if (!inv) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PayInvoice initial={inv} justCreated={sp.created === "1"} />
    </div>
  );
}
