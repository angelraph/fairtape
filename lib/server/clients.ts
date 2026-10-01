import "server-only";
import { createPublicClient, http } from "viem";
import { base, robinhood, BASE_RPC } from "@/lib/chains";

const RH_RPC = process.env.ROBINHOOD_RPC || robinhood.rpcUrls.default.http[0];
const BASE_RPC_SERVER = process.env.BASE_RPC || BASE_RPC;
export const SOLANA_RPC_SERVER = process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";

export const rhClient = createPublicClient({ chain: robinhood, transport: http(RH_RPC, { batch: true }) });
export const baseClient = createPublicClient({ chain: base, transport: http(BASE_RPC_SERVER, { batch: true }) });

export function evmClient(chain: "base" | "robinhood") {
  return chain === "base" ? baseClient : rhClient;
}

export async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SOLANA_RPC_SERVER, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.error) throw new Error(`solana ${method}: ${json.error.message}`);
  return json.result as T;
}
