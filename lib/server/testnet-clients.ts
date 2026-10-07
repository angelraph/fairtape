import "server-only";
import { createPublicClient, http } from "viem";
import { robinhoodTestnet, baseSepolia, BASE_SEPOLIA_RPC, SOLANA_DEVNET_RPC } from "@/lib/testnet";

const RH_TEST_RPC = process.env.ROBINHOOD_TESTNET_RPC || robinhoodTestnet.rpcUrls.default.http[0];
const BASE_SEPOLIA_RPC_SERVER = process.env.BASE_SEPOLIA_RPC || BASE_SEPOLIA_RPC;
const SOLANA_DEVNET_RPC_SERVER = process.env.SOLANA_DEVNET_RPC || SOLANA_DEVNET_RPC;

// The public testnet RPCs rate-limit hard; retry with backoff instead of failing the request.
const retry = { retryCount: 6, retryDelay: 1200 };

export const rhTestClient = createPublicClient({ chain: robinhoodTestnet, transport: http(RH_TEST_RPC, retry) });
export const baseSepoliaClient = createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA_RPC_SERVER, retry) });

export function testEvmClient(chain: "base" | "robinhood") {
  return chain === "base" ? baseSepoliaClient : rhTestClient;
}

export async function solanaDevnetRpc<T>(method: string, params: unknown[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(SOLANA_DEVNET_RPC_SERVER, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    const json = await res.json();
    if (json.error) throw new Error(`solana devnet ${method}: ${json.error.message}`);
    return json.result as T;
  }
}

export { SOLANA_DEVNET_RPC_SERVER };
