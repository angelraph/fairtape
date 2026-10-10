"use client";

import Link from "next/link";
import type { Tape, TapeRow, VenueQuote } from "@/lib/server/tape";
import { useTape } from "./use-tape";
import { usd, bpsLabel, bpsClass } from "@/lib/format";
import type { Issuer } from "@/lib/registry";

const ISSUERS: { issuer: Issuer; chain: string; chainClass: string }[] = [
  { issuer: "xStocks", chain: "Solana", chainClass: "chain-solana" },
  { issuer: "Ondo", chain: "Solana", chainClass: "chain-solana" },
  { issuer: "Robinhood", chain: "Robinhood Chain", chainClass: "chain-robinhood" },
  { issuer: "Coinbase", chain: "Base", chainClass: "chain-base" },
];

function VenueCell({ row, v }: { row: TapeRow; v?: VenueQuote }) {
  if (!v) return <td className="faint small">not issued</td>;
  const key = `${v.chain}:${v.address}`;
  const isBuy = row.bestBuy === key;
  const isSell = row.bestSell === key;
  const thin = v.warnings.includes("thin liquidity") || v.warnings.includes("no USD pool");
  return (
    <td className={thin ? "opacity-45" : ""}>
      <div className="num">{usd(v.pricePerShare)}</div>
      <div className={`num small ${bpsClass(v.premiumBps)}`}>
        {bpsLabel(v.premiumBps)}
        {isBuy && <span className="ml-1.5 chip !h-[18px] !px-1.5 !text-[10px] !border-pos/40 pos">BEST BUY</span>}
        {isSell && <span className="ml-1.5 chip !h-[18px] !px-1.5 !text-[10px] !border-warn/40 warn">BEST SELL</span>}
      </div>
    </td>
  );
}

export function TapeTable({ initial }: { initial: Tape }) {
  const { data: tape, isFetching } = useTape(initial);
  if (!tape) return null;
  return (
    <div className="panel overflow-x-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="text-sm">
          <span className="font-medium">Price per underlying share</span>
          <span className="muted"> · how far each sits from the real price, in basis points</span>
        </div>
        <div className="small muted flex items-center gap-2">
          <span className={`chain-dot ${isFetching ? "bg-warn" : "bg-pos"}`} />
          live · <span suppressHydrationWarning>{new Date(tape.asOf * 1000).toLocaleTimeString()}</span>
        </div>
      </div>
      <table className="table min-w-[860px]">
        <thead>
          <tr>
            <th>Stock</th>
            <th>Reference</th>
            {ISSUERS.map((i) => (
              <th key={i.issuer}>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`chain-dot ${i.chainClass}`} />
                  {i.issuer}
                </span>
                <div className="normal-case tracking-normal text-[10.5px] faint">{i.chain}</div>
              </th>
            ))}
            <th>Spread</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tape.rows.map((row) => (
            <tr key={row.ticker}>
              <td>
                <Link href={`/s/${row.ticker}`} className="block">
                  <div className="font-semibold">{row.ticker}</div>
                  <div className="small muted truncate max-w-[150px]">{row.name}</div>
                </Link>
              </td>
              <td>
                <div className="num">{usd(row.reference.price)}</div>
                {row.reference.halted && <div className="small warn">halted</div>}
              </td>
              {ISSUERS.map((i) => (
                <VenueCell key={i.issuer} row={row} v={row.venues.find((v) => v.issuer === i.issuer)} />
              ))}
              <td className="num">{row.spreadBps != null ? `${row.spreadBps.toFixed(1)} bp` : "n/a"}</td>
              <td>
                <Link href={`/s/${row.ticker}`} className="btn !h-8 !px-3 text-[13px]">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TapeStrip({ initial }: { initial: Tape }) {
  const { data: tape } = useTape(initial);
  if (!tape) return null;
  const items = tape.rows.map((r) => {
    const best = r.venues.find((v) => `${v.chain}:${v.address}` === r.bestBuy);
    return (
      <span key={r.ticker} className="inline-flex items-center gap-2 text-sm">
        <span className="font-semibold">{r.ticker}</span>
        <span className="num muted">{usd(r.reference.price)}</span>
        {r.spreadBps != null && <span className="num small warn">{r.spreadBps.toFixed(0)}bp spread</span>}
        {best && <span className="small faint">best on {best.issuer}</span>}
      </span>
    );
  });
  return (
    <div className="ticker-tape border-y border-line py-2.5">
      <div className="ticker-tape-inner">
        {items}
        {items.map((el) => ({ ...el, key: `${el.key}-dup` }))}
      </div>
    </div>
  );
}
