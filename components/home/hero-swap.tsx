"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Tape } from "@/lib/server/tape";
import { useTape } from "../use-tape";
import { CHAIN_LABEL } from "@/lib/registry";
import { amount as fmtAmount, usd } from "@/lib/format";
import { BrandMark } from "../brand";

const INVOICE_USD = 100;

/**
 * The hero: a live "pay with stock" quote. It cycles through every real issuer of the same stock and shows how many tokens
 * settle a $100 invoice on each, priced from the live tape (token price, so each issuer's multiplier is already inside).
 */
export function HeroSwap({ initial, ticker = "NVDA", cta = true }: { initial?: Tape; ticker?: string; cta?: boolean }) {
  const { data: tape } = useTape(initial);
  const row = tape?.rows.find((r) => r.ticker === ticker) ?? tape?.rows[0];
  const venues = useMemo(
    () => (row?.venues ?? []).filter((v) => v.priceToken && v.pricePerShare && !v.warnings.includes("thin liquidity") && !v.warnings.includes("no USD pool")),
    [row],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    if (venues.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % venues.length), 3400);
    return () => clearInterval(t);
  }, [venues.length]);
  if (!row || !venues.length) return <div className="skeleton h-[420px] w-full max-w-[460px] mx-auto !rounded-[28px]" />;
  const v = venues[i % venues.length];
  const tokens = INVOICE_USD / v.priceToken!;
  const best = row.venues.find((x) => `${x.chain}:${x.address}` === row.bestSell);
  const perShare = venues.map((x) => x.pricePerShare!);
  const edgeBps = ((Math.max(...perShare) - Math.min(...perShare)) / Math.min(...perShare)) * 10_000;

  return (
    <div className="relative w-full max-w-[460px] mx-auto">
      {/* orbits: one dot per chain */}
      <div className="absolute inset-0 -z-0 pointer-events-none hidden sm:block" aria-hidden>
        {[
          { size: 620, t: "22s", color: "var(--solana)" },
          { size: 520, t: "16s", color: "var(--base)" },
          { size: 420, t: "12s", color: "var(--robinhood)" },
        ].map((o) => (
          <div key={o.size} className="orbit" style={{ width: o.size, height: o.size }}>
            <div className="orbit-spin" style={{ ["--t" as string]: o.t }}>
              <span className="orbit-dot" style={{ color: o.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card-glass relative z-10 p-2.5 rise" style={{ ["--d" as string]: "250ms" }}>
        <div className="flex items-center justify-between px-3 pt-2 pb-3">
          <span className="text-sm font-medium flex items-center gap-2">
            <BrandMark size={16} /> Pay a ${INVOICE_USD} invoice with {row.ticker}
          </span>
          <span className="chip !h-6">
            <span className="chain-dot bg-pos pulse-dot text-pos" /> live
          </span>
        </div>

        <div className="rounded-[22px] bg-bg-2 border border-line p-4">
          <div className="small muted">You pay</div>
          <div key={`${v.chain}${v.address}`} className="flex items-end justify-between gap-3 mt-1 swap-in">
            <div className="num text-[34px] leading-none tracking-tight">{fmtAmount(tokens, 4)}</div>
            <div className="flex items-center gap-2 rounded-full border border-line-2 bg-panel-2 pl-2 pr-3 h-9 shrink-0">
              <span className={`chain-dot chain-${v.chain}`} />
              <span className="font-medium text-sm">{v.symbol}</span>
            </div>
          </div>
          <div key={`m${v.chain}${v.address}`} className="small faint mt-2 swap-in">
            {v.issuer} on {CHAIN_LABEL[v.chain]} · {usd(v.pricePerShare)} per real share
          </div>
        </div>

        <div className="relative h-2">
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 w-10 h-10 rounded-xl bg-panel-2 border-4 border-[#0c151a] grid place-items-center text-muted">
            ↓
          </div>
        </div>

        <div className="rounded-[22px] bg-panel-2/60 border border-line p-4">
          <div className="small muted">They receive</div>
          <div className="flex items-end justify-between gap-3 mt-1">
            <div className="num text-[34px] leading-none tracking-tight">{INVOICE_USD.toFixed(2)}</div>
            <div className="flex items-center gap-2 rounded-full border border-line-2 bg-panel-2 pl-2 pr-3 h-9">
              <span className="chain-dot chain-base" />
              <span className="font-medium text-sm">USDC</span>
            </div>
          </div>
          <div className="small faint mt-2">Exact amount on Base · verified onchain</div>
        </div>

        {cta && (
          <Link href="/pay/new" className="btn btn-primary btn-lg w-full mt-2.5">
            Create a pay link
          </Link>
        )}

        <div className="flex justify-center gap-1.5 pt-3 pb-1">
          {venues.map((x, n) => (
            <button
              key={`${x.chain}${x.address}`}
              aria-label={`${x.issuer} on ${CHAIN_LABEL[x.chain]}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all duration-500 ${n === i % venues.length ? "w-6 bg-pos" : "w-1.5 bg-line-2"}`}
            />
          ))}
        </div>
      </div>

      {/* Coinbase-style receipt chips */}
      <div className="absolute -left-4 lg:-left-20 -top-9 z-20 float hidden sm:block" style={{ ["--d" as string]: "0s" }}>
        <div className="card-glass !rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl">
          <span className="w-8 h-8 rounded-full grid place-items-center bg-pos/15 pos text-sm">✓</span>
          <div>
            <div className="text-sm font-medium">Invoice paid</div>
            <div className="small muted">verified on Base</div>
          </div>
          <div className="num pos text-sm ml-2">+${INVOICE_USD}.00</div>
        </div>
      </div>
      {best && Number.isFinite(edgeBps) && (
        <div className="absolute -right-4 lg:-right-16 -bottom-12 z-20 float hidden sm:block" style={{ ["--d" as string]: "-3s" }}>
          <div className="card-glass !rounded-2xl px-4 py-3 shadow-2xl">
            <div className="small muted">Best print right now</div>
            <div className="text-sm font-medium flex items-center gap-2 mt-0.5">
              <span className={`chain-dot chain-${best.chain}`} /> {best.symbol} · {best.issuer}
            </div>
            <div className="num small pos mt-0.5">{edgeBps.toFixed(0)} bp across issuers</div>
          </div>
        </div>
      )}
    </div>
  );
}
