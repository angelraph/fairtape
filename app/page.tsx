import Link from "next/link";
import { getTape } from "@/lib/server/tape";
import { TapeTable, TapeStrip } from "@/components/tape-table";
import { HeroSwap } from "@/components/home/hero-swap";
import { Faq } from "@/components/home/faq";
import { Roadmap } from "@/components/home/roadmap";
import { Reveal, RollingNumber } from "@/components/motion";
import { BrandMark } from "@/components/brand";
import { assets, CHAIN_LABEL } from "@/lib/registry";
import { usd, compactUsd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tape = await getTape();
  const venueCount = assets.reduce((n, a) => n + a.venues.length, 0);
  const widest = [...tape.rows].filter((r) => r.spreadBps != null).sort((a, b) => b.spreadBps! - a.spreadBps!)[0];
  const liquidity = tape.rows.flatMap((r) => r.venues).reduce((n, v) => n + (v.liquidityUsd ?? 0), 0);
  const nvda = tape.rows.find((r) => r.ticker === "NVDA") ?? tape.rows[0];

  // A live example of why raw token prices mislead: the venue whose multiplier moves price the most.
  const example = tape.rows
    .flatMap((r) => r.venues.map((v) => ({ r, v })))
    .filter(({ v }) => v.multiplier && v.priceToken && v.pricePerShare && !v.warnings.length)
    .sort((a, b) => b.v.multiplier! - a.v.multiplier!)[0];

  return (
    <div className="overflow-x-clip">
      {/* ---------- HERO ---------- */}
      <section className="relative">
        <div className="aurora" aria-hidden />
        <div className="grid-bg" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div>
            <div className="chip mb-6 rise">
              <span className={`chain-dot pulse-dot ${tape.session === "closed" ? "bg-warn text-warn" : "bg-pos text-pos"}`} />
              {tape.sessionLabel} · live tape
            </div>
            <h1 className="display text-[56px] sm:text-[84px] rise" style={{ ["--d" as string]: "80ms" }}>
              Pay anyone.
              <br />
              <em className="grad-text pr-2">In public markets.</em>
            </h1>
            <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed rise" style={{ ["--d" as string]: "160ms" }}>
              The same share now trades as four different tokens on three chains. Fairtape prices every one per real share, routes
              you to the best print, and lets your clients settle a USDC invoice with the stocks they already hold.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 rise" style={{ ["--d" as string]: "240ms" }}>
              <Link href="/pay/new" className="btn btn-primary btn-lg">Get paid in any stock</Link>
              <Link href="/trade" className="btn btn-ghost btn-lg">Find the best print →</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 small muted rise" style={{ ["--d" as string]: "320ms" }}>
              <span className="flex items-center gap-2"><span className="pos">✓</span> Non-custodial</span>
              <span className="flex items-center gap-2"><span className="pos">✓</span> Settlement verified onchain</span>
              <span className="flex items-center gap-2"><span className="pos">✓</span> Try it free on testnet</span>
            </div>
          </div>
          <HeroSwap initial={tape} />
        </div>
      </section>

      <TapeStrip initial={tape} />

      {/* ---------- LIVE NUMBERS ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Venues on the tape" value={String(venueCount)} sub="4 issuers · 3 chains" delay={0} />
          <Stat label="Liquidity tracked" value={compactUsd(liquidity)} sub="across every venue, live" delay={80} />
          <Stat
            label="Widest spread now"
            value={widest ? `${widest.spreadBps!.toFixed(0)} bp` : "—"}
            sub={widest ? `${widest.ticker}, same share across issuers` : ""}
            delay={160}
            accent
          />
          <Stat label="Custody" value="0" sub="funds held by Fairtape, ever" delay={240} />
        </div>
      </section>

      {/* ---------- TAPE ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <Reveal className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div>
            <div className="eyebrow">The consolidated tape</div>
            <h2 className="display text-[44px] sm:text-[56px] mt-2">One share. Every chain.</h2>
          </div>
          <p className="muted max-w-md">
            Every issuer of the same stock on one screen, normalized to one real share and compared to the underlying share price.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <TapeTable initial={tape} />
        </Reveal>
      </section>

      {/* ---------- PRODUCT CARDS (Uniswap-style tints) ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <Reveal>
          <div className="eyebrow">What you can do</div>
          <h2 className="display text-[44px] sm:text-[56px] mt-2 max-w-3xl">Built for every way you hold a stock.</h2>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-4 mt-10">
          <Reveal>
            <Link href="/trade" className="tint tint-green p-7 block h-full">
              <div className="pos font-medium">Best print →</div>
              <p className="text-2xl mt-2 leading-snug max-w-sm">Start from anything you hold. Land on the venue that gives you the most real shares.</p>
              <div className="mt-6 grid gap-2">
                {nvda.venues.slice(0, 3).map((v) => (
                  <div key={`${v.chain}${v.address}`} className="flex items-center justify-between rounded-2xl bg-bg-2/80 border border-line px-4 py-3">
                    <span className="flex items-center gap-2.5 text-sm">
                      <span className={`chain-dot chain-${v.chain}`} />
                      {v.symbol} <span className="faint">· {CHAIN_LABEL[v.chain]}</span>
                    </span>
                    <span className="num text-sm">
                      {usd(v.pricePerShare)}
                      {`${v.chain}:${v.address}` === nvda.bestBuy && <span className="pos ml-2">best</span>}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <Link href="/pay/new" className="tint tint-blue p-7 block h-full">
              <div className="text-[#7aa7ff] font-medium">Pay links →</div>
              <p className="text-2xl mt-2 leading-snug max-w-sm">Ask for exact USDC. Let them pay with NVDAx, TSLA, NVDAc or anything else.</p>
              <div className="mt-6 rounded-2xl bg-bg-2/80 border border-line p-5 max-w-sm">
                <div className="small muted">Payment request · example</div>
                <div className="font-medium mt-1">Logo design, invoice #014</div>
                <div className="num text-3xl mt-3">$250.00</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="chip !border-pos/40 pos">✓ Paid, verified onchain</span>
                  <span className="small faint">paid with NVDAx</span>
                </div>
              </div>
            </Link>
          </Reveal>
          <Reveal delay={60}>
            <Link href={`/s/${nvda.ticker}`} className="tint tint-lime p-7 block h-full">
              <div className="text-[#d9ff4d] font-medium">Per-share truth →</div>
              <p className="text-2xl mt-2 leading-snug max-w-sm">Every issuer reinvests dividends differently. Fairtape divides each multiplier out, live.</p>
              {example && (
                <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm">
                  <div className="rounded-2xl bg-bg-2/80 border border-line p-4">
                    <div className="small faint">{example.v.symbol} token</div>
                    <div className="num text-xl mt-1">{usd(example.v.priceToken)}</div>
                  </div>
                  <div className="rounded-2xl bg-bg-2/80 border border-line p-4">
                    <div className="small faint">per real share</div>
                    <div className="num text-xl mt-1 pos">{usd(example.v.pricePerShare)}</div>
                  </div>
                  <div className="col-span-2 small muted">
                    1 {example.v.symbol} = <span className="num text-text">{example.v.multiplier!.toFixed(6)}</span> shares, a{" "}
                    <span className="num text-text">{((example.v.multiplier! - 1) * 10_000).toFixed(0)} bp</span> trap in raw prices.
                  </div>
                </div>
              )}
            </Link>
          </Reveal>
          <Reveal delay={180}>
            <Link href="/test" className="tint tint-violet p-7 block h-full">
              <div className="text-[#c4a6ff] font-medium">Testnet, $0 →</div>
              <p className="text-2xl mt-2 leading-snug max-w-sm">Try every flow with free faucet tokens. Real transactions, real explorer links.</p>
              <div className="mt-6 flex flex-wrap gap-2 max-w-sm">
                {["Robinhood test stocks", "Synthra best path", "Pay with TSLA", "CCTP Base → Solana"].map((t) => (
                  <span key={t} className="chip !h-8 !px-3 !text-[12.5px] text-text">{t}</span>
                ))}
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ---------- HOW A PAYMENT WORKS (Coinbase-style stack) ---------- */}
      <section className="border-y border-line bg-bg-2/60">
        <div className="mx-auto max-w-6xl px-4 py-24 grid lg:grid-cols-[1fr_1.2fr] gap-14">
          <Reveal>
            <div className="eyebrow">How a payment settles</div>
            <h2 className="display text-[44px] sm:text-[56px] mt-2">One signature. Exact dollars. Proof onchain.</h2>
            <p className="muted mt-5 max-w-md leading-relaxed">
              No account, no custody, no chargebacks. The merchant gets exactly the USDC they asked for, and both sides get a receipt that
              links the source and delivery transactions.
            </p>
          </Reveal>
          <ol className="grid gap-3">
            {[
              ["Create a link", "Name, amount, and the Base or Solana address that should receive USDC."],
              ["They pick what to pay with", "Any stock token, stablecoin or gas token they hold on Solana, Base or Robinhood Chain."],
              ["Sell and bridge in one signature", "Fairtape asks every router for an exact-output route, so the dollars land precisely."],
              ["Verified from chain data", "The server reads the settlement transaction itself before marking the invoice Paid."],
            ].map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 110}>
                <div className="panel p-5 flex gap-5 items-start hover:border-line-2 transition-colors">
                  <span className="num w-9 h-9 rounded-full grid place-items-center flex-none text-sm border border-line-2 grad-text font-semibold">
                    0{i + 1}
                  </span>
                  <div>
                    <div className="font-medium">{t}</div>
                    <div className="small muted mt-1 text-[13.5px] leading-relaxed">{d}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- ROADMAP ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <Reveal className="flex items-end justify-between gap-6 flex-wrap mb-12">
          <div>
            <div className="eyebrow">Roadmap</div>
            <h2 className="display text-[44px] sm:text-[56px] mt-2">Where Fairtape goes next.</h2>
          </div>
          <Link href="/docs#roadmap" className="btn btn-ghost">Full roadmap in the docs →</Link>
        </Reveal>
        <Roadmap />
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
        <Reveal>
          <div className="eyebrow">FAQ</div>
          <h2 className="display text-[44px] sm:text-[56px] mt-2">Questions, answered.</h2>
          <p className="muted mt-4 max-w-sm">
            Everything else lives in the <Link href="/docs" className="underline hover:text-text">documentation</Link>: architecture, contracts,
            API and testnet guide.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <Faq limit={6} />
        </Reveal>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] border border-line p-10 sm:p-16 text-center">
            <div className="aurora !h-full !inset-0" aria-hidden />
            <div className="relative z-10">
              <BrandMark size={56} className="mx-auto" />
              <h2 className="display text-[44px] sm:text-[68px] mt-6">
                Pay anyone. <em className="grad-text">In public markets.</em>
              </h2>
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <Link href="/pay/new" className="btn btn-primary btn-lg">Create a pay link</Link>
                <Link href="/test" className="btn btn-ghost btn-lg">Try it free on testnet</Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
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
