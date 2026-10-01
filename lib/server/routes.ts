import "server-only";
import { formatUnits } from "viem";
import { assets, STABLES, type ChainKey } from "@/lib/registry";
import { quote, type LifiQuote } from "./lifi";
import { getTape } from "./tape";
import { NATIVE, isNative } from "@/lib/native";

export type Endpoint = { chain: ChainKey; token: string };

export type RouteResult = {
  target: Endpoint;
  label: string; // e.g. "NVDAc · Coinbase · Base"
  ok: boolean;
  error?: string;
  toAmount?: string;
  toAmountMin?: string;
  toDecimals?: number;
  toSymbol?: string;
  shares?: number | null; // underlying shares received (stocks only)
  usdIn?: number | null;
  usdOut?: number | null; // valued at the reference price for stocks, at $1 for stables
  costBps?: number | null; // what the route costs vs a frictionless trade at reference
  durationSec?: number;
  steps?: string[];
  quote?: LifiQuote;
};

// Describes any endpoint the app knows about: a registry stock venue or a chain's stablecoin.
export async function describe(e: Endpoint) {
  const tape = await getTape();
  for (const a of assets) {
    const v = a.venues.find((v) => v.chain === e.chain && v.address.toLowerCase() === e.token.toLowerCase());
    if (v) {
      const row = tape.rows.find((r) => r.ticker === a.ticker)!;
      const q = row.venues.find((x) => x.address === v.address);
      return {
        kind: "stock" as const,
        ticker: a.ticker,
        symbol: v.symbol,
        issuer: v.issuer,
        decimals: v.decimals,
        multiplier: q?.multiplier ?? 1,
        reference: row.reference.price,
      };
    }
  }
  const s = STABLES[e.chain];
  if (s.address.toLowerCase() === e.token.toLowerCase()) {
    return { kind: "stable" as const, symbol: s.symbol, decimals: s.decimals };
  }
  return null;
}

const CHAIN_NAME: Record<ChainKey, string> = { solana: "Solana", robinhood: "Robinhood Chain", base: "Base" };

export async function findRoutes(input: {
  from: Endpoint & { amount: string };
  fromAddress: string;
  toAddresses: Partial<Record<"solana" | "evm", string>>;
  targets: Endpoint[];
}): Promise<RouteResult[]> {
  const fromInfo = await describe(input.from);
  const native = isNative(input.from.chain, input.from.token) ? NATIVE[input.from.chain] : null;
  if (!fromInfo && !native) throw new Error("Unknown source asset");
  const fromUnits = Number(formatUnits(BigInt(input.from.amount), fromInfo?.decimals ?? native!.decimals));
  // Gas tokens have no reference here; their USD value comes from the router's own quote.
  const knownUsdIn = !fromInfo
    ? null
    : fromInfo.kind === "stable"
      ? fromUnits
      : fromInfo.reference != null
        ? fromUnits * fromInfo.multiplier * fromInfo.reference
        : null;

  const results: RouteResult[] = [];
  // Stagger requests so a burst of quotes stays under public rate limits.
  await Promise.all(
    input.targets.map(async (target, i) => {
      await new Promise((r) => setTimeout(r, i * 350));
      const info = await describe(target);
      const label = info
        ? info.kind === "stock"
          ? `${info.symbol} · ${info.issuer} · ${CHAIN_NAME[target.chain]}`
          : `${info.symbol} · ${CHAIN_NAME[target.chain]}`
        : target.token;
      const toAddress = target.chain === "solana" ? input.toAddresses.solana : input.toAddresses.evm;
      if (!info) return results.push({ target, label, ok: false, error: "Unknown destination" });
      if (!toAddress)
        return results.push({
          target,
          label,
          ok: false,
          error: `Connect a ${target.chain === "solana" ? "Solana" : "Base / Robinhood"} wallet to receive here`,
        });
      try {
        const q = await quote({
          fromChain: input.from.chain,
          toChain: target.chain,
          fromToken: input.from.token,
          toToken: target.token,
          fromAmount: input.from.amount,
          fromAddress: input.fromAddress,
          toAddress,
        });
        const out = Number(formatUnits(BigInt(q.estimate.toAmount), q.action.toToken.decimals));
        const shares = info.kind === "stock" ? out * info.multiplier : null;
        const usdOut =
          info.kind === "stable" ? out : info.reference != null && shares != null ? shares * info.reference : null;
        const usdIn = knownUsdIn ?? (q.estimate.fromAmountUSD ? Number(q.estimate.fromAmountUSD) : null);
        results.push({
          target,
          label,
          ok: true,
          toAmount: q.estimate.toAmount,
          toAmountMin: q.estimate.toAmountMin,
          toDecimals: q.action.toToken.decimals,
          toSymbol: q.action.toToken.symbol,
          shares,
          usdIn,
          usdOut,
          costBps: usdIn && usdOut != null ? Math.round((1 - usdOut / usdIn) * 10_000 * 10) / 10 : null,
          durationSec: q.estimate.executionDuration,
          steps: q.includedSteps.filter((s) => s.type !== "protocol").map((s) => `${s.type === "cross" ? "Bridge" : "Swap"} via ${s.toolDetails?.name ?? s.tool}`),
          quote: q,
        });
      } catch (e) {
        results.push({ target, label, ok: false, error: e instanceof Error ? e.message : "No route" });
      }
    }),
  );

  // Best first: most value delivered.
  return results.sort((a, b) => (b.usdOut ?? -1) - (a.usdOut ?? -1));
}
