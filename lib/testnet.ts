import { defineChain } from "viem";
import { baseSepolia } from "viem/chains";

// Testnet mode: every transaction runs on free faucet tokens. All addresses verified onchain on 2026-10-07 (RESEARCH.md §6).

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC || "https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

export { baseSepolia };

export const BASE_SEPOLIA_RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org";
export const SOLANA_DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC || "https://api.devnet.solana.com";

export type TestChain = "robinhood" | "base" | "solana";

export const TEST_CHAIN_LABEL: Record<TestChain, string> = {
  robinhood: "Robinhood Chain Testnet",
  base: "Base Sepolia",
  solana: "Solana Devnet",
};

export const TEST_CHAIN_ID = { robinhood: robinhoodTestnet.id, base: baseSepolia.id } as const;

// Official Robinhood test stock tokens (the "Stock" beacon proxies the faucet hands out). ERC-8056, 18 decimals.
export const TEST_STOCKS = [
  { ticker: "TSLA", name: "Tesla", address: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E" },
  { ticker: "AMZN", name: "Amazon", address: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02" },
  { ticker: "AMD", name: "AMD", address: "0x71178BAc73cBeb415514eB542a8995b82669778d" },
  { ticker: "PLTR", name: "Palantir", address: "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0" },
  { ticker: "NFLX", name: "Netflix", address: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93" },
] as const satisfies readonly { ticker: string; name: string; address: `0x${string}` }[];

export type TestStock = (typeof TEST_STOCKS)[number];

// Synthra V3 (Uniswap v3 fork) — the DEX with liquidity for the test stocks on Robinhood Chain Testnet.
export const SYNTHRA = {
  factory: "0x911b4000D3422F482F4062a913885f7b035382Df",
  router: "0x3Ce954107b1A675826B33bF23060Dd655e3758fE", // SwapRouter02 interface
  quoter: "0x231606c321A99DE81e28fE48B07a93F1ba49e713", // QuoterV2
  fees: [500, 3000, 10000],
} as const;

export const RH_TEST_USDC = { symbol: "USDC", address: "0xbf4479C07Dc6fdc6dAa764A0ccA06969e894275F", decimals: 18 } as const;
export const RH_TEST_WETH = { symbol: "WETH", address: "0x33e4191705c386532ba27cBF171Db86919200B94", decimals: 18 } as const;

// USDC each testnet settles in. Base Sepolia + Solana Devnet are Circle's (faucet.circle.com).
export const TEST_STABLES: Record<TestChain, { symbol: string; address: string; decimals: number }> = {
  robinhood: RH_TEST_USDC,
  base: { symbol: "USDC", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
  solana: { symbol: "USDC", address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
};

export const TEST_EXPLORER: Record<TestChain, { tx: (h: string) => string; address: (a: string) => string }> = {
  robinhood: {
    tx: (h) => `https://explorer.testnet.chain.robinhood.com/tx/${h}`,
    address: (a) => `https://explorer.testnet.chain.robinhood.com/address/${a}`,
  },
  base: {
    tx: (h) => `https://sepolia.basescan.org/tx/${h}`,
    address: (a) => `https://sepolia.basescan.org/address/${a}`,
  },
  solana: {
    tx: (h) => `https://explorer.solana.com/tx/${h}?cluster=devnet`,
    address: (a) => `https://explorer.solana.com/address/${a}?cluster=devnet`,
  },
};

export const FAUCETS = {
  robinhood: "https://faucet.testnet.chain.robinhood.com",
  circle: "https://faucet.circle.com",
  baseEth: "https://portal.cdp.coinbase.com/products/faucet",
  solana: "https://faucet.solana.com",
};
