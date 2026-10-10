// Product copy shared by the home page and /docs. Every claim here matches what the code does today.

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Fairtape?",
    a: "It's one place to see, buy and spend tokenized stocks. The same NVIDIA share now trades as four different tokens: xStocks and Ondo on Solana, Robinhood's on Robinhood Chain, and Coinbase's on Base. Fairtape shows what each one costs per real share, takes you to the cheapest one, and lets people pay you in dollars using the stocks they already hold.",
  },
  {
    q: "Does Fairtape ever hold my money?",
    a: "Never. Quotes come from public exchanges and routers, and you sign every transaction yourself in your own wallet, whether that's Phantom, MetaMask or Coinbase Wallet. When someone pays a link, the money goes straight to the person who asked for it.",
  },
  {
    q: "Why compare per share instead of just the token price?",
    a: "Because a token isn't always exactly one share. Issuers pay out dividends by nudging up how many shares each token is worth, and every issuer does it at a different rate. On October 1, one SPYx token was worth 1.0057 shares, which is enough to hide a 57 basis point price gap. So Fairtape reads every issuer's live multiplier and takes it out before comparing anything.",
  },
  {
    q: "How does it pick the best price?",
    a: "On mainnet, it asks LI.FI, which pulls in Jupiter, 1inch, Kyberswap, Across, Relay, Circle CCTP, Mayan and others, for a real route to every venue. Then it ranks them by what actually lands in your wallet after fees, bridges and multipliers. On testnet, it checks every Synthra pool and two-step path onchain in one go. Either way, you see all the options and choose.",
  },
  {
    q: "How do I know a pay link was really paid?",
    a: "We don't take anyone's word for it, including the payer's browser. Our server reads the settlement straight from the chain: the USDC transfer on Base or Robinhood Chain, or the balance change on Solana. For cross-chain payments, it waits until the money actually arrives on the merchant's chain. The link only says Paid once the full amount has landed, and the receipt links to both transactions.",
  },
  {
    q: "What does it cost?",
    a: "Nothing from us while we're in beta. You pay the usual network gas and any router or bridge fees, and you'll see all of them before you sign. Later we plan to take a small routing fee, somewhere between 10 and 30 basis points, and sell the price history as a data feed.",
  },
  {
    q: "Can I try it without spending anything?",
    a: "Yes, that's what testnet mode is for. At /test you can run everything with free faucet tokens: trade Robinhood's official test stocks, pay a link with a stock, and pay across chains from Base Sepolia to Solana Devnet through Circle. They're all real transactions, so you get explorer links for each one.",
  },
  {
    q: "Who can use tokenized stocks?",
    a: "Anyone can look at the tape. Buying the tokens is another matter: the issuers don't offer them to US persons, and some other places are restricted too (Canada, the UK and Switzerland for Robinhood's tokens, for example). Please check the rules where you live. Fairtape isn't a broker, and nothing here is investment advice.",
  },
  {
    q: "Which stocks and chains can I use?",
    a: "Right now there are 12 stocks across 45 venues, including NVDA, AAPL, TSLA, MSFT, GOOGL, AMZN and META. They come from xStocks and Ondo on Solana, Robinhood on Robinhood Chain, and Coinbase on Base. We check every token address onchain before adding it, and we keep known fakes out. There really is a fake NVDAx on Solana.",
  },
];

export type RoadmapPhase = { when: string; title: string; status: "shipped" | "next" | "planned"; items: string[] };

export const ROADMAP: RoadmapPhase[] = [
  {
    when: "Oct 2026 · Crypto World's Fair",
    title: "See it, buy it, spend it",
    status: "shipped",
    items: [
      "A live tape of 12 stocks across 45 venues, four issuers and three chains, all priced per real share",
      "Best print across every issuer and chain, signed in your own wallet",
      "Pay links that settle in USDC on Base or Solana and are checked against the chain",
      "A free testnet mode: Robinhood test stocks, paying with a stock, and Base Sepolia to Solana Devnet through Circle",
    ],
  },
  {
    when: "Nov to Dec 2026",
    title: "Real merchants on mainnet",
    status: "next",
    items: [
      "Bring on our first 25 freelancers and small businesses who get paid in USDC",
      "A Base Pay button and a Solana Pay QR code on every pay link",
      "Webhooks and email receipts when an invoice gets paid",
      "Proper location checks before a trade, not just a notice",
    ],
  },
  {
    when: "Q1 2027",
    title: "An API for merchants, and repeat payments",
    status: "planned",
    items: [
      "A simple API and JavaScript SDK to create links, get notified and reconcile",
      "Recurring invoices, and paying lots of people at once like payroll",
      "Alerts when a stock trades unusually high or low, like over a weekend or during a halt",
      "New issuers and chains as they launch, each one checked onchain first",
    ],
  },
  {
    when: "Q2 2027",
    title: "Better data, smarter trades",
    status: "planned",
    items: [
      "Our price history as a paid feed for market makers and researchers",
      "Splitting bigger orders across several venues",
      "A mobile web app you can install on your phone",
      "Switching on the small routing fee, always shown before you sign",
    ],
  },
];
