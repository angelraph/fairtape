import type { ChainKey } from "./registry";

// LI.FI's identifiers for each chain's gas token.
export const NATIVE: Record<ChainKey, { symbol: string; address: string; decimals: number }> = {
  solana: { symbol: "SOL", address: "11111111111111111111111111111111", decimals: 9 },
  base: { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  robinhood: { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
};

export function isNative(chain: ChainKey, token: string) {
  return NATIVE[chain].address.toLowerCase() === token.toLowerCase();
}
