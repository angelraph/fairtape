import Link from "next/link";
import { TestWallet } from "@/components/testnet/test-wallet";
import { TestTape } from "@/components/testnet/test-tape";

export const metadata = { title: "Testnet | Fairtape" };

export default function TestnetHome() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 grid gap-10">
      <div>
        <span className="chip !border-warn/40 warn">TESTNET MODE · free faucet tokens · real onchain transactions</span>
        <h1 className="text-3xl font-semibold tracking-tight mt-3">Try every Fairtape flow for $0</h1>
        <p className="muted mt-2 max-w-2xl">
          The <Link href="/tape" className="underline hover:text-text">live tape</Link> shows real mainnet prices. Down here, every trade and payment is a real transaction you sign yourself, on public testnets
          (Robinhood Chain Testnet, Base Sepolia and Solana Devnet), using free faucet tokens. You get an explorer link for each one.
        </p>
        <div className="flex gap-3 mt-5 flex-wrap">
          <Link href="/test/trade" className="btn btn-primary btn-lg">Trade test stocks</Link>
          <Link href="/pay/new?net=test" className="btn btn-lg">Create a test pay link</Link>
        </div>
      </div>
      <TestWallet />
      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-1">Testnet tape</h2>
        <p className="muted small mb-4">The same split-up market as mainnet, so you can see it for yourself with free tokens.</p>
        <TestTape />
      </section>
    </div>
  );
}
