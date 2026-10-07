# Fairtape

**The consolidated tape for onchain stocks.** One NVIDIA, four issuers, three chains, one fair price.

NVIDIA now trades onchain as **NVDAx** (xStocks) and **NVDAon** (Ondo) on Solana, **NVDA** on Robinhood Chain and **NVDAc**
(Coinbase) on Base. Each venue has its own price, its own liquidity and its own dividend multiplier, so no single screen tells you
what one real share costs. Fairtape does three things:

1. **Tape.** It shows every issuer of the same stock on one screen, priced **per underlying share**, with the premium or discount to
   the reference share price.
2. **Best print.** You start from whatever you hold on any chain. Fairtape asks for an executable route to every venue and ranks the
   routes by how many real shares, or dollars, you receive after fees and bridges. Then you sign once.
3. **Pay links.** A merchant requests exact USDC on Base or Solana, and the payer settles with any stock, stablecoin or gas token on
   any of the three chains. The invoice is marked paid only after the server verifies the settlement transaction onchain.

Everything runs on mainnet. Nothing is mocked, simulated or custodied.

## Why per share matters

Issuers reinvest dividends by changing how many shares one token represents:

| Venue | Multiplier model | Read from |
|---|---|---|
| xStocks, Ondo (Solana) | Token-2022 `scaledUiAmountConfig` (`newMultiplier` once its effective time passes) | Jupiter price API / mint account |
| Robinhood (Robinhood Chain) | ERC-8056 `uiMultiplier()` | token contract |
| Coinbase (Base) | B20 `uiMultiplier()` | token contract |

On 2026-10-01, SPYx's multiplier was **1.0057**. Comparing raw token prices was off by 57 bp, which is wider than the spread you're
trying to capture. Fairtape divides every venue's token price by its live multiplier before comparing anything.

## Data sources (all live, all verifiable)

- **Robinhood Chain (4663):**
  - Stock token prices come from the deepest v3-style USDG pool (Uniswap v3, Ramses), read with `slot0`.
  - Depth comes from the pool's balances.
  - Each venue is cross-checked against its Chainlink feed, with `oraclePaused()` honored.
- **Base (8453):** Coinbase B20 stock prices come from the deepest Aerodrome Slipstream or Uniswap v3 USDC pool, cross-checked against the Chainlink "Coinbase X" feeds.
- **Solana:** xStocks and Ondo prices and liquidity come from Jupiter's price API, which includes the scaled-UI multiplier.
- **Reference:** the underlying share bid/ask from Robinhood's public market-data API (`/rhj/prices`), including trading halts.
- **Execution:** LI.FI quotes (Jupiter, 1inch, Kyberswap, Across, Relay, CCTPv2, Mayan…). Every transaction is signed in the user's own wallet.
- **Registry:** `scripts/build-registry.mjs` discovers every venue from issuer and oracle indexes and verifies each address onchain
  (`symbol()`, `decimals()`, pool tokens) before it reaches the app. Unverified lookalikes are excluded. For example, a fake "NVDAx" exists on Solana.

## Architecture

```
app/                     Next.js 16 App Router
  page.tsx               the tape (live, auto-refreshing)
  s/[ticker]             venue cards, oracle health, premium history chart
  trade                  best-print router: buy / sell / switch issuer
  pay, pay/new, pay/[id] pay links with onchain settlement verification
  portfolio              holdings across 3 chains, in real shares
  api/                   tape, routes, balances, invoices, status, confirm, history, cron
lib/server/
  tape.ts                multicall reads + normalization + best venue per stock
  routes.ts, lifi.ts     route discovery and ranking
  invoices.ts            invoice lifecycle; verifies USDC delivery from receipts / token balances
  snapshots.ts, db.ts    minute-by-minute premium history (Postgres, or embedded PGlite locally)
  balances.ts            wallet holdings on Solana, Base and Robinhood Chain
components/              wallet connection (Wallet Standard + wagmi), executor, UI
```

## Testnet mode: every flow for $0

The tape is always live mainnet data. Execution can also run on public testnets with free faucet tokens (`/test`). Every action is a real
signed transaction with an explorer link.

| Flow | Testnet | How |
|---|---|---|
| Best print | Robinhood Chain Testnet (46630) | Official Robinhood test stocks (TSLA, AMZN, AMD, PLTR, NFLX) on Synthra V3 (a Uniswap v3 fork). Each fee tier and each two-hop path through USDC, WETH or TSLA is quoted onchain by QuoterV2 in a single Multicall3 call, ranked, and executed through SwapRouter02. |
| Pay with a stock | Robinhood Chain Testnet | One exact-output swap sells the payer's test stock and delivers **exactly** the invoiced test USDC straight to the merchant. |
| Pay with USDC | Base Sepolia, Solana Devnet, Robinhood Chain Testnet | Direct transfer. The server verifies it from the receipt or token balances. |
| Cross-chain pay | Base Sepolia → Solana Devnet | Circle CCTP V2 fast transfer with the **Forwarding Service**. The payer signs once, and Circle mints on Solana and opens the merchant's USDC account if needed. The server marks the invoice paid only after it sees the Solana mint. |

Testnet prices are set by testers, so the UI labels them. What carries over to mainnet is the mechanism: one token, several pools, several prices.
Addresses are in `lib/testnet.ts`. RESEARCH.md §6 records how each one was verified.

Limits: there's no bridge out of Robinhood Chain Testnet, LI.FI doesn't serve these testnets, and xStocks and Coinbase stock tokens exist only on mainnet.
So on testnet, stock payments settle on Robinhood Chain Testnet, and the cross-chain path covers USDC from Base Sepolia to Solana Devnet.

## Run locally

```bash
npm install
npm run dev
```

No keys are required. Optional environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres for production (otherwise an embedded PGlite in `.data/`) |
| `SOLANA_RPC`, `NEXT_PUBLIC_SOLANA_RPC` | Private Solana RPC (e.g. Helius) |
| `ROBINHOOD_RPC`, `BASE_RPC` | Private EVM RPCs (public endpoints are rate-limited) |
| `LIFI_API_KEY`, `LIFI_INTEGRATOR`, `LIFI_FEE` | Higher LI.FI limits and the integrator fee (the business model) |
| `JUPITER_API_KEY` | Jupiter Pro price API |
| `CRON_SECRET` | Protects `/api/cron/snapshot` |

To regenerate the verified registry, run `node scripts/build-registry.mjs`.

## Honest limits

- Fairtape doesn't mint, redeem or wrap stock tokens. Issuers are separate legal claims, and only dollars (USDC/USDG) move between chains.
- Tokenized stocks are not available to US persons, or in some other jurisdictions, under issuer terms. Fairtape is non-custodial software, not a broker.
- Route quality depends on public liquidity and routers. Thin venues (most Ondo pools today) are shown but never chosen as "best".
