import "server-only";
import { erc20Abi, formatUnits, parseAbi, type Address } from "viem";
import { rhTestClient, baseSepoliaClient, solanaDevnetRpc } from "./testnet-clients";
import { TEST_STOCKS, TEST_STABLES, RH_TEST_WETH, type TestChain } from "@/lib/testnet";
import { NATIVE_ETH } from "./synthra";

export type TestHolding = {
  chain: TestChain;
  token: string;
  symbol: string;
  decimals: number;
  raw: string;
  amount: number;
  kind: "stock" | "stable" | "native" | "other";
  ticker?: string;
  multiplier?: number; // ERC-8056 uiMultiplier for stock tokens
};

const uiAbi = parseAbi(["function uiMultiplier() view returns (uint256)"]);

async function robinhood(owner: Address): Promise<TestHolding[]> {
  const tokens = [
    ...TEST_STOCKS.map((s) => ({ address: s.address as Address, symbol: s.ticker, kind: "stock" as const, ticker: s.ticker })),
    { address: TEST_STABLES.robinhood.address as Address, symbol: "USDC", kind: "stable" as const, ticker: undefined },
    { address: RH_TEST_WETH.address as Address, symbol: "WETH", kind: "other" as const, ticker: undefined },
  ];
  const [eth, reads] = await Promise.all([
    rhTestClient.getBalance({ address: owner }),
    rhTestClient.multicall({
      allowFailure: true,
      contracts: tokens.flatMap((t) => [
        { address: t.address, abi: erc20Abi, functionName: "balanceOf" as const, args: [owner] as const },
        { address: t.address, abi: uiAbi, functionName: "uiMultiplier" as const },
      ]),
    }),
  ]);
  const out: TestHolding[] = [
    { chain: "robinhood", token: NATIVE_ETH, symbol: "ETH", decimals: 18, raw: eth.toString(), amount: Number(formatUnits(eth, 18)), kind: "native" },
  ];
  tokens.forEach((t, i) => {
    const bal = reads[i * 2];
    const mult = reads[i * 2 + 1];
    if (bal.status !== "success") return;
    out.push({
      chain: "robinhood",
      token: t.address,
      symbol: t.symbol,
      decimals: 18,
      raw: (bal.result as bigint).toString(),
      amount: Number(formatUnits(bal.result as bigint, 18)),
      kind: t.kind,
      ticker: t.ticker,
      multiplier: t.kind === "stock" && mult.status === "success" ? Number(mult.result as bigint) / 1e18 : undefined,
    });
  });
  return out;
}

async function base(owner: Address): Promise<TestHolding[]> {
  const usdc = TEST_STABLES.base;
  const [eth, bal] = await Promise.all([
    baseSepoliaClient.getBalance({ address: owner }),
    baseSepoliaClient.readContract({ address: usdc.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
  ]);
  return [
    { chain: "base", token: NATIVE_ETH, symbol: "ETH", decimals: 18, raw: eth.toString(), amount: Number(formatUnits(eth, 18)), kind: "native" },
    { chain: "base", token: usdc.address, symbol: "USDC", decimals: 6, raw: bal.toString(), amount: Number(formatUnits(bal, 6)), kind: "stable" },
  ];
}

type ParsedTokenAccount = { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } };

async function solana(owner: string): Promise<TestHolding[]> {
  const usdc = TEST_STABLES.solana;
  const [sol, accounts] = await Promise.all([
    solanaDevnetRpc<{ value: number }>("getBalance", [owner, { commitment: "confirmed" }]),
    solanaDevnetRpc<{ value: ParsedTokenAccount[] }>("getTokenAccountsByOwner", [owner, { mint: usdc.address }, { encoding: "jsonParsed", commitment: "confirmed" }]),
  ]);
  const raw = accounts.value.reduce((n, a) => n + BigInt(a.account.data.parsed.info.tokenAmount.amount), BigInt(0));
  return [
    { chain: "solana", token: "11111111111111111111111111111111", symbol: "SOL", decimals: 9, raw: String(sol.value), amount: sol.value / 1e9, kind: "native" },
    { chain: "solana", token: usdc.address, symbol: "USDC", decimals: 6, raw: raw.toString(), amount: Number(formatUnits(raw, 6)), kind: "stable" },
  ];
}

export async function testnetHoldings(evm?: Address, sol?: string) {
  const jobs: [string, Promise<TestHolding[]>][] = [];
  if (evm) jobs.push(["Robinhood Chain Testnet", robinhood(evm)], ["Base Sepolia", base(evm)]);
  if (sol) jobs.push(["Solana Devnet", solana(sol)]);
  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const holdings: TestHolding[] = [];
  const errors: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") holdings.push(...r.value);
    else errors.push(`${jobs[i][0]}: ${r.reason instanceof Error ? r.reason.message.split("\n")[0] : "unavailable"}`);
  });
  return { holdings, errors };
}
