import "server-only";
import { formatUnits, parseAbi, type Address } from "viem";
import { assets, type Asset, type Venue, type ChainKey, STABLES } from "@/lib/registry";
import { evmClient } from "./clients";
import { nySession, type Session } from "@/lib/market-hours";
import { recordSnapshot } from "./snapshots";

// ---------- types ----------

export type VenueQuote = {
  issuer: Venue["issuer"];
  chain: ChainKey;
  symbol: string;
  address: string;
  decimals: number;
  priceSource: string; // where the venue price came from
  priceToken: number | null; // USD per 1 token (raw unit, what a DEX quotes)
  multiplier: number | null; // underlying shares represented by 1 token
  pricePerShare: number | null; // priceToken / multiplier — the only comparable number
  liquidityUsd: number | null;
  premiumBps: number | null; // vs reference underlying price
  oracle: {
    provider: "Chainlink";
    feed: string;
    pricePerShare: number | null;
    updatedAt: number | null;
    ageSec: number | null;
    paused: boolean | null;
  } | null;
  pendingMultiplier: { value: number; effectiveAt: number } | null;
  warnings: string[];
};

export type TapeRow = {
  ticker: string;
  name: string;
  reference: { price: number | null; bid: number | null; ask: number | null; source: string; halted: boolean };
  venues: VenueQuote[];
  bestBuy: string | null; // venueKey of the cheapest per-share venue (liquid only)
  bestSell: string | null; // venueKey of the richest per-share venue (liquid only)
  spreadBps: number | null; // max-min per-share across liquid venues, vs reference
};

export type Tape = { asOf: number; session: Session; sessionLabel: string; rows: TapeRow[] };

const MIN_LIQUIDITY_USD = 10_000;

// ---------- Solana (Jupiter price API: includes Token-2022 scaled-UI multiplier) ----------

type JupPrice = {
  usdPrice: number;
  liquidity: number;
  decimals: number;
  stockData?: { price: number };
  scaledUiConfig?: {
    multiplier: number;
    newMultiplier: number;
    newMultiplierEffectiveAt: string;
    usdPricePrescaled: number;
  };
};

