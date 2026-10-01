import "server-only";
import { LIFI_CHAIN } from "@/lib/chains";
import type { ChainKey } from "@/lib/registry";

const API = "https://li.quest/v1";

export type LifiToken = { address: string; chainId: number; symbol: string; decimals: number; priceUSD?: string; name?: string };
export type LifiStep = {
  type: string;
  tool: string;
  toolDetails?: { name: string; logoURI?: string };
  action: { fromChainId: number; toChainId: number; fromToken: LifiToken; toToken: LifiToken };
  estimate: { fromAmount: string; toAmount: string; executionDuration: number };
};
export type LifiQuote = {
  id: string;
  tool: string;
  toolDetails?: { name: string };
  action: { fromChainId: number; toChainId: number; fromToken: LifiToken; toToken: LifiToken; fromAmount: string; fromAddress: string; toAddress: string };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    executionDuration: number;
    fromAmountUSD?: string;
    toAmountUSD?: string;
    feeCosts?: { name: string; amountUSD?: string; included?: boolean }[];
    gasCosts?: { amountUSD?: string }[];
  };
  includedSteps: LifiStep[];
  transactionRequest?: { to?: string; data: string; value?: string; gasLimit?: string; gasPrice?: string; chainId?: number; from?: string };
};

function headers(): HeadersInit {
  const h: Record<string, string> = { accept: "application/json" };
  if (process.env.LIFI_API_KEY) h["x-lifi-api-key"] = process.env.LIFI_API_KEY;
  return h;
}

// Public LI.FI is rate limited; retry 429s with backoff instead of surfacing a flaky error.
async function lifiGet<T>(path: string, params: Record<string, string>, tries = 4): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  let lastErr = "";
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(45_000) }).catch((e) => {
      lastErr = String(e);
      return null;
    });
    if (res?.ok) return res.json();
    if (res && res.status !== 429 && res.status < 500) {
      const body = await res.json().catch(() => ({}));
      throw new LifiError(body.message || `LI.FI ${res.status}`, body.code);
    }
    lastErr = res ? `LI.FI ${res.status}` : lastErr;
    await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
  }
  throw new LifiError(lastErr || "LI.FI unavailable");
}

export class LifiError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

export type QuoteParams = {
  fromChain: ChainKey;
  toChain: ChainKey;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  toAddress: string;
  fromAmount?: string; // exact-in
  toAmount?: string; // exact-out (payments)
  slippage?: number;
};

export function quote(p: QuoteParams): Promise<LifiQuote> {
  const params: Record<string, string> = {
    fromChain: String(LIFI_CHAIN[p.fromChain]),
    toChain: String(LIFI_CHAIN[p.toChain]),
    fromToken: p.fromToken,
    toToken: p.toToken,
    fromAddress: p.fromAddress,
    toAddress: p.toAddress,
    slippage: String(p.slippage ?? 0.005),
    integrator: process.env.LIFI_INTEGRATOR || "fairtape",
  };
  // Integrator fees only apply once the integrator is registered with LI.FI.
  if (process.env.LIFI_INTEGRATOR && process.env.LIFI_FEE) params.fee = process.env.LIFI_FEE;
  if (p.toAmount) return lifiGet<LifiQuote>("/quote/toAmount", { ...params, toAmount: p.toAmount });
  return lifiGet<LifiQuote>("/quote", { ...params, fromAmount: p.fromAmount! });
}

export type LifiStatus = {
  status: "NOT_FOUND" | "INVALID" | "PENDING" | "DONE" | "FAILED";
  substatus?: string;
  substatusMessage?: string;
  sending?: { txHash: string; chainId: number; amount?: string };
  receiving?: { txHash?: string; chainId: number; amount?: string; token?: LifiToken; address?: string };
  tool?: string;
};

export function status(p: { txHash: string; fromChain: ChainKey; toChain: ChainKey }): Promise<LifiStatus> {
  return lifiGet<LifiStatus>("/status", {
    txHash: p.txHash,
    fromChain: String(LIFI_CHAIN[p.fromChain]),
    toChain: String(LIFI_CHAIN[p.toChain]),
  });
}
