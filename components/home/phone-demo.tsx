"use client";

import { useEffect, useState } from "react";
import { useTape } from "../use-tape";
import { CHAIN_LABEL } from "@/lib/registry";
import { amount as fmtAmount } from "@/lib/format";
import { BrandMark } from "../brand";

const INVOICE = 250;
const SCENE_MS = 2800;

/** A self-playing phone screen that walks through paying an invoice with a stock, priced from the live tape. */
export function PhoneDemo() {
  const { data: tape } = useTape();
  const [scene, setScene] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setScene((s) => (s + 1) % 4), SCENE_MS);
    return () => clearInterval(t);
  }, []);

  const row = tape?.rows.find((r) => r.ticker === "NVDA");
  const venues = (row?.venues ?? []).filter((v) => v.priceToken && !v.warnings.length).slice(0, 3);
  const best = venues.find((v) => `${v.chain}:${v.address}` === row?.bestSell) ?? venues[0];
  const tokens = best?.priceToken ? INVOICE / best.priceToken : null;

  return (
    <div className="phone mx-auto" role="img" aria-label="Animated demo: paying a $250 invoice with NVIDIA stock tokens">
      <div className="phone-screen">
        <div className="phone-notch" />

        {/* 1. the request */}
        <div className={`scene ${scene === 0 ? "on" : ""}`}>
          <div className="flex items-center gap-2 small muted"><BrandMark size={14} /> fairtape.vercel.app/pay</div>
          <div className="small faint mt-6">Payment request · example</div>
          <div className="font-medium mt-1">Maya Okafor Design</div>
          <div className="small muted">Logo design, invoice #014</div>
          <div className="num text-[44px] leading-none mt-6 tracking-tight">${INVOICE}.00</div>
          <div className="small muted mt-2 flex items-center gap-1.5"><span className="chain-dot chain-base" /> USDC on Base</div>
          <div className="btn btn-primary w-full mt-10 relative">
            Pay with anything
            {scene === 0 && <span className="tap" style={{ left: "45%", top: 2 }} />}
          </div>
        </div>

        {/* 2. choose a stock */}
        <div className={`scene ${scene === 1 ? "on" : ""}`}>
          <div className="small muted">Pay with</div>
          <div className="mt-3 grid gap-2">
            {venues.map((v) => {
              const isBest = v === best;
              return (
                <div key={v.address} className={`rounded-2xl border px-3 py-3 flex items-center justify-between relative ${isBest ? "border-pos/50 bg-pos/5" : "border-line"}`}>
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className={`chain-dot chain-${v.chain}`} />
                    {v.symbol}
                  </span>
                  <span className="text-right">
                    <span className="num text-[13px] block">{fmtAmount(INVOICE / v.priceToken!, 4)}</span>
                    <span className="text-[10px] faint">{CHAIN_LABEL[v.chain]}</span>
                  </span>
                  {isBest && scene === 1 && <span className="tap" style={{ left: "40%", top: 6 }} />}
                </div>
              );
            })}
          </div>
          <div className="small pos mt-4">Best print selected automatically</div>
        </div>

        {/* 3. one signature */}
        <div className={`scene ${scene === 2 ? "on" : ""}`}>
          <div className="small muted">Review</div>
          <div className="rounded-2xl border border-line p-4 mt-3">
            <div className="small faint">You sell</div>
            <div className="num text-xl mt-0.5">{tokens ? fmtAmount(tokens, 4) : "n/a"} {best?.symbol}</div>
            <div className="my-3 h-px bg-line" />
            <div className="small faint">Maya receives exactly</div>
            <div className="num text-xl mt-0.5 pos">{INVOICE}.00 USDC</div>
          </div>
          <div className="mt-6 flex items-center gap-3 small muted">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-pos border-t-transparent animate-spin" />
            Confirm in your wallet…
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-pos rounded-full" style={{ width: scene === 2 ? "100%" : "0%", transition: `width ${SCENE_MS - 300}ms linear` }} />
          </div>
        </div>

        {/* 4. paid */}
        <div className={`scene ${scene === 3 ? "on" : ""} text-center`}>
          <div className="mt-16 mx-auto w-20 h-20 rounded-full bg-pos/15 grid place-items-center">
            {scene === 3 && <span className="check-pop pos text-4xl">✓</span>}
          </div>
          <div className="display text-[34px] mt-6">Paid</div>
          <div className="small muted mt-2">Verified onchain on Base</div>
          <div className="num pos mt-6 text-lg">+{INVOICE}.00 USDC</div>
          <div className="small faint mt-1">paid with {best?.symbol ?? "a stock"}</div>
        </div>
      </div>
    </div>
  );
}
