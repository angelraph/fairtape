import { CreateInvoice } from "@/components/create-invoice";
import { HeroSwap } from "@/components/home/hero-swap";

export const metadata = { title: "New pay link — Fairtape" };

export default async function NewPayLink({ searchParams }: PageProps<"/pay/new">) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 grid lg:grid-cols-[1fr_440px] gap-12 items-start">
      <div>
        <h1 className="display text-[44px] sm:text-[64px] rise">Get paid in dollars. <em className="grad-text">Let them pay in anything.</em></h1>
        <p className="muted mt-4 max-w-lg rise" style={{ ["--d" as string]: "100ms" }}>
          Live right now: how many NVIDIA tokens settle a $100 invoice on each issuer.
        </p>
        <div className="mt-10 hidden sm:block">
          <HeroSwap cta={false} />
        </div>
      </div>
      <div className="rise" style={{ ["--d" as string]: "150ms" }}>
        <CreateInvoice initialNetwork={sp.net === "test" ? "testnet" : "mainnet"} />
      </div>
    </div>
  );
}
