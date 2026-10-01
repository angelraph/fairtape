import Link from "next/link";
import { MyInvoices } from "@/components/my-invoices";

export const metadata = { title: "Pay links — Fairtape" };

export default function PayHome() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pay links</h1>
          <p className="muted mt-2 max-w-xl">Request exact USDC on Base or Solana. Payers settle with any stock, stablecoin or gas token on any of the three chains.</p>
        </div>
        <Link href="/pay/new" className="btn btn-primary btn-lg">New pay link</Link>
      </div>
      <MyInvoices />
    </div>
  );
}
