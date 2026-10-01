import data from "./registry.generated.json";

export type ChainKey = "solana" | "robinhood" | "base";
export type Issuer = "xStocks" | "Ondo" | "Robinhood" | "Coinbase";

export type Pool = {
  address: `0x${string}`;
  dex: string;
  name: string;
  token0: `0x${string}`;
  token1: `0x${string}`;
  liquidityUsdAtBuild: number;
};

export type Venue = {
  issuer: Issuer;
  chain: ChainKey;
  symbol: string;
  address: string;
  decimals: number;
  multiplierModel: "token2022-scaledUiAmount" | "erc8056-uiMultiplier" | "b20-uiMultiplier";
  tokenProgram?: string;
  isin?: string | null;
  chainlinkFeed?: `0x${string}` | null;
  pool?: Pool | null;
};

export type Asset = { ticker: string; name: string; venues: Venue[] };

export const registry = data as unknown as { generatedAt: string; assets: Asset[] };
export const assets: Asset[] = registry.assets;

export function getAsset(ticker: string): Asset | undefined {
  return assets.find((a) => a.ticker === ticker.toUpperCase());
}

export function venueKey(v: Pick<Venue, "chain" | "address">) {
  return `${v.chain}:${v.address}`;
}

export const CHAIN_LABEL: Record<ChainKey, string> = {
  solana: "Solana",
  robinhood: "Robinhood Chain",
  base: "Base",
};

// Stablecoins each chain settles in. Verified in RESEARCH.md.
export const STABLES = {
  solana: { symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  base: { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  robinhood: { symbol: "USDG", address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", decimals: 6 },
} as const;

export const EXPLORER: Record<ChainKey, { tx: (h: string) => string; address: (a: string) => string; token: (a: string) => string }> = {
  solana: {
    tx: (h) => `https://solscan.io/tx/${h}`,
    address: (a) => `https://solscan.io/account/${a}`,
    token: (a) => `https://solscan.io/token/${a}`,
  },
  robinhood: {
    tx: (h) => `https://robinhoodchain.blockscout.com/tx/${h}`,
    address: (a) => `https://robinhoodchain.blockscout.com/address/${a}`,
    token: (a) => `https://robinhoodchain.blockscout.com/token/${a}`,
  },
  base: {
    tx: (h) => `https://basescan.org/tx/${h}`,
    address: (a) => `https://basescan.org/address/${a}`,
    token: (a) => `https://basescan.org/token/${a}`,
  },
};
