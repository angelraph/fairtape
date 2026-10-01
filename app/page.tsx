import Link from "next/link";
import { getTape } from "@/lib/server/tape";
import { TapeTable, TapeStrip } from "@/components/tape-table";
import { assets } from "@/lib/registry";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tape = await getTape();
  const venueCount = assets.reduce((n, a) => n + a.venues.length, 0);
  const widest = [...tape.rows].filter((r) => r.spreadBps != null).sort((a, b) => b.spreadBps! - a.spreadBps!)[0];

  // A live example of why raw token prices mislead: the venue whose multiplier moves price the most.
  const example = tape.rows
    .flatMap((r) => r.venues.map((v) => ({ r, v })))
    .filter(({ v }) => v.multiplier && v.priceToken && v.pricePerShare && !v.warnings.length)
    .sort((a, b) => b.v.multiplier! - a.v.multiplier!)[0];

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-8">
        <div className="chip mb-5">
          <span className={`chain-dot ${tape.session === "closed" ? "bg-warn" : "bg-pos"}`} />
          {tape.sessionLabel}
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight max-w-3xl leading-[1.05]">
          One stock. Four issuers. Three chains.
          <span className="text-muted"> One fair price.</span>
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl">
          NVIDIA now trades onchain as NVDAx and NVDAon on Solana, NVDA on Robinhood Chain and NVDAc on Base — each with its own
          price and its own dividend multiplier. Fairtape puts them on one tape, per real share, and routes you to the best print.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/trade" className="btn btn-primary btn-lg">Get the best print</Link>
          <Link href="/pay/new" className="btn btn-lg">Get paid in any stock</Link>
        </div>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Venues on the tape" value={String(venueCount)} sub="4 issuers · 3 chains" />
          <Stat
            label="Widest spread now"
            value={widest ? `${widest.spreadBps!.toFixed(0)} bp` : "—"}
            sub={widest ? `${widest.ticker} across issuers` : ""}
          />
          <Stat label="Stocks tracked" value={String(tape.rows.length)} sub="verified issuers only" />
          <Stat label="Custody" value="None" sub="you sign every transaction" />
        </div>
      </section>

      <TapeStrip initial={tape} />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <TapeTable initial={tape} />
      </section>

      {example && (
        <section className="mx-auto max-w-6xl px-4 pb-6">
          <div className="panel p-6 grid md:grid-cols-[1.2fr_1fr] gap-6 items-center">
            <div>
              <h2 className="text-xl font-semibold">Why per share?</h2>
              <p className="muted mt-2">
                Issuers reinvest dividends by changing how many shares one token represents. Right now one{" "}
                <span className="text-text font-medium">{example.v.symbol}</span> ({example.v.issuer}) equals{" "}
                <span className="num text-text">{example.v.multiplier!.toFixed(6)}</span> shares of {example.r.ticker}. Compare raw token
                prices and you are off by{" "}
                <span className="num text-text">{((example.v.multiplier! - 1) * 10_000).toFixed(0)} bp</span> before a single trade — more
                than the spread you are trying to capture.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="panel !bg-bg p-4">
                <div className="label">Token price</div>
                <div className="num text-2xl">{usd(example.v.priceToken)}</div>
                <div className="small faint">what a DEX shows</div>
              </div>
              <div className="panel !bg-bg p-4">
                <div className="label">Per real share</div>
                <div className="num text-2xl pos">{usd(example.v.pricePerShare)}</div>
                <div className="small faint">what Fairtape compares</div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className="num text-2xl">{value}</div>
      <div className="small faint mt-0.5">{sub}</div>
    </div>
  );
}
