import "server-only";
import { encodeAbiParameters, encodeFunctionData, formatUnits, getAddress, keccak256, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { rhTestClient } from "./testnet-clients";
import { rhClient } from "./clients";
import { DESK, TEST_STOCKS, RH_TEST_USDC, robinhoodTestnet } from "@/lib/testnet";
import deskArtifact from "@/contracts/FairtapeDesk.json";

// The Fairtape testnet desk fills trades and stock payments on Robinhood Chain Testnet at the live real-world price.
// Prices come from mainnet sources only. If no source answers, we refuse to quote rather than guess.

export const NATIVE = "0x0000000000000000000000000000000000000000";
const E18 = BigInt(10) ** BigInt(18);
const QUOTE_TTL_SEC = 120;

const deskAbi = deskArtifact.abi;
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const feedAbi = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)", "function decimals() view returns (uint8)"]);

// Mainnet backups for each test stock: the same company's xStock on Solana (verified issuer, priced per real share).
const XSTOCK_MINT: Record<string, string> = {
  TSLA: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
  AMZN: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
  AMD: "XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF",
  PLTR: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4",
  NFLX: "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL",
};
// Chainlink ETH / USD on Robinhood Chain mainnet.
const ETH_USD_FEED = "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9" as Address;

export type RealPrice = { usd: number; source: string; asOf: number };
export type DeskToken = { address: string; symbol: string; name: string };

export const DESK_TOKENS: DeskToken[] = [
  { address: NATIVE, symbol: "ETH", name: "Ether" },
  { address: RH_TEST_USDC.address, symbol: "USDC", name: "USD Coin" },
  ...TEST_STOCKS.map((s) => ({ address: s.address, symbol: s.ticker, name: s.name })),
];

export function deskToken(address: string) {
  return DESK_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? null;
}

export function deskConfigured() {
  return Boolean(DESK.address && process.env.DESK_SIGNER_KEY);
}

// real prices

