import Link from "next/link";
import type { ReactNode } from "react";
import { Faq } from "@/components/home/faq";
import { Roadmap } from "@/components/home/roadmap";
import { assets, CHAIN_LABEL } from "@/lib/registry";
import { TEST_STOCKS, SYNTHRA, RH_TEST_USDC, TEST_STABLES, FAUCETS } from "@/lib/testnet";

export const metadata = { title: "Docs | Fairtape" };

const SECTIONS = [
  ["overview", "Overview"],
  ["quickstart", "Quickstart"],
  ["per-share", "Per-share pricing"],
  ["routing", "Best-print routing"],
  ["pay-links", "Pay links"],
  ["testnet", "Testnet mode"],
  ["contracts", "Contracts & sources"],
  ["api", "API"],
  ["security", "Security & limits"],
  ["business", "Business model"],
  ["roadmap", "Roadmap"],
  ["faq", "FAQ"],
] as const;

const API: [string, string, string][] = [
  ["GET", "/api/tape", "The live tape: every venue for every stock, priced per real share, with how far each sits from the real price and where to buy or sell."],
  ["GET", "/api/history/{ticker}?hours=72", "Price history for each venue, recorded every few minutes (up to 30 days back)."],
  ["POST", "/api/routes", "Real routes from one asset to every venue of a stock, best first."],
  ["GET", "/api/status?txHash&fromChain&toChain", "Whether a cross-chain transaction has arrived yet."],
  ["GET", "/api/balances?evm&solana", "What a wallet holds on Solana, Base and Robinhood Chain, counted in real shares."],
  ["POST", "/api/invoices", "Create a pay link: { network, merchantName, memo, amountUsd, settleChain, recipient }."],
  ["GET", "/api/invoices/{id}", "A pay link, with its status checked against the chain again."],
  ["POST", "/api/invoices/{id}/quote", "How much of any asset it takes to pay a link: { fromChain, fromToken, fromAddress }."],
  ["POST", "/api/invoices/{id}", "Tell us about a signed payment, and the server checks it onchain."],
  ["GET", "/api/testnet/tape", "Synthra pool prices for each Robinhood test stock, in every fee tier."],
  ["POST", "/api/testnet/quote", "Prices every Synthra path. Add a recipient and you get the transaction to sign."],
  ["GET", "/api/testnet/balances?evm&solana", "Test balances on Robinhood Chain Testnet, Base Sepolia and Solana Devnet."],
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 py-12 border-b border-line last:border-0">
      <div className="eyebrow mb-3">{eyebrow}</div>
      <div className="prose-ft">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function Docs() {
  const venueCount = assets.reduce((n, a) => n + a.venues.length, 0);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 grid lg:grid-cols-[220px_1fr] gap-12">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 grid gap-0.5 text-sm">
          <div className="small faint uppercase tracking-[0.16em] mb-3">Documentation</div>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="nav-link !rounded-lg">{label}</a>
          ))}
        </nav>
      </aside>

      <article className="min-w-0">
        <header className="pb-10 border-b border-line">
          <div className="chip">Docs · v0.2 · October 2026</div>
          <h1 className="display text-[56px] sm:text-[72px] mt-5">Fairtape documentation</h1>
          <p className="muted text-lg mt-4 max-w-2xl">
            Everything about how Fairtape works: the tape, best print and pay links, the contracts behind them, and where we&apos;re
            heading next.
          </p>
        </header>

        <Section id="overview" eyebrow="Start here" title="Overview">
          <p>
            Tokenized stocks are splitting apart. The same NVIDIA share trades as <strong>NVDAx</strong> and <strong>NVDAon</strong> on
            Solana, <strong>NVDA</strong> on Robinhood Chain and <strong>NVDAc</strong> on Base. Each has its own price, its own liquidity and its own
            way of handling dividends. Fairtape puts them back together as one market:
          </p>
          <ul>
            <li><strong>Tape:</strong> {venueCount} venues across {assets.length} stocks, each priced per real share and compared with the actual share price.</li>
            <li><strong>Best print:</strong> start from anything you hold, on any chain, and take the route that gets you the most shares or dollars.</li>
            <li><strong>Pay links:</strong> ask for an exact amount of USDC on Base or Solana, and let people pay with whatever stock they hold.</li>
          </ul>
        </Section>

        <Section id="quickstart" eyebrow="5 minutes" title="Quickstart">
          <h3>Use it</h3>
          <ul>
            <li>Have a look at the <Link href="/tape">live tape</Link>. You don&apos;t need a wallet for that.</li>
            <li>Connect Phantom for Solana and MetaMask or Coinbase Wallet for Base and Robinhood Chain.</li>
            <li>Open <Link href="/trade">Trade</Link> to compare every venue, or <Link href="/pay/new">make a pay link</Link>.</li>
            <li>No money to spare? <Link href="/test">Testnet mode</Link> runs on free faucet tokens.</li>
          </ul>
          <h3>Run it locally</h3>
          <p>
            <code>npm install</code> then <code>npm run dev</code>. You don&apos;t need any keys. In production, set <code>DATABASE_URL</code> to a
            Postgres database. Locally, the app makes a small embedded one in <code>.data/</code>.
          </p>
        </Section>

        <Section id="per-share" eyebrow="The insight" title="Per-share pricing">
          <p>Issuers pay dividends by quietly changing how many shares one token stands for. Fairtape reads that live number for every venue and takes it out before comparing prices:</p>
          <ul>
            <li><strong>xStocks and Ondo (Solana):</strong> Token-2022 <code>scaledUiAmountConfig</code>, including a scheduled <code>newMultiplier</code> once its start time has passed.</li>
            <li><strong>Robinhood (Robinhood Chain):</strong> ERC-8056 <code>uiMultiplier()</code>; we also respect <code>oraclePaused()</code> during corporate actions like splits.</li>
            <li><strong>Coinbase (Base):</strong> B20 <code>uiMultiplier()</code>.</li>
          </ul>
          <p>
            We then compare each venue with the real share&apos;s bid and ask from Robinhood&apos;s market data, and double-check it against
            Chainlink on Robinhood Chain and Base. Thin pools still show up, but we never call them the best price.
          </p>
        </Section>

        <Section id="routing" eyebrow="Execution" title="Best-print routing">
          <p>
            When you buy, Fairtape asks for a route from what you hold to <em>every</em> venue for that stock. When you sell, it looks for
            the best way into USDC or USDG on each chain. The routes come from LI.FI, which pulls in Jupiter, 1inch, Kyberswap, Across,
            Relay, Circle CCTP and Mayan, and we rank them by what you actually get per real share after fees and bridges. Just before you
            sign, we price your chosen route one more time, and we only ever ask you to approve the exact amount.
          </p>
        </Section>

        <Section id="pay-links" eyebrow="Checkout" title="Pay links">
          <ul>
            <li>You pick an amount and the Base or Solana address where you want the USDC. No sign-up needed.</li>
            <li>Whoever pays picks anything they hold, and Fairtape finds an <strong>exact-output</strong> route so you get precisely what you asked for.</li>
            <li>Once they sign, our server checks the payment for itself: the USDC <code>Transfer</code> on Base or Robinhood Chain, the balance change on Solana, and for cross-chain payments, the transaction that delivers the money on your chain.</li>
            <li>One transaction can only pay one link, and it has to happen after the link was made. If a payment comes up short or fails, the link simply opens up again.</li>
          </ul>
        </Section>

        <Section id="testnet" eyebrow="$0 to try" title="Testnet mode">
          <p>You can try every part of Fairtape on public testnets with free tokens. Each one is a real transaction:</p>
          <ul>
            <li><strong>Trading:</strong> the official Robinhood test stocks ({TEST_STOCKS.map((s) => s.ticker).join(", ")}) on Synthra V3. We price every fee tier and every two-step path through USDC, WETH or TSLA in a single onchain call.</li>
            <li><strong>Pay with a stock:</strong> one swap on Robinhood Chain Testnet sells the stock and sends exactly the requested test USDC to the merchant.</li>
            <li><strong>Cross-chain:</strong> Base Sepolia to Solana Devnet through Circle CCTP. Circle delivers the USDC on Solana, and we wait until it lands before marking the link paid.</li>
          </ul>
          <h3>Faucets</h3>
          <ul>
            <li><a href={FAUCETS.robinhood} target="_blank" rel="noreferrer">Robinhood Chain faucet</a>: test ETH and test stocks</li>
            <li><a href={FAUCETS.circle} target="_blank" rel="noreferrer">Circle faucet</a>: USDC on Base Sepolia and Solana Devnet</li>
            <li><a href={FAUCETS.baseEth} target="_blank" rel="noreferrer">Base Sepolia ETH</a> · <a href={FAUCETS.solana} target="_blank" rel="noreferrer">Solana devnet SOL</a></li>
          </ul>
          <p>Testnet prices are whatever testers trade them at, not real market prices. What carries over to mainnet is how it all works.</p>
        </Section>

        <Section id="contracts" eyebrow="Verify us" title="Contracts & sources">
          <p>We check every address onchain (its <code>symbol()</code>, <code>decimals()</code> and pool tokens) before it goes into the app. Here are a few:</p>
          <div className="panel overflow-x-auto mt-4 not-prose">
            <table className="table min-w-[640px]">
              <thead>
                <tr><th>Asset</th><th>Issuer</th><th>Chain</th><th>Address</th></tr>
              </thead>
              <tbody>
                {(assets.find((a) => a.ticker === "NVDA")?.venues ?? []).map((v) => (
                  <tr key={v.address}>
                    <td>{v.symbol}</td>
                    <td>{v.issuer}</td>
                    <td>{CHAIN_LABEL[v.chain]}</td>
                    <td className="num small break-all">{v.address}</td>
                  </tr>
                ))}
                <tr><td>Synthra router</td><td>n/a</td><td>Robinhood Testnet</td><td className="num small">{SYNTHRA.router}</td></tr>
                <tr><td>Synthra QuoterV2</td><td>n/a</td><td>Robinhood Testnet</td><td className="num small">{SYNTHRA.quoter}</td></tr>
                <tr><td>Test USDC</td><td>n/a</td><td>Robinhood Testnet</td><td className="num small">{RH_TEST_USDC.address}</td></tr>
                <tr><td>USDC</td><td>Circle</td><td>Base Sepolia</td><td className="num small">{TEST_STABLES.base.address}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4">The full list is built by <code>scripts/build-registry.mjs</code>, and the testnet addresses are in <code>lib/testnet.ts</code>.</p>
        </Section>

        <Section id="api" eyebrow="Build on it" title="API">
          <p>Everything here is plain public JSON. None of it returns secrets, signs anything or touches anyone&apos;s money.</p>
          <div className="grid gap-2 mt-4">
            {API.map(([m, path, d]) => (
              <div key={`${m} ${path}`} className="panel p-4 grid sm:grid-cols-[64px_1fr] gap-2 sm:gap-4 items-start">
                <span className={`chip !h-6 justify-center ${m === "GET" ? "pos !border-pos/40" : "warn !border-warn/40"}`}>{m}</span>
                <div>
                  <code>{path}</code>
                  <div className="small muted mt-1.5">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="security" eyebrow="Honest limits" title="Security & limits">
          <ul>
            <li>Fairtape never holds your keys or your money. You sign every transaction yourself.</li>
            <li>We only list tokens from verified issuers, and we keep known fakes out.</li>
            <li>We don&apos;t mint, redeem or wrap stock tokens. Each issuer&apos;s token is its own legal claim, so only dollars move between chains.</li>
            <li>Stock tokens aren&apos;t available to US persons, and a few other countries restrict them too. Fairtape is software, not a broker.</li>
            <li>A route is only as good as the liquidity behind it. Prices can move between the quote and your signature, so every swap has a minimum you&apos;re guaranteed to receive.</li>
          </ul>
        </Section>

        <Section id="business" eyebrow="Why it lasts" title="Business model">
          <ul>
            <li><strong>Routing fee:</strong> a small fee of 10 to 30 basis points on routed trades, through LI.FI. It&apos;s switched off during the beta.</li>
            <li><strong>Merchant API:</strong> pay links, notifications and payouts for platforms that pay people in USDC.</li>
            <li><strong>Data:</strong> the price gap between issuers, recorded every few minutes. As far as we know, nobody else is collecting it yet.</li>
          </ul>
        </Section>

        <section id="roadmap" className="scroll-mt-24 py-12 border-b border-line">
          <div className="eyebrow mb-3">What&apos;s next</div>
          <h2 className="display text-[40px] mb-8">Roadmap</h2>
          <Roadmap compact />
        </section>

        <section id="faq" className="scroll-mt-24 py-12">
          <div className="eyebrow mb-3">Questions</div>
          <h2 className="display text-[40px] mb-6">FAQ</h2>
          <Faq />
        </section>
      </article>
    </div>
  );
}
