import { TestTrade } from "@/components/testnet/test-trade";
import { TEST_STOCKS } from "@/lib/testnet";

export const metadata = { title: "Testnet best print | Fairtape" };

export default async function TestTradePage({ searchParams }: PageProps<"/test/trade">) {
  const sp = await searchParams;
  const t = typeof sp.t === "string" ? sp.t.toUpperCase() : "TSLA";
  const ticker = TEST_STOCKS.some((s) => s.ticker === t) ? t : "TSLA";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <span className="chip !border-warn/40 warn">TESTNET · Robinhood Chain Testnet · free faucet tokens</span>
      <h1 className="text-3xl font-semibold tracking-tight mt-3">Best print (testnet)</h1>
      <p className="muted mt-2 mb-8 max-w-2xl">
        Swap the official Robinhood test stock tokens. Fairtape quotes every pool and path onchain, then executes the one that gives you the
        most, signed in your own wallet.
      </p>
      <TestTrade initialTicker={ticker} />
    </div>
  );
}