async function robinhoodPrice(ticker: string): Promise<RealPrice | null> {
  try {
    const r = await fetch(`https://api.robinhood.com/rhj/prices/${ticker}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const q = (await r.json()).quotes?.[0];
    const bid = Number(q?.bid);
    const ask = Number(q?.ask);
    if (!(bid > 0) || !(ask > 0) || q.isTradingHalt) return null;
    const mid = (bid + ask) / 2;
    // Outside market hours the quote can be wide; a mid that far from both sides isn't a trustworthy price.
    if ((ask - bid) / mid > 0.005) return null;
    return { usd: mid, source: "Robinhood market data", asOf: Date.parse(q.generatedAt) || Date.now() };
  } catch {
    return null;
  }
}

type JupStock = { usdPrice: number; stockData?: { price: number; updatedAt?: string } };

async function jupiterPrices(mints: string[]): Promise<Record<string, RealPrice>> {
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return {};
    const j = (await r.json()) as Record<string, JupStock>;
    const out: Record<string, RealPrice> = {};
    for (const [mint, v] of Object.entries(j)) {
      // stockData.price is the underlying company's share price; usdPrice is the xStock token's trading price per share.
      if (v.stockData?.price && v.stockData.price > 0) {
        out[mint] = { usd: v.stockData.price, source: "Underlying share price (xStocks data)", asOf: Date.parse(v.stockData.updatedAt ?? "") || Date.now() };
      } else if (v.usdPrice > 0) {
        out[mint] = { usd: v.usdPrice, source: "xStocks on Jupiter", asOf: Date.now() };
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function ethPrice(): Promise<RealPrice | null> {
  try {
    const [round, dec] = await Promise.all([
      rhClient.readContract({ address: ETH_USD_FEED, abi: feedAbi, functionName: "latestRoundData" }),
      rhClient.readContract({ address: ETH_USD_FEED, abi: feedAbi, functionName: "decimals" }),
    ]);
    const usd = Number(formatUnits(round[1], dec));
    if (usd > 0) return { usd, source: "Chainlink ETH / USD", asOf: Number(round[3]) * 1000 };
  } catch {}
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const usd = Number((await r.json()).data?.amount);
    if (usd > 0) return { usd, source: "Coinbase spot", asOf: Date.now() };
  } catch {}
  return null;
}

let priceCache: { at: number; prices: Promise<Record<string, RealPrice>> } | null = null;

/** Live real-world USD prices for every token the desk trades, keyed by lowercase token address. */
export function realPrices(): Promise<Record<string, RealPrice>> {
  if (priceCache && Date.now() - priceCache.at < 10_000) return priceCache.prices;
  const prices = (async () => {
    const [eth, jup, ...rh] = await Promise.all([ethPrice(), jupiterPrices(Object.values(XSTOCK_MINT)), ...TEST_STOCKS.map((s) => robinhoodPrice(s.ticker))]);
    const out: Record<string, RealPrice> = {};
    if (eth) out[NATIVE] = eth;
    out[RH_TEST_USDC.address.toLowerCase()] = { usd: 1, source: "USDC (1 dollar)", asOf: Date.now() };
    TEST_STOCKS.forEach((s, i) => {
      const price = rh[i] ?? jup[XSTOCK_MINT[s.ticker]];
      if (price) out[s.address.toLowerCase()] = price;
    });
    return out;
  })();
  priceCache = { at: Date.now(), prices };
  prices.catch(() => (priceCache = null));
  return prices;
}

// inventory

export async function deskInventory(): Promise<Record<string, bigint>> {
  if (!DESK.address) return {};
  const desk = DESK.address as Address;
  const erc20Tokens = DESK_TOKENS.filter((t) => t.address !== NATIVE);
  const [eth, balances] = await Promise.all([
    rhTestClient.getBalance({ address: desk }),
    rhTestClient.multicall({
      allowFailure: true,
      contracts: erc20Tokens.map((t) => ({ address: t.address as Address, abi: erc20, functionName: "balanceOf" as const, args: [desk] as const })),
    }),
  ]);
  const out: Record<string, bigint> = { [NATIVE]: eth };
  erc20Tokens.forEach((t, i) => {
    out[t.address.toLowerCase()] = balances[i].status === "success" ? (balances[i].result as bigint) : BigInt(0);
  });
  return out;
}

// quotes

export type DeskQuote = {
  mode: "exactIn" | "exactOut";
  tokenIn: string;
  tokenOut: string;
  symbolIn: string;
  symbolOut: string;
  amountIn: string;
  amountOut: string;
  priceIn: RealPrice;
  priceOut: RealPrice;
  expiry: number;
  inventoryOut: string;
  enoughInventory: boolean;
  tx: { to: Address; data: Hex; value: string; approve: { token: Address; spender: Address; amount: string } | null };
};

function toE18(usd: number) {
  // Prices carry 18 decimals onchain; 9 significant decimals here is far below a cent of error.
  return BigInt(Math.round(usd * 1e9)) * BigInt(10) ** BigInt(9);
}

/**
 * Builds a signed, ready-to-send desk transaction at the live market price.
 * exactIn: spend exactly `amount` of tokenIn. exactOut: deliver exactly `amount` of tokenOut to `recipient`.
 */
export async function quoteDesk(p: { tokenIn: string; tokenOut: string; amount: bigint; mode: "exactIn" | "exactOut"; recipient: string }): Promise<DeskQuote> {
  if (!deskConfigured()) throw new Error("The testnet desk isn't live yet.");
  const a = deskToken(p.tokenIn);
  const b = deskToken(p.tokenOut);
  if (!a || !b || a.address.toLowerCase() === b.address.toLowerCase()) throw new Error("Pick two different supported tokens.");
  const [prices, inventory] = await Promise.all([realPrices(), deskInventory()]);
  const priceIn = prices[a.address.toLowerCase()];
  const priceOut = prices[b.address.toLowerCase()];
  if (!priceIn || !priceOut) throw new Error(`No live market price for ${!priceIn ? a.symbol : b.symbol} right now, so the desk won't quote it.`);

  const pIn = toE18(priceIn.usd);
  const pOut = toE18(priceOut.usd);
  // Same arithmetic as the contract, so the quote matches the fill to the last unit.
  const amountIn = p.mode === "exactIn" ? p.amount : (p.amount * pOut + pIn - BigInt(1)) / pIn;
  const amountOut = p.mode === "exactIn" ? (p.amount * pIn) / pOut : p.amount;
  if (amountIn === BigInt(0) || amountOut === BigInt(0)) throw new Error("That amount is too small to fill.");

  const expiry = Math.floor(Date.now() / 1000) + QUOTE_TTL_SEC;
  const quote = {
    tokenIn: getAddress(a.address),
    tokenOut: getAddress(b.address),
    priceIn: pIn,
    priceOut: pOut,
    expiry: BigInt(expiry),
  };
  const desk = getAddress(DESK.address!);
  const hash = keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
      [desk, BigInt(robinhoodTestnet.id), quote.tokenIn, quote.tokenOut, quote.priceIn, quote.priceOut, quote.expiry],
    ),
  );
  const signer = privateKeyToAccount(process.env.DESK_SIGNER_KEY as Hex);
  const sig = await signer.signMessage({ message: { raw: hash } });
  const recipient = getAddress(p.recipient);
  const data =
    p.mode === "exactIn"
      ? encodeFunctionData({ abi: deskAbi, functionName: "swapExactIn", args: [quote, sig, amountIn, amountOut, recipient] })
      : encodeFunctionData({ abi: deskAbi, functionName: "swapExactOut", args: [quote, sig, amountOut, amountIn, recipient] });
  const nativeIn = a.address === NATIVE;
  const held = inventory[b.address.toLowerCase()] ?? BigInt(0);

  return {
    mode: p.mode,
    tokenIn: a.address,
    tokenOut: b.address,
    symbolIn: a.symbol,
    symbolOut: b.symbol,
    amountIn: amountIn.toString(),
    amountOut: amountOut.toString(),
    priceIn,
    priceOut,
    expiry,
    inventoryOut: held.toString(),
    enoughInventory: held >= amountOut,
    tx: {
      to: desk,
      data: data as Hex,
      value: nativeIn ? amountIn.toString() : "0",
      approve: nativeIn ? null : { token: getAddress(a.address), spender: desk, amount: amountIn.toString() },
    },
  };
}

/** What the desk can deliver right now, in tokens and in real dollars, for the testnet screens. */
export async function deskBook() {
  const [prices, inventory] = await Promise.all([realPrices(), deskInventory()]);
  return DESK_TOKENS.map((t) => {
    const price = prices[t.address.toLowerCase()] ?? null;
    const held = inventory[t.address.toLowerCase()] ?? BigInt(0);
    const units = Number(held) / Number(E18);
    return { ...t, price, inventory: held.toString(), inventoryUsd: price ? units * price.usd : null };
  });
}
