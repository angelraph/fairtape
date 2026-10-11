import Link from "next/link";
import { CineHero } from "@/components/home/cine-hero";
import { PhoneDemo } from "@/components/home/phone-demo";
import { Reveal } from "@/components/motion";

// The landing page stays light: a cinematic hero, one demo, and a door to every part of the product.
const DOORS = [
  { href: "/tape", tint: "tint-green", color: "pos", title: "Live tape", body: "One share, four issuers, three chains, priced per real share." },
  { href: "/trade", tint: "tint-lime", color: "text-[#d9ff4d]", title: "Best print", body: "Start from anything you hold. Land on the venue that gives you the most." },
  { href: "/pay", tint: "tint-blue", color: "text-[#7aa7ff]", title: "Pay links", body: "Ask for exact USDC. Let them pay with the stocks they hold." },
  { href: "/test", tint: "tint-violet", color: "text-[#c4a6ff]", title: "Testnet (free)", body: "Every flow with free faucet tokens. Real transactions." },
  { href: "/roadmap", tint: "tint-green", color: "pos", title: "Roadmap", body: "What shipped for the World's Fair, and what comes next." },
  { href: "/docs", tint: "tint-blue", color: "text-[#7aa7ff]", title: "Docs & FAQ", body: "How it works, contracts, API and answers." },
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <CineHero>
        <div className="mx-auto max-w-4xl px-5 text-center">
          <div className="chip mx-auto rise">
            <span className="chain-dot chain-solana" />
            <span className="chain-dot chain-base -ml-1" />
            <span className="chain-dot chain-robinhood -ml-1" />
            Solana · Base · Robinhood Chain
          </div>
          <h1 className="display text-[58px] sm:text-[104px] mt-7 rise" style={{ ["--d" as string]: "120ms" }}>
            Pay anyone.
            <br />
            <em className="grad-text pr-3">In public markets.</em>
          </h1>
          <p className="mt-7 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed rise" style={{ ["--d" as string]: "240ms" }}>
            Fairtape turns the stocks you hold onchain into exact dollars for anyone, at the best price across every issuer.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center rise" style={{ ["--d" as string]: "360ms" }}>
            <Link href="/pay/new" className="btn btn-primary btn-lg">Get started</Link>
            <Link href="/tape" className="btn btn-ghost btn-lg">See the live tape</Link>
          </div>
          <div className="mt-16 flex justify-center rise" style={{ ["--d" as string]: "600ms" }}>
            <span className="scroll-cue" aria-hidden />
          </div>
        </div>
      </CineHero>

      <section className="mx-auto max-w-6xl px-5 py-24 sm:py-32 grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <div className="eyebrow">Pay links</div>
          <h2 className="display text-[46px] sm:text-[68px] mt-3">One signature. Exact dollars.</h2>
          <p className="muted text-lg mt-6 max-w-md leading-relaxed">
            Your client pays with NVDAx, TSLA or any stock token they hold. You receive exactly the USDC you asked for, verified onchain.
          </p>
          <Link href="/pay" className="btn btn-ghost btn-lg mt-9">How it works →</Link>
        </Reveal>
        <Reveal delay={150}>
          <PhoneDemo />
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-28">
        <Reveal>
          <h2 className="display text-[40px] sm:text-[56px]">Explore Fairtape</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {DOORS.map((d, i) => (
            <Reveal key={d.href} delay={(i % 3) * 90}>
              <Link href={d.href} className={`tint ${d.tint} p-7 flex flex-col justify-between min-h-[190px] h-full`}>
                <div className={`font-medium ${d.color}`}>{d.title}</div>
                <div>
                  <p className="text-lg leading-snug">{d.body}</p>
                  <div className="mt-5 small muted flex items-center gap-2">Open <span aria-hidden>→</span></div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
