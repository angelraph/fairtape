import Link from "next/link";
import { notFound } from "next/navigation";
import { getAsset } from "@/lib/registry";
import { getTape } from "@/lib/server/tape";
import { VenueCards } from "@/components/venue-cards";
import { PremiumChart } from "@/components/premium-chart";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/s/[ticker]">) {
  const { ticker } = await params;
  const a = getAsset(ticker);
  return { title: a ? `${a.ticker} across every chain | Fairtape` : "Fairtape" };
}

export default async function StockPage({ params }: PageProps<"/s/[ticker]">) {
  const { ticker } = await params;
  const asset = getAsset(ticker);
  if (!asset) notFound();
  const tape = await getTape();
  const row = tape.rows.find((r) => r.ticker === asset.ticker)!;
  const best = row.venues.find((v) => `${v.chain}:${v.address}` === row.bestBuy);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="small muted">
            <Link href="/tape" className="hover:text-text">Tape</Link> / {asset.ticker}
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mt-1">
            {asset.ticker} <span className="muted font-normal text-2xl">{asset.name}</span>
          </h1>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="num text-xl">{usd(row.reference.price)}</span>
            <span className="small muted">{row.reference.source}</span>
            <span className="chip">{tape.sessionLabel}</span>
            {row.spreadBps != null && <span className="chip warn !border-warn/40">{row.spreadBps.toFixed(1)} bp across issuers</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/trade?t=${asset.ticker}&side=buy`} className="btn btn-primary btn-lg">
            Buy best{best ? ` (${best.issuer})` : ""}
          </Link>
          <Link href={`/trade?t=${asset.ticker}&side=sell`} className="btn btn-lg">Sell</Link>
          <Link href={`/trade?t=${asset.ticker}&side=move`} className="btn btn-lg">Switch issuer</Link>
        </div>
      </div>

      <VenueCards initial={tape} asset={asset} />
      <PremiumChart ticker={asset.ticker} />

      <div className="panel p-5 small muted grid gap-2">
        <div className="text-text font-medium">How Fairtape prices {asset.ticker}</div>
        <p>
          Each venue&apos;s token price is divided by that issuer&apos;s live share multiplier: Token-2022 scaled-UI amount for xStocks and Ondo,
          ERC-8056 <span className="num">uiMultiplier()</span> for Robinhood, B20 <span className="num">uiMultiplier()</span> for Coinbase, so
          every number on this page is the price of one real share. Robinhood Chain and Base prices are read from the deepest onchain pool;
          Solana prices come from Jupiter. The reference is the underlying share price from Robinhood market data, and each EVM venue is
          cross-checked against its Chainlink feed.
        </p>
      </div>
    </div>
  );
}
