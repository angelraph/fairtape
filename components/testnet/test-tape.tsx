"use client";

import Link from "next/link";
import { TEST_STOCKS, TEST_EXPLORER } from "@/lib/testnet";
import { amount as fmtAmount, usd } from "@/lib/format";
import { useDesk, priceOf } from "./use-desk";

function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function TestTape() {
  const { data, isLoading, error, refetch } = useDesk();
  if (isLoading) return <div className="skeleton h-64" />;
  if (!data)
    return (
      <div className="panel p-6 small muted flex items-center justify-between gap-4 flex-wrap">
        <span>Reconnecting…{error ? " A price source is busy; this retries automatically." : ""}</span>
        <button className="btn" onClick={() => refetch()}>Retry now</button>
      </div>
    );
  return (
    <div className="panel overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Stock</th>
            <th>Live market price</th>
            <th>Source</th>
            <th>Desk can deliver</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {TEST_STOCKS.map((s) => {
            const row = priceOf(data, s.address);
            const held = row ? Number(row.inventory) / 1e18 : 0;
            return (
              <tr key={s.ticker}>
                <td>
                  <div className="font-medium">{s.ticker}</div>
                  <div className="small faint">{s.name}</div>
                </td>
                <td className="num">{row?.price ? usd(row.price.usd) : <span className="warn small">no live price, not quoting</span>}</td>
                <td className="small muted">
                  {row?.price ? (
                    <>
                      {row.price.source}
                      <div className="faint" suppressHydrationWarning>{ago(row.price.asOf)}</div>
                    </>
                  ) : (
                    "n/a"
                  )}
                </td>
                <td className="num">
                  {data.live ? (
                    <>
                      {fmtAmount(held, 4)} {s.ticker}
                      {row?.inventoryUsd != null && <div className="small faint">{usd(row.inventoryUsd)}</div>}
                    </>
                  ) : (
                    <span className="small faint">opening soon</span>
                  )}
                </td>
                <td>
                  <Link href={`/test/trade?t=${s.ticker}`} className="btn">Trade</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small faint px-4 py-3 border-t border-line">
        These are the real prices of the real stocks, refreshed every 20 seconds from Robinhood&apos;s market data, with xStocks on Solana as
        a backup. On testnet, the Fairtape desk fills every trade at exactly this price with free test tokens. If no live price is
        available, the desk stops quoting instead of guessing.
        {data.address && (
          <>
            {" "}
            <a className="underline hover:text-text" href={TEST_EXPLORER.robinhood.address(data.address)} target="_blank" rel="noreferrer">
              See the desk contract ↗
            </a>
          </>
        )}
      </p>
    </div>
  );
}
