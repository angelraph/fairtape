import Link from "next/link";
import type { ReactNode } from "react";
import { Faq } from "@/components/home/faq";
import { Roadmap } from "@/components/home/roadmap";
import { assets, CHAIN_LABEL } from "@/lib/registry";
import { TEST_STOCKS, SYNTHRA, RH_TEST_USDC, TEST_STABLES, FAUCETS } from "@/lib/testnet";

export const metadata = { title: "Docs — Fairtape" };

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
  ["GET", "/api/tape", "Live consolidated tape: every venue of every stock, priced per share, with premium vs reference and best buy/sell."],
  ["GET", "/api/history/{ticker}?hours=72", "Minute snapshots of each venue's premium (up to 30 days)."],
  ["POST", "/api/routes", "Executable routes from one asset to every venue of a stock, ranked by value delivered."],
  ["GET", "/api/status?txHash&fromChain&toChain", "Cross-chain delivery status for a routed transaction."],
  ["GET", "/api/balances?evm&solana", "Holdings on Solana, Base and Robinhood Chain, in real shares."],
  ["POST", "/api/invoices", "Create a pay link: { network, merchantName, memo, amountUsd, settleChain, recipient }."],
  ["GET", "/api/invoices/{id}", "Invoice with status re-verified from chain data."],
  ["POST", "/api/invoices/{id}/quote", "Price paying an invoice with any asset: { fromChain, fromToken, fromAddress }."],
  ["POST", "/api/invoices/{id}", "Report a signed payment transaction; the server verifies it onchain."],
  ["GET", "/api/testnet/tape", "Synthra pool prices for every Robinhood test stock, per fee tier."],
  ["POST", "/api/testnet/quote", "Quote every Synthra path; with recipient, returns the transaction to sign."],
  ["GET", "/api/testnet/balances?evm&solana", "Balances on Robinhood Chain Testnet, Base Sepolia and Solana Devnet."],
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
            How the consolidated tape, the best-print router and stock-funded pay links work, which contracts they touch, and where the
            product is going.
          </p>
        </header>

        <Section id="overview" eyebrow="Start here" title="Overview">
          <p>
            Tokenized stocks are fragmenting. The same NVIDIA share trades as <strong>NVDAx</strong> and <strong>NVDAon</strong> on
            Solana, <strong>NVDA</strong> on Robinhood Chain and <strong>NVDAc</strong> on Base. Each has its own price, liquidity and
            dividend multiplier. Fairtape treats them as one market:
          </p>
          <ul>
            <li><strong>Tape:</strong> {venueCount} venues across {assets.length} stocks, priced per underlying share against the reference share price.</li>
            <li><strong>Best print:</strong> start from any asset on any chain and execute the route that delivers the most real shares or dollars.</li>
            <li><strong>Pay links:</strong> request exact USDC on Base or Solana; the payer settles with any stock they hold.</li>
          </ul>
        </Section>

        <Section id="quickstart" eyebrow="5 minutes" title="Quickstart">
          <h3>Use it</h3>
          <ul>
            <li>Read the tape on the <Link href="/">home page</Link>. No wallet is needed.</li>
            <li>Connect Phantom for Solana and MetaMask or Coinbase Wallet for Base and Robinhood Chain.</li>
            <li>Open <Link href="/trade">Trade</Link> to compare every venue, or <Link href="/pay/new">create a pay link</Link>.</li>
            <li>No funds? Use <Link href="/test">testnet mode</Link> with free faucet tokens.</li>
          </ul>
          <h3>Run it locally</h3>
          <p>
            <code>npm install</code> then <code>npm run dev</code>. No keys are required. Set <code>DATABASE_URL</code> for Postgres in
            production; locally an embedded PGlite database is created in <code>.data/</code>.
          </p>
        </Section>

        <Section id="per-share" eyebrow="The insight" title="Per-share pricing">
          <p>Issuers pass dividends through by changing how many shares one token represents. Fairtape reads the live multiplier for each venue and divides it out:</p>
          <ul>
            <li><strong>xStocks and Ondo (Solana):</strong> Token-2022 <code>scaledUiAmountConfig</code>, including a pending <code>newMultiplier</code> once its effective time passes.</li>
            <li><strong>Robinhood (Robinhood Chain):</strong> ERC-8056 <code>uiMultiplier()</code>; <code>oraclePaused()</code> is honored during corporate actions.</li>
            <li><strong>Coinbase (Base):</strong> B20 <code>uiMultiplier()</code>.</li>
          </ul>
          <p>
            Each venue is then compared with the underlying share&apos;s bid/ask from Robinhood market data, and cross-checked against
            Chainlink feeds on Robinhood Chain and Base. Thin pools are shown but never chosen as best.
          </p>
        </Section>

        <Section id="routing" eyebrow="Execution" title="Best-print routing">
          <p>
            For a buy, Fairtape requests a route from your asset to <em>every</em> venue of the stock. For a sell, it routes to USDC/USDG on
            each chain. Routes come from LI.FI (Jupiter, 1inch, Kyberswap, Across, Relay, CCTP v2, Mayan…) and are ranked by value delivered
            per underlying share, after fees and bridges. Right before signing, the chosen route is quoted again. Approvals are for the exact
            amount only.
          </p>
        </Section>

        <Section id="pay-links" eyebrow="Checkout" title="Pay links">
          <ul>
            <li>The merchant chooses an amount and a USDC address on Base or Solana. No account is needed.</li>
            <li>The payer picks any holding; Fairtape quotes an <strong>exact-output</strong> route so the merchant receives precisely the invoiced amount.</li>
            <li>The payer reports the signed transaction, and the server verifies it independently: USDC <code>Transfer</code> logs on EVM, token-balance deltas on Solana, and for cross-chain payments the delivery transaction on the destination chain.</li>
            <li>A transaction can pay only one invoice, and it must land after the invoice was created. Underpaid or reverted payments reopen the invoice.</li>
          </ul>
        </Section>

        <Section id="testnet" eyebrow="$0 to try" title="Testnet mode">
          <p>Every flow runs on public testnets with free tokens, as real transactions:</p>
          <ul>
            <li><strong>Trading:</strong> the official Robinhood test stocks ({TEST_STOCKS.map((s) => s.ticker).join(", ")}) on Synthra V3. Each fee tier and each two-hop path through USDC, WETH or TSLA is quoted by QuoterV2 in one Multicall3 call.</li>
            <li><strong>Pay with a stock:</strong> one exact-output swap on Robinhood Chain Testnet delivers exactly the invoiced test USDC to the merchant.</li>
            <li><strong>Cross-chain:</strong> Base Sepolia → Solana Devnet through Circle CCTP V2 fast transfer with the Forwarding Service. Circle mints on Solana, and the server waits for that mint before marking the invoice paid.</li>
          </ul>
          <h3>Faucets</h3>
          <ul>
            <li><a href={FAUCETS.robinhood} target="_blank" rel="noreferrer">Robinhood Chain faucet</a>: test ETH and test stocks</li>
            <li><a href={FAUCETS.circle} target="_blank" rel="noreferrer">Circle faucet</a>: USDC on Base Sepolia and Solana Devnet</li>
            <li><a href={FAUCETS.baseEth} target="_blank" rel="noreferrer">Base Sepolia ETH</a> · <a href={FAUCETS.solana} target="_blank" rel="noreferrer">Solana devnet SOL</a></li>
          </ul>
          <p>Testnet prices are set by testers, not the market; the mechanism is what carries over to mainnet.</p>
        </Section>

        <Section id="contracts" eyebrow="Verify us" title="Contracts & sources">
          <p>Every address is checked onchain (<code>symbol()</code>, <code>decimals()</code>, pool tokens) before it enters the registry. A sample:</p>
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
                <tr><td>Synthra router</td><td>—</td><td>Robinhood Testnet</td><td className="num small">{SYNTHRA.router}</td></tr>
                <tr><td>Synthra QuoterV2</td><td>—</td><td>Robinhood Testnet</td><td className="num small">{SYNTHRA.quoter}</td></tr>
                <tr><td>Test USDC</td><td>—</td><td>Robinhood Testnet</td><td className="num small">{RH_TEST_USDC.address}</td></tr>
                <tr><td>USDC</td><td>Circle</td><td>Base Sepolia</td><td className="num small">{TEST_STABLES.base.address}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4">The full registry is generated by <code>scripts/build-registry.mjs</code>; testnet addresses live in <code>lib/testnet.ts</code>.</p>
        </Section>

        <Section id="api" eyebrow="Build on it" title="API">
          <p>All endpoints are public JSON over HTTPS. They return no secrets, never sign anything and never hold funds.</p>
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
            <li>Non-custodial: Fairtape never holds keys or funds, and every transaction is signed by the user.</li>
            <li>Verified-issuer registry only; known lookalike tokens are excluded.</li>
            <li>Fairtape doesn&apos;t mint, redeem or wrap stock tokens. Issuers are separate legal claims, and only dollars move between chains.</li>
            <li>Stock tokens are not available to US persons and are restricted in some other jurisdictions. Fairtape is software, not a broker.</li>
            <li>Route quality depends on public liquidity. Quotes can move between pricing and signing, so every swap carries a minimum-received limit.</li>
          </ul>
        </Section>

        <Section id="business" eyebrow="Why it lasts" title="Business model">
          <ul>
            <li><strong>Routing fee:</strong> 10–30 bps integrator fee on routed conversions (LI.FI integrator fees), off during the beta.</li>
            <li><strong>Merchant API:</strong> pay links, webhooks and payouts for platforms that pay people in USDC.</li>
            <li><strong>Data:</strong> the minute-by-minute cross-issuer premium history, a dataset nobody else is collecting yet.</li>
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
