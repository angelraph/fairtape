import { assets } from "@/lib/registry";
import { TradeDesk } from "@/components/trade-desk";

export const metadata = { title: "Best print | Fairtape" };

export default async function TradePage({ searchParams }: PageProps<"/trade">) {
  const sp = await searchParams;
  const t = typeof sp.t === "string" ? sp.t.toUpperCase() : "NVDA";
  const side = sp.side === "sell" || sp.side === "move" ? sp.side : "buy";
  const ticker = assets.some((a) => a.ticker === t) ? t : "NVDA";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Best print</h1>
      <p className="muted mt-2 mb-8 max-w-2xl">
        Start from whatever you hold on any chain. Fairtape prices every issuer and chain for the same stock and executes the route that
        delivers the most real shares, or the most dollars when you sell.
      </p>
      <TradeDesk assets={assets} initialTicker={ticker} initialSide={side} />
    </div>
  );
}
