import { CreateInvoice } from "@/components/create-invoice";

export const metadata = { title: "New pay link — Fairtape" };

export default async function NewPayLink({ searchParams }: PageProps<"/pay/new">) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 grid md:grid-cols-[1fr_420px] gap-10 items-start">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Get paid in dollars. Let them pay in anything.</h1>
        <p className="muted mt-3 max-w-lg">
          Create a link for an exact amount of USDC on Base or Solana. Your client can pay with NVDAx on Solana, NVDA on Robinhood Chain,
          NVDAc on Base, USDC, SOL or ETH — Fairtape sells and bridges in one signature, and you receive exactly what you asked for.
        </p>
        <ul className="mt-6 grid gap-3 text-sm">
          <li className="flex gap-3"><span className="pos">●</span><span>Settlement is verified from chain data, not from the payer&apos;s browser.</span></li>
          <li className="flex gap-3"><span className="pos">●</span><span>Every receipt links the source and delivery transactions.</span></li>
          <li className="flex gap-3"><span className="pos">●</span><span>No account, no custody, no chargebacks.</span></li>
        </ul>
      </div>
      <CreateInvoice initialNetwork={sp.net === "test" ? "testnet" : "mainnet"} />
    </div>
  );
}
