import Link from "next/link";
import { getTape } from "@/lib/server/tape";
import { TapeTable, TapeStrip } from "@/components/tape-table";
import { Reveal, RollingNumber } from "@/components/motion";
import { assets } from "@/lib/registry";
import { usd, compactUsd } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live tape — Fairtape" };

export default async function TapePage() {
  const tape = await getTape();
  const venueCount = assets.reduce((n, a) => n + a.venues.length, 0);
  const widest = [...tape.rows].filter((r) => r.spreadBps != null).sort((a, b) => b.spreadBps! - a.spreadBps!)[0];
  const liquidity = tape.rows.flatMap((r) => r.venues).reduce((n, v) => n + (v.liquidityUsd ?? 0), 0);
  // A live example of why raw token prices mislead: the venue whose multiplier moves price the most.
  const example = tape.rows
    .flatMap((r) => r.venues.map((v) => ({ r, v })))
    .filter(({ v }) => v.multiplier && v.priceToken && v.pricePerShare && !v.warnings.length)
    .sort((a, b) => b.v.multiplier! - a.v.multiplier!)[0];

  return (
    <div className="overflow-x-clip">
      <section className="relative">
        <div className="aurora" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-10">
          <div className="chip rise">
            <span className={`chain-dot pulse-dot ${tape.session === "closed" ? "bg-warn text-warn" : "bg-pos text-pos"}`} />
            {tape.sessionLabel} · refreshes every 15s
          </div>
          <h1 className="display text-[52px] sm:text-[80px] mt-5 rise" style={{ ["--d" as string]: "80ms" }}>
            One share. <em className="grad-text">Every chain.</em>
          </h1>
          <p className="muted text-lg mt-4 max-w-2xl rise" style={{ ["--d" as string]: "160ms" }}>
            Every issuer of the same stock on one screen, normalized to one real share and compared with the underlying share price.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
            <Stat label="Venues on the tape" value={String(venueCount)} sub="4 issuers · 3 chains" delay={0} />
            <Stat label="Liquidity tracked" value={compactUsd(liquidity)} sub="across every venue, live" delay={80} />
            <Stat
              label="Widest spread now"
              value={widest ? `${widest.spreadBps!.toFixed(0)} bp` : "—"}
              sub={widest ? `${widest.ticker}, same share across issuers` : ""}
              delay={160}
              accent
            />
            <Stat label="Stocks tracked" value={String(tape.rows.length)} sub="verified issuers only" delay={240} />
          </div>
        </div>
      </section>

      <TapeStrip initial={tape} />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <TapeTable initial={tape} />
        <p className="small faint mt-3">Tap any stock for its venues, oracle health and premium history.</p>
      </section>

      {example && (
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <Reveal>
            <div className="tint tint-lime p-8 grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
              <div>
                <div className="text-[#d9ff4d] font-medium">Why per share?</div>
                <p className="text-xl mt-2 leading-snug">
                  Issuers reinvest dividends by changing how many shares one token represents. Right now 1 {example.v.symbol} ={" "}
                  <span className="num">{example.v.multiplier!.toFixed(6)}</span> shares of {example.r.ticker}, a{" "}
                  <span className="num">{((example.v.multiplier! - 1) * 10_000).toFixed(0)} bp</span> trap in raw prices.
                </p>
                <Link href="/docs#per-share" className="btn btn-ghost mt-6">How Fairtape normalizes →</Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-bg-2/80 border border-line p-5">
                  <div className="small faint">Token price</div>
                  <div className="num text-2xl mt-1">{usd(example.v.priceToken)}</div>
                  <div className="small faint mt-1">what a DEX shows</div>
                </div>
                <div className="rounded-2xl bg-bg-2/80 border border-line p-5">
                  <div className="small faint">Per real share</div>
                  <div className="num text-2xl mt-1 pos">{usd(example.v.pricePerShare)}</div>
                  <div className="small faint mt-1">what Fairtape compares</div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, delay, accent }: { label: string; value: string; sub: string; delay: number; accent?: boolean }) {
  return (
    <Reveal delay={delay}>
      <div className={`panel p-6 h-full ${accent ? "tint-green" : ""}`}>
        <div className="small muted">{label}</div>
        <div className={`num text-[40px] leading-none mt-4 tracking-tight ${accent ? "pos" : ""}`}>
          <RollingNumber value={value} />
        </div>
        <div className="small faint mt-3">{sub}</div>
      </div>
    </Reveal>
  );
}
