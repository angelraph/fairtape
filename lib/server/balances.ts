import "server-only";
import { formatUnits, parseAbi, type Address } from "viem";
import { assets, STABLES, type ChainKey, type Issuer } from "@/lib/registry";
import { NATIVE } from "@/lib/native";
import { evmClient, solanaRpc } from "./clients";
import { getTape } from "./tape";

export type Holding = {
  chain: ChainKey;
  token: string;
  symbol: string;
  decimals: number;
  raw: string;
  amount: number; // token units
  kind: "stock" | "stable" | "native";
  ticker?: string;
  issuer?: Issuer;
  shares?: number; // underlying shares (stocks)
  usd: number | null;
};

const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const TOKEN_LEGACY = "TokenkegQfeyrjr4tVv2BqmC3gAHMa3VnEoUJE1rr4CtV";

type StockMeta = { ticker: string; issuer: Issuer; symbol: string; decimals: number; multiplier: number; reference: number | null };

async function stockIndex() {
  const tape = await getTape();
  const map = new Map<string, StockMeta>();
  for (const a of assets) {
    const row = tape.rows.find((r) => r.ticker === a.ticker);
    for (const v of a.venues) {
      const q = row?.venues.find((x) => x.address === v.address);
      map.set(`${v.chain}:${v.address.toLowerCase()}`, {
        ticker: a.ticker,
        issuer: v.issuer,
        symbol: v.symbol,
        decimals: v.decimals,
        multiplier: q?.multiplier ?? 1,
        reference: row?.reference.price ?? null,
      });
    }
  }
  return map;
}

function stockHolding(chain: ChainKey, token: string, raw: bigint, m: StockMeta): Holding {
  const amount = Number(formatUnits(raw, m.decimals));
  const shares = amount * m.multiplier;
  return {
    chain,
    token,
    symbol: m.symbol,
    decimals: m.decimals,
    raw: raw.toString(),
    amount,
    kind: "stock",
    ticker: m.ticker,
    issuer: m.issuer,
    shares,
    usd: m.reference != null ? shares * m.reference : null,
  };
}

async function evmHoldings(chain: "base" | "robinhood", owner: Address, index: Map<string, StockMeta>): Promise<Holding[]> {
  const client = evmClient(chain);
  const tokens = [
    ...assets.flatMap((a) => a.venues.filter((v) => v.chain === chain).map((v) => v.address as Address)),
    STABLES[chain].address as Address,
  ];
  const [native, balances] = await Promise.all([
    client.getBalance({ address: owner }),
    client.multicall({
      contracts: tokens.map((t) => ({ address: t, abi: erc20, functionName: "balanceOf", args: [owner] }) as const),
      allowFailure: true,
    }),
  ]);
  const out: Holding[] = [];
  if (native > BigInt(0)) {
    out.push({ chain, token: NATIVE[chain].address, symbol: "ETH", decimals: 18, raw: native.toString(), amount: Number(formatUnits(native, 18)), kind: "native", usd: null });
  }
  balances.forEach((b, i) => {
    if (b.status !== "success" || (b.result as bigint) === BigInt(0)) return;
    const raw = b.result as bigint;
    const token = tokens[i];
    const meta = index.get(`${chain}:${token.toLowerCase()}`);
    if (meta) out.push(stockHolding(chain, token, raw, meta));
    else {
      const s = STABLES[chain];
      const amount = Number(formatUnits(raw, s.decimals));
      out.push({ chain, token, symbol: s.symbol, decimals: s.decimals, raw: raw.toString(), amount, kind: "stable", usd: amount });
    }
  });
  return out;
}

type ParsedTokenAccount = {
  account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } } };
};

async function solanaHoldings(owner: string, index: Map<string, StockMeta>): Promise<Holding[]> {
  const [lamports, t22, legacy] = await Promise.all([
    solanaRpc<{ value: number }>("getBalance", [owner]),
    solanaRpc<{ value: ParsedTokenAccount[] }>("getTokenAccountsByOwner", [owner, { programId: TOKEN_2022 }, { encoding: "jsonParsed" }]),
    solanaRpc<{ value: ParsedTokenAccount[] }>("getTokenAccountsByOwner", [owner, { programId: TOKEN_LEGACY }, { encoding: "jsonParsed" }]),
  ]);
  const out: Holding[] = [];
  if (lamports.value > 0) {
    out.push({ chain: "solana", token: NATIVE.solana.address, symbol: "SOL", decimals: 9, raw: String(lamports.value), amount: lamports.value / 1e9, kind: "native", usd: null });
  }
  const totals = new Map<string, bigint>();
  for (const acc of [...t22.value, ...legacy.value]) {
    const { mint, tokenAmount } = acc.account.data.parsed.info;
    totals.set(mint, (totals.get(mint) ?? BigInt(0)) + BigInt(tokenAmount.amount));
  }
  for (const [mint, raw] of totals) {
    if (raw === BigInt(0)) continue;
    const meta = index.get(`solana:${mint.toLowerCase()}`);
    if (meta) out.push(stockHolding("solana", mint, raw, meta));
    else if (mint === STABLES.solana.address) {
      const amount = Number(formatUnits(raw, 6));
      out.push({ chain: "solana", token: mint, symbol: "USDC", decimals: 6, raw: raw.toString(), amount, kind: "stable", usd: amount });
    }
  }
  return out;
}

export async function getHoldings(addrs: { evm?: string; solana?: string }) {
  const index = await stockIndex();
  const jobs: Promise<Holding[]>[] = [];
  if (addrs.evm) {
    jobs.push(evmHoldings("base", addrs.evm as Address, index));
    jobs.push(evmHoldings("robinhood", addrs.evm as Address, index));
  }
  if (addrs.solana) jobs.push(solanaHoldings(addrs.solana, index));
  const settled = await Promise.allSettled(jobs);
  const holdings = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const errors = settled.filter((s) => s.status === "rejected").map((s) => String((s as PromiseRejectedResult).reason));
  return { holdings, errors };
}
