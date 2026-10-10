"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { TestTapeRow } from "@/lib/server/synthra";
import { TEST_EXPLORER } from "@/lib/testnet";
import { amount as fmtAmount } from "@/lib/format";

export function TestTape() {
  const { data, isLoading, error, refetch } = useQuery<{ asOf: string; rows: TestTapeRow[] }>({
    queryKey: ["test-tape"],
    queryFn: async () => {
      const r = await fetch("/api/testnet/tape");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "unavailable");
      return j;
    },
    refetchInterval: 30_000,
    // Public testnet RPCs and mobile networks drop requests now and then: retry quietly, keep the last good data.
    retry: 6,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
  });
  if (isLoading) return <div className="skeleton h-64" />;
  if (!data)
    return (
      <div className="panel p-6 small muted flex items-center justify-between gap-4 flex-wrap">
        <span>Reconnecting to Robinhood Chain Testnet…{error ? " The public testnet node is busy; this retries automatically." : ""}</span>
        <button className="btn" onClick={() => refetch()}>Retry now</button>
      </div>
    );
  return (
    <div className="panel overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Test stock</th>
            <th>Pools (fee tier → price in test USDC)</th>
            <th>Spread across pools</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => {
            const usable = r.pools.filter((p) => !p.thin);
            const lo = Math.min(...usable.map((p) => p.priceUsdc));
            return (
              <tr key={r.ticker}>
                <td>
                  <div className="font-medium">{r.ticker}</div>
                  <div className="small faint">{r.name}</div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {r.pools.map((p) => (
                      <a
                        key={p.pool}
                        href={TEST_EXPLORER.robinhood.address(p.pool)}
                        target="_blank"
                        rel="noreferrer"
                        className={`chip num hover:text-text ${p.thin ? "opacity-50" : p.priceUsdc === lo && usable.length > 1 ? "!border-pos/40 pos" : ""}`}
                        title={`Pool ${p.pool} · ${fmtAmount(p.liquidityUsdc, 0)} test USDC deep`}
                      >
                        {(p.fee / 10000).toFixed(2)}% → {p.priceUsdc.toFixed(4)}
                        {p.thin && " · thin"}
                      </a>
                    ))}
                  </div>
                </td>
                <td className="num">{r.spreadBps == null ? "n/a" : `${fmtAmount(r.spreadBps, 0)} bp`}</td>
                <td>
                  <Link href={`/test/trade?t=${r.ticker}`} className="btn">Trade</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small faint px-4 py-3 border-t border-line">
        Read live from the Synthra pools on Robinhood Chain Testnet and refreshed every 30 seconds. Testers set these prices, not the
        real market, so what matters is the pattern: one token, several pools, several prices. Green is the cheapest pool to buy from. Faded pools hold less than 50 test USDC, so we leave them out of the spread.
      </p>
    </div>
  );
}
