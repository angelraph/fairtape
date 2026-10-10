# Fairtape

**One stock, one fair price, wherever it trades onchain.**

Here's the problem that got me started. NVIDIA now trades onchain as four different tokens on three chains: NVDAx (xStocks) and NVDAon (Ondo) on Solana, NVDA on Robinhood Chain and NVDAc (Coinbase) on Base. Each has its own price, its own liquidity and its own way of handling dividends. So if you ask "what does one NVIDIA share cost onchain right now?", nobody can tell you.

Fairtape answers that, and then lets you act on it. It does three things:

1. **The tape.** Every issuer of the same stock on one screen, priced per real share, with how far each one sits above or below the actual share price.
2. **Best print.** Start from whatever you hold, on any chain. Fairtape asks for a real, executable route to every venue, ranks them by how many shares (or dollars) you actually end up with after fees and bridges, and you sign once.
3. **Pay links.** Ask for an exact amount of USDC on Base or Solana. Whoever pays you can use any stock, stablecoin or gas token they hold on any of the three chains. The link only turns "Paid" once our server has read the settlement transaction onchain.

All the data is live mainnet data. Nothing is mocked, and Fairtape never holds anyone's money.

## Why "per share" matters

Issuers pay out dividends by quietly changing how many shares one token stands for. Each does it differently:

* **xStocks and Ondo (Solana)** use the Token-2022 scaled UI amount. The new multiplier kicks in at a set time, and we read it from Jupiter's price API or the mint account.
* **Robinhood (Robinhood Chain)** uses ERC-8056 `uiMultiplier()` on the token contract.
* **Coinbase (Base)** uses the B20 `uiMultiplier()` on the token contract.

On October 1, one SPYx token was worth 1.0057 shares. If you compared raw token prices, you were already off by 57 basis points, which is more than the price gap you'd be trying to catch. So before comparing anything, Fairtape divides every token price by that issuer's live multiplier.

## Where the numbers come from

Everything below is live, and you can check it yourself.

* **Robinhood Chain:** stock prices come from the deepest USDG pool (Uniswap v3 or Ramses) and depth from the pool's balances. Each one is checked against its Chainlink feed, and we respect the oracle pause during corporate actions.
* **Base:** Coinbase stock prices come from the deepest Aerodrome or Uniswap v3 USDC pool, checked against Chainlink's Coinbase feeds.
* **Solana:** xStocks and Ondo prices and liquidity come from Jupiter, multiplier included.
* **The real share price:** Robinhood's public market data, which also tells us when trading is halted.
* **Trading:** routes come from LI.FI, which pulls in Jupiter, 1inch, Kyberswap, Across, Relay, Circle CCTP and Mayan. You sign every transaction in your own wallet.
* **The token list:** `scripts/build-registry.mjs` finds each venue from the issuers' and oracles' own lists, then checks every address onchain before the app uses it. That matters: there's a fake "NVDAx" on Solana, and it never makes it in.

## How the code is laid out

```
app/                     Next.js 16 App Router
  tape                   the live tape
  s/[ticker]             one stock across every venue, with its history chart
  trade                  best print: buy, sell or switch issuer
  pay, pay/new, pay/[id] pay links, verified onchain
  portfolio              your holdings on all three chains, in real shares
  test, test/trade       the free testnet versions of every flow
  api/                   the server routes behind all of the above
lib/server/
  tape.ts                reads every venue and puts them on one per-share scale
  routes.ts, lifi.ts     finds and ranks routes
  invoices.ts            pay links, and the onchain check that marks them paid
  snapshots.ts, db.ts    price history (Postgres in production, PGlite locally)
  balances.ts            wallet balances on Solana, Base and Robinhood Chain
components/              wallets, the transaction runner and the UI
```

## Try every flow for free

The tape always shows real mainnet prices. But you can run every transaction on public testnets with free faucet tokens at `/test`. Each one is a real signed transaction with an explorer link.

* **Best print** runs on Robinhood Chain Testnet, using Robinhood's own test stocks (TSLA, AMZN, AMD, PLTR, NFLX) on Synthra, a Uniswap v3 fork. We quote every pool and every two-step path in one onchain call, rank them, and execute the best.
* **Paying with a stock** also runs on Robinhood Chain Testnet. One swap sells the payer's test stock and sends exactly the requested test USDC straight to the merchant.
* **Paying with USDC** works on Base Sepolia, Solana Devnet and Robinhood Chain Testnet, and the server confirms each payment from the chain.
* **Paying across chains** goes from Base Sepolia to Solana Devnet with Circle CCTP. The payer signs once, Circle delivers on Solana (and opens the merchant's USDC account if needed), and the link is only marked paid once we see the USDC arrive.

Testnet prices are set by whoever trades there, so the app labels them clearly. What carries over to mainnet is the mechanism itself: one token, several pools, several prices.

A few honest limits on testnet: you can't bridge out of Robinhood Chain Testnet, LI.FI doesn't cover these testnets, and xStocks and Coinbase stocks only exist on mainnet. So test stock payments settle on Robinhood Chain Testnet, and the cross-chain demo moves USDC from Base Sepolia to Solana Devnet.

## Running it yourself

```bash
npm install
npm run dev
```

You don't need any keys. These settings are optional:

* `DATABASE_URL`: a Postgres database for production. Without it, the app uses a small embedded database in `.data/`.
* `SOLANA_RPC`, `NEXT_PUBLIC_SOLANA_RPC`, `ROBINHOOD_RPC`, `BASE_RPC`: your own RPC endpoints, since the public ones are rate limited.
* `LIFI_API_KEY`, `LIFI_INTEGRATOR`, `LIFI_FEE`: higher LI.FI limits, plus the small routing fee that is the business model.
* `JUPITER_API_KEY`: Jupiter's paid price API.
* `CRON_SECRET`: protects the snapshot endpoint, which a GitHub Action calls every five minutes to record price history.

To rebuild the verified token list, run `node scripts/build-registry.mjs`.

## What Fairtape doesn't do

* It doesn't mint, redeem or wrap stock tokens. Each issuer's token is its own legal claim, so only dollars (USDC or USDG) ever move between chains.
* Tokenized stocks aren't available to US persons, or in a few other countries, under the issuers' terms. Fairtape is software that never holds your funds. It isn't a broker.
* A route is only as good as the liquidity behind it. Thin venues, like most Ondo pools today, still show up on the tape, but they're never picked as the best price.
