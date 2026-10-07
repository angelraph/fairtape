import Link from "next/link";
import { MyInvoices } from "@/components/my-invoices";
import { PhoneDemo } from "@/components/home/phone-demo";
import { Reveal } from "@/components/motion";

export const metadata = { title: "Pay links | Fairtape" };

const STEPS: [string, string][] = [
  ["Create a link", "Name, amount, and the Base or Solana address that should receive USDC."],
  ["They pick what to pay with", "Any stock token, stablecoin or gas token they hold on Solana, Base or Robinhood Chain."],
  ["Sell and bridge in one signature", "Fairtape asks every router for an exact-output route, so the dollars land precisely."],
  ["Verified from chain data", "The server reads the settlement transaction itself before marking the invoice Paid."],
];

export default function PayHome() {
  return (
    <div className="overflow-x-clip">
      <section className="relative">
        <div className="aurora" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div>
            <div className="eyebrow rise">Pay links</div>
            <h1 className="display text-[52px] sm:text-[80px] mt-3 rise" style={{ ["--d" as string]: "80ms" }}>
              Get paid in dollars. <em className="grad-text">Let them pay in anything.</em>
            </h1>
            <p className="muted text-lg mt-5 max-w-lg rise" style={{ ["--d" as string]: "160ms" }}>
              Request exact USDC on Base or Solana. Your client settles with any stock, stablecoin or gas token on any of the three chains.
              No account, no custody, no chargebacks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 rise" style={{ ["--d" as string]: "240ms" }}>
              <Link href="/pay/new" className="btn btn-primary btn-lg">New pay link</Link>
              <Link href="/pay/new?net=test" className="btn btn-ghost btn-lg">Try one free on testnet</Link>
            </div>
          </div>
          <div className="rise" style={{ ["--d" as string]: "200ms" }}>
            <PhoneDemo />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-bg-2/60">
        <ol className="mx-auto max-w-6xl px-4 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STEPS.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 100}>
              <div className="panel p-5 h-full">
                <span className="num grad-text font-semibold">0{i + 1}</span>
                <div className="font-medium mt-3">{t}</div>
                <div className="small muted mt-1.5 text-[13px] leading-relaxed">{d}</div>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="display text-[36px] sm:text-[48px] mb-6">Your pay links</h2>
        <MyInvoices />
      </section>
    </div>
  );
}