async function fetchJupiterPrices(mints: string[]): Promise<Record<string, JupPrice>> {
  const out: Record<string, JupPrice> = {};
  const key = process.env.JUPITER_API_KEY;
  const baseUrl = key ? "https://api.jup.ag" : "https://lite-api.jup.ag";
  for (let i = 0; i < mints.length; i += 50) {
    const ids = mints.slice(i, i + 50).join(",");
    const res = await fetch(`${baseUrl}/price/v3?ids=${ids}`, {
      headers: key ? { "x-api-key": key } : {},
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`jupiter price ${res.status}`);
    Object.assign(out, await res.json());
  }
  return out;
}

// A Token-2022 scaled-UI mint applies `newMultiplier` once its effective time has passed.
function effectiveScaledMultiplier(cfg: JupPrice["scaledUiConfig"], now: number) {
  if (!cfg) return { current: 1, pending: null as VenueQuote["pendingMultiplier"] };
  const effAt = Date.parse(cfg.newMultiplierEffectiveAt) / 1000;
  if (now >= effAt) return { current: cfg.newMultiplier, pending: null };
  return { current: cfg.multiplier, pending: { value: cfg.newMultiplier, effectiveAt: effAt } };
}

// ---------- Reference price (Robinhood market data: raw underlying, not multiplier-adjusted) ----------

type RhQuote = { bid: string; ask: string; isTradingHalt: boolean };

async function fetchReference(ticker: string): Promise<RhQuote | null> {
  try {
    const res = await fetch(`https://api.robinhood.com/rhj/prices/${ticker}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.quotes?.[0] ?? null;
  } catch {
    return null;
  }
}

// ---------- EVM venues (Robinhood Chain + Base): multiplier, pool price, pool depth, Chainlink ----------

const tokenAbi = parseAbi([
  "function uiMultiplier() view returns (uint256)",
  "function oraclePaused() view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
// Uniswap v3, Ramses v3 and Aerodrome Slipstream all return sqrtPriceX96 as the first slot0 word.
const slot0Abi = parseAbi(["function slot0() view returns (uint160 sqrtPriceX96)"]);
const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function decimals() view returns (uint8)",
]);

type EvmRead = {
  multiplier: number | null;
  paused: boolean | null;
  priceToken: number | null;
  liquidityUsd: number | null;
  oraclePrice: number | null;
  oracleUpdatedAt: number | null;
};

async function readEvmVenues(chain: "base" | "robinhood", venues: Venue[]): Promise<Map<string, EvmRead>> {
  const client = evmClient(chain);
  const stable = STABLES[chain];
  const calls = venues.flatMap((v) => {
    const token = v.address as Address;
    const c = [
      { address: token, abi: tokenAbi, functionName: "uiMultiplier" },
      { address: token, abi: tokenAbi, functionName: "oraclePaused" },
    ] as const;
    const pool = v.pool
      ? ([
          { address: v.pool.address, abi: slot0Abi, functionName: "slot0" },
          { address: token, abi: tokenAbi, functionName: "balanceOf", args: [v.pool.address] },
          { address: stable.address as Address, abi: tokenAbi, functionName: "balanceOf", args: [v.pool.address] },
        ] as const)
      : [];
    const feed = v.chainlinkFeed
      ? ([
          { address: v.chainlinkFeed, abi: feedAbi, functionName: "latestRoundData" },
          { address: v.chainlinkFeed, abi: feedAbi, functionName: "decimals" },
        ] as const)
      : [];
    return [...c, ...pool, ...feed];
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await client.multicall({ contracts: calls as any, allowFailure: true });
  const out = new Map<string, EvmRead>();
  let i = 0;
  const next = () => results[i++];

  for (const v of venues) {
    const mult = next();
    const paused = next();
    const read: EvmRead = {
      multiplier: mult.status === "success" ? Number(formatUnits(mult.result as bigint, 18)) : null,
      paused: paused.status === "success" ? (paused.result as boolean) : null,
      priceToken: null,
      liquidityUsd: null,
      oraclePrice: null,
      oracleUpdatedAt: null,
    };
    if (v.pool) {
      const slot0 = next();
      const tokenBal = next();
      const stableBal = next();
      if (slot0.status === "success") {
        const sqrt = slot0.result as bigint;
        const stockIs0 = v.pool.token0.toLowerCase() === v.address.toLowerCase();
        const dec0 = stockIs0 ? v.decimals : stable.decimals;
        const dec1 = stockIs0 ? stable.decimals : v.decimals;
        // price of token0 in token1 units, adjusted for decimals
        const p0in1 = (Number(sqrt) / 2 ** 96) ** 2 * 10 ** (dec0 - dec1);
        read.priceToken = stockIs0 ? p0in1 : 1 / p0in1;
      }
      if (tokenBal.status === "success" && stableBal.status === "success" && read.priceToken) {
        read.liquidityUsd =
          Number(formatUnits(tokenBal.result as bigint, v.decimals)) * read.priceToken +
          Number(formatUnits(stableBal.result as bigint, stable.decimals));
      }
    }
    if (v.chainlinkFeed) {
      const round = next();
      const dec = next();
      if (round.status === "success" && dec.status === "success") {
        const [, answer, , updatedAt] = round.result as [bigint, bigint, bigint, bigint, bigint];
        read.oraclePrice = Number(formatUnits(answer, Number(dec.result)));
        read.oracleUpdatedAt = Number(updatedAt);
      }
    }
    out.set(v.address, read);
  }
  return out;
}

// ---------- assembly ----------

function bps(price: number | null, ref: number | null) {
  if (price == null || ref == null || ref === 0) return null;
  return Math.round((price / ref - 1) * 10_000 * 10) / 10;
}

function buildRow(
  asset: Asset,
  ref: RhQuote | null,
  jup: Record<string, JupPrice>,
  evm: Map<string, EvmRead>,
  now: number,
  session: Session,
): TapeRow {
  const refBid = ref ? Number(ref.bid) : null;
  const refAsk = ref ? Number(ref.ask) : null;
  let refPrice = refBid != null && refAsk != null ? (refBid + refAsk) / 2 : null;
  let refSource = "Robinhood market data (underlying share)";
  if (refPrice == null) {
    const sd = asset.venues.map((v) => jup[v.address]?.stockData?.price).find((p) => p != null);
    if (sd != null) {
      refPrice = sd;
      refSource = "Jupiter stock data (underlying share)";
    }
  }

  const venues: VenueQuote[] = asset.venues.map((v) => {
    const warnings: string[] = [];
    if (v.chain === "solana") {
      const p = jup[v.address];
      const { current, pending } = effectiveScaledMultiplier(p?.scaledUiConfig, now);
      const priceToken = p ? (p.scaledUiConfig?.usdPricePrescaled ?? p.usdPrice) : null;
      const pricePerShare = priceToken != null ? priceToken / current : null;
      const liquidityUsd = p?.liquidity ?? null;
      if (!p) warnings.push("no price");
      else if ((liquidityUsd ?? 0) < MIN_LIQUIDITY_USD) warnings.push("thin liquidity");
      return {
        issuer: v.issuer,
        chain: v.chain,
        symbol: v.symbol,
        address: v.address,
        decimals: v.decimals,
        priceSource: "Jupiter (aggregated Solana DEX price)",
        priceToken,
        multiplier: current,
        pricePerShare,
        liquidityUsd,
        premiumBps: bps(pricePerShare, refPrice),
        oracle: null,
        pendingMultiplier: pending,
        warnings,
      };
    }
    const r = evm.get(v.address);
    const multiplier = r?.multiplier ?? null;
    const pricePerShare = r?.priceToken != null && multiplier ? r.priceToken / multiplier : null;
    if (!v.pool) warnings.push("no USD pool");
    if (r?.liquidityUsd != null && r.liquidityUsd < MIN_LIQUIDITY_USD) warnings.push("thin liquidity");
    if (r?.paused) warnings.push("oracle paused (corporate action)");
    const oracleAge = r?.oracleUpdatedAt ? now - r.oracleUpdatedAt : null;
    // Feeds have a 24h heartbeat; outside market hours they legitimately stop moving.
    if (oracleAge != null && oracleAge > 86_400 && session !== "closed") warnings.push("oracle stale");
    return {
      issuer: v.issuer,
      chain: v.chain,
      symbol: v.symbol,
      address: v.address,
      decimals: v.decimals,
      priceSource: v.pool ? `${v.pool.name} (${v.pool.dex})` : "—",
      priceToken: r?.priceToken ?? null,
      multiplier,
      pricePerShare,
      liquidityUsd: r?.liquidityUsd ?? null,
      premiumBps: bps(pricePerShare, refPrice),
      oracle: v.chainlinkFeed
        ? {
            provider: "Chainlink",
            feed: v.chainlinkFeed,
            // Robinhood and Coinbase feeds report the multiplier-adjusted per-token value.
            pricePerShare: r?.oraclePrice != null && multiplier ? r.oraclePrice / multiplier : null,
            updatedAt: r?.oracleUpdatedAt ?? null,
            ageSec: oracleAge,
            paused: r?.paused ?? null,
          }
        : null,
      pendingMultiplier: null,
      warnings,
    };
  });

  const liquid = venues.filter(
    (v) => v.pricePerShare != null && (v.liquidityUsd ?? 0) >= MIN_LIQUIDITY_USD && !v.warnings.includes("oracle paused (corporate action)"),
  );
  const key = (v: VenueQuote) => `${v.chain}:${v.address}`;
  const sorted = [...liquid].sort((a, b) => a.pricePerShare! - b.pricePerShare!);
  const spreadBps =
    sorted.length >= 2 && refPrice
      ? Math.round(((sorted.at(-1)!.pricePerShare! - sorted[0].pricePerShare!) / refPrice) * 10_000 * 10) / 10
      : null;

  return {
    ticker: asset.ticker,
    name: asset.name,
    reference: { price: refPrice, bid: refBid, ask: refAsk, source: refSource, halted: ref?.isTradingHalt ?? false },
    venues,
    bestBuy: sorted.length >= 2 ? key(sorted[0]) : null,
    bestSell: sorted.length >= 2 ? key(sorted.at(-1)!) : null,
    spreadBps,
  };
}

async function computeTape(): Promise<Tape> {
  const now = Math.floor(Date.now() / 1000);
  const { session, label } = nySession();
  const all = assets.flatMap((a) => a.venues);
  const solMints = all.filter((v) => v.chain === "solana").map((v) => v.address);

  const [jup, rhReads, baseReads, refs] = await Promise.all([
    fetchJupiterPrices(solMints).catch(() => ({}) as Record<string, JupPrice>),
    readEvmVenues("robinhood", all.filter((v) => v.chain === "robinhood")).catch(() => new Map<string, EvmRead>()),
    readEvmVenues("base", all.filter((v) => v.chain === "base")).catch(() => new Map<string, EvmRead>()),
    Promise.all(assets.map((a) => fetchReference(a.ticker))),
  ]);
  const evm = new Map([...rhReads, ...baseReads]);

  return {
    asOf: now,
    session,
    sessionLabel: label,
    rows: assets.map((a, i) => buildRow(a, refs[i], jup, evm, now, session)),
  };
}

// Small in-process cache so many viewers share one set of upstream reads.
let cached: { at: number; tape: Promise<Tape> } | null = null;
const TTL_MS = 15_000;

export function getTape(): Promise<Tape> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.tape;
  const tape = computeTape();
  cached = { at: Date.now(), tape };
  tape.then(
    (t) => recordSnapshot(t).catch((e) => console.error("snapshot failed", e)),
    () => {
      cached = null;
    },
  );
  return tape;
}
