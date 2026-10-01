"use client";

import Link from "next/link";
import { useHoldings } from "./use-holdings";
import { useTape } from "./use-tape";
import { WalletBar } from "./connect";
import { CHAIN_LABEL, EXPLORER } from "@/lib/registry";
import { usd, amount as fmtAmount, bpsLabel } from "@/lib/format";
import { ISSUER_COLOR } from "./premium-chart";

export function PortfolioView() {
  const { data, isLoading, evmAddr, solAddr } = useHoldings();
  const { data: tape } = useTape();
  if (!evmAddr && !solAddr)
    return (
      <div className="panel p-10 text-center grid gap-4 justify-items-center">
        <p className="muted max-w-md">Connect a Solana wallet and a Base / Robinhood wallet. Fairtape reads your balances directly from all three chains.</p>
        <WalletBar />
      </div>
    );
  if (isLoading) return <div className="skeleton h-64" />;

  const holdings = data?.holdings ?? [];
  const stocks = holdings.filter((h) => h.kind === "stock");
  const cash = holdings.filter((h) => h.kind !== "stock");
  const byTicker = new Map<string, typeof stocks>();
  for (const h of stocks) byTicker.set(h.ticker!, [...(byTicker.get(h.ticker!) ?? []), h]);
  const total = holdings.reduce((n, h) => n + (h.usd ?? 0), 0);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="panel p-4">
          <div className="label">Stocks + dollars</div>
          <div className="num text-2xl">{usd(total)}</div>
          <div className="small faint">valued per share at reference</div>
        </div>
        <div className="panel p-4">
          <div className="label">Stock positions</div>
          <div className="num text-2xl">{byTicker.size}</div>
          <div className="small faint">{stocks.length} tokens across issuers</div>
        </div>
        <div className="panel p-4 hidden sm:block">
          <div className="label">Chains read</div>
          <div className="num text-2xl">{(evmAddr ? 2 : 0) + (solAddr ? 1 : 0)}</div>
          <div className="small faint">live RPC, no indexer</div>
        </div>
      </div>

      {byTicker.size === 0 && <div className="panel p-6 muted">No tokenized stocks found yet. <Link className="underline" href="/trade">Get the best print →</Link></div>}

      {[...byTicker.entries()].map(([ticker, hs]) => {
        const row = tape?.rows.find((r) => r.ticker === ticker);
        const best = row?.venues.find((v) => `${v.chain}:${v.address}` === row.bestSell);
        const shares = hs.reduce((n, h) => n + (h.shares ?? 0), 0);
        return (
          <div key={ticker} className="panel">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div>
                <span className="font-semibold">{ticker}</span>
                <span className="muted small ml-2 num">{fmtAmount(shares, 6)} shares · {usd(hs.reduce((n, h) => n + (h.usd ?? 0), 0))}</span>
              </div>
              <Link href={`/s/${ticker}`} className="link-button">View tape →</Link>
            </div>
            {hs.map((h) => {
              const venue = row?.venues.find((v) => v.address.toLowerCase() === h.token.toLowerCase());
              const gap = venue?.premiumBps != null && best?.premiumBps != null ? best.premiumBps - venue.premiumBps : null;
              return (
                <div key={`${h.chain}:${h.token}`} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 flex-wrap">
                  <span className="inline-flex items-center gap-2 min-w-[150px]">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: ISSUER_COLOR[h.issuer!] }} />
                    <span className="font-medium">{h.symbol}</span>
                    <span className="small muted">{h.issuer}</span>
                  </span>
                  <span className="chip"><span className={`chain-dot chain-${h.chain}`} />{CHAIN_LABEL[h.chain]}</span>
                  <span className="num ml-auto">{fmtAmount(h.amount, 6)}</span>
                  <span className="num muted w-24 text-right">{usd(h.usd)}</span>
                  <span className="small w-40 text-right">
                    {gap != null && gap > 5 && best && best.address !== h.token ? (
                      <Link className="pos underline" href={`/trade?t=${ticker}&side=sell`}>
                        {best.issuer} bids {bpsLabel(gap)} more
                      </Link>
                    ) : (
                      <span className="faint">fairly priced</span>
                    )}
                  </span>
                  <a className="small muted underline" target="_blank" rel="noreferrer" href={EXPLORER[h.chain].token(h.token)}>↗</a>
                </div>
              );
            })}
          </div>
        );
      })}

      {cash.length > 0 && (
        <div className="panel">
          <div className="px-4 py-3 border-b border-line font-semibold">Dollars & gas</div>
          {cash.map((h) => (
            <div key={`${h.chain}:${h.token}`} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0">
              <span className="font-medium min-w-[80px]">{h.symbol}</span>
              <span className="chip"><span className={`chain-dot chain-${h.chain}`} />{CHAIN_LABEL[h.chain]}</span>
              <span className="num ml-auto">{fmtAmount(h.amount, 6)}</span>
            </div>
          ))}
        </div>
      )}
      {data?.errors?.length ? <p className="small warn">Some chains could not be read: {data.errors.join("; ")}</p> : null}
    </div>
  );
}
