// Product copy shared by the home page and /docs. Every claim here matches what the code does today.

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Fairtape?",
    a: "A consolidated tape and checkout for tokenized stocks. The same share now trades as different tokens from four issuers on three chains: xStocks and Ondo on Solana, Robinhood on Robinhood Chain, Coinbase on Base. Fairtape prices all of them per real share, routes you to the best print, and lets anyone settle a USDC invoice with the stocks they hold.",
  },
  {
    q: "Does Fairtape hold my funds?",
    a: "No. Fairtape is non-custodial software. Every quote comes from public routers and DEXs, and every transaction is signed in your own wallet (Phantom, MetaMask, Coinbase Wallet…). Merchant payments go straight to the merchant's address.",
  },
  {
    q: "Why compare per share instead of token price?",
    a: "Issuers reinvest dividends by changing how many shares one token represents. That multiplier is different for each issuer, so raw token prices aren't comparable. On 2026-10-01, SPYx's multiplier was 1.0057, enough to hide a 57 bp gap. Fairtape reads each multiplier live (Token-2022 scaled UI amount, ERC-8056, B20) and divides it out before comparing anything.",
  },
  {
    q: "How is the best price chosen?",
    a: "On mainnet, Fairtape asks LI.FI (which aggregates Jupiter, 1inch, Kyberswap, Across, Relay, CCTP, Mayan and more) for an executable route to every venue. It ranks the routes by what you actually receive after fees, bridges and multipliers. On testnet, it quotes every Synthra pool and two-hop path onchain in a single call. You see every option and pick one.",
  },
  {
    q: "How do I know a pay link was really paid?",
    a: "The server never trusts the payer's browser. It reads the settlement transaction from the chain: the USDC Transfer logs on EVM, or token-balance changes on Solana. For cross-chain payments, it waits for the delivery transaction on the merchant's chain. The invoice turns Paid only when the merchant's address received at least the invoiced amount, and the receipt links both transactions.",
  },
  {
    q: "What does it cost?",
    a: "Fairtape charges no fee during the beta. You pay network gas and any router or bridge fees, all shown before you sign. The planned model is a small integrator fee (10 to 30 bps) on routed conversions, plus a paid data feed.",
  },
  {
    q: "Can I try it without spending money?",
    a: "Yes. Testnet mode (/test) runs every flow on public testnets with free faucet tokens: trading the official Robinhood test stocks, paying a link with a stock, and paying cross-chain from Base Sepolia to Solana Devnet through Circle CCTP. Every action is a real transaction with an explorer link.",
  },
  {
    q: "Who can use tokenized stocks?",
    a: "Anyone can read the tape. Stock tokens are not offered to US persons, and some other jurisdictions (for example Canada, the UK and Switzerland for Robinhood tokens) are restricted by issuer terms. It is your responsibility to follow the rules where you live. Fairtape is not a broker and nothing here is investment advice.",
  },
  {
    q: "Which stocks and chains are supported?",
    a: "12 stocks across 45 venues today: NVDA, AAPL, TSLA, MSFT, GOOGL, AMZN, META and more, from xStocks and Ondo (Solana), Robinhood (Robinhood Chain) and Coinbase (Base). Every token address is verified onchain before it enters the registry, and known lookalikes (there is a fake NVDAx on Solana) are excluded.",
  },
];

export type RoadmapPhase = { when: string; title: string; status: "shipped" | "next" | "planned"; items: string[] };

export const ROADMAP: RoadmapPhase[] = [
  {
    when: "Oct 2026 · Crypto World's Fair",
    title: "The tape, the router, the checkout",
    status: "shipped",
    items: [
      "Live consolidated tape: 12 stocks, 45 venues, 4 issuers, 3 chains, priced per real share",
      "Best-print router across issuers and chains (LI.FI), signed in the user's wallet",
      "Pay links settled in USDC on Base or Solana, verified from chain data",
      "Testnet mode: Robinhood test stocks on Synthra, pay-with-stock, CCTP Base Sepolia → Solana Devnet",
    ],
  },
  {
    when: "Nov to Dec 2026",
    title: "Mainnet beta with real merchants",
    status: "next",
    items: [
      "Onboard the first 25 freelancers and small merchants paid in USDC",
      "Base Pay button and Solana Pay QR on every pay link",
      "Invoice webhooks and email receipts",
      "Jurisdiction gating at execution time, not just a notice",
    ],
  },
  {
    when: "Q1 2027",
    title: "Merchant API and recurring payments",
    status: "planned",
    items: [
      "REST API and JS SDK: create links, receive webhooks, reconcile",
      "Recurring invoices and payroll-style payouts to many recipients",
      "Dislocation alerts: weekend and halt premiums pushed to traders",
      "More issuers and chains as they launch, each verified onchain first",
    ],
  },
  {
    when: "Q2 2027",
    title: "Data and smarter execution",
    status: "planned",
    items: [
      "Paid historical premium and dislocation feed for market makers and researchers",
      "Order splitting across venues for larger tickets",
      "Installable mobile web app",
      "Integrator fee switched on (10 to 30 bps), with every fee shown before signing",
    ],
  },
];
