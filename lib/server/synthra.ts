import "server-only";
import { encodeFunctionData, encodePacked, getAddress, parseAbi, type Address, type Hex } from "viem";
import { rhTestClient } from "./testnet-clients";
import { SYNTHRA, TEST_STOCKS, RH_TEST_USDC, RH_TEST_WETH } from "@/lib/testnet";

// Best-route engine for Robinhood Chain Testnet. Every candidate path (each fee tier direct, and two hops through
// USDC / WETH / TSLA) is quoted onchain by Synthra's QuoterV2 in a single multicall, then ranked.

export const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// QuoterV2 functions are nonpayable (they revert internally to measure a swap) but are side-effect free under eth_call,
// so they are typed as view here to batch them through Multicall3.
const quoterAbi = parseAbi([
  "function quoteExactInput(bytes path, uint256 amountIn) view returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
  "function quoteExactOutput(bytes path, uint256 amountOut) view returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)",
]);

const routerAbi = parseAbi([
  "struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }",
  "struct ExactOutputParams { bytes path; address recipient; uint256 amountOut; uint256 amountInMaximum; }",
  "function exactInput(ExactInputParams params) payable returns (uint256 amountOut)",
  "function exactOutput(ExactOutputParams params) payable returns (uint256 amountIn)",
  "function refundETH() payable",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[])",
]);

const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
]);
const factoryAbi = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);

const SLIPPAGE_BPS = BigInt(100); // 1%: testnet pools are thin and other testers trade them

const SYMBOLS: Record<string, string> = Object.fromEntries([
  ...TEST_STOCKS.map((s) => [s.address.toLowerCase(), s.ticker]),
  [RH_TEST_USDC.address.toLowerCase(), "USDC"],
  [RH_TEST_WETH.address.toLowerCase(), "WETH"],
]);

export function symbolOf(token: string) {
  if (token.toLowerCase() === NATIVE_ETH) return "ETH";
  return SYMBOLS[token.toLowerCase()] ?? `${token.slice(0, 6)}…`;
}

export function isKnownToken(token: string) {
  return token.toLowerCase() === NATIVE_ETH || token.toLowerCase() in SYMBOLS;
}

const HUBS = [RH_TEST_USDC.address, RH_TEST_WETH.address, TEST_STOCKS[0].address] as Address[];

type Path = { tokens: Address[]; fees: number[] };

function candidatePaths(tokenIn: Address, tokenOut: Address): Path[] {
  const paths: Path[] = SYNTHRA.fees.map((f) => ({ tokens: [tokenIn, tokenOut], fees: [f] }));
  for (const hub of HUBS) {
    if (hub.toLowerCase() === tokenIn.toLowerCase() || hub.toLowerCase() === tokenOut.toLowerCase()) continue;
    for (const f1 of SYNTHRA.fees) for (const f2 of SYNTHRA.fees) paths.push({ tokens: [tokenIn, hub, tokenOut], fees: [f1, f2] });
  }
  return paths;
}

function encodePath(tokens: Address[], fees: number[]): Hex {
  const types: ("address" | "uint24")[] = [];
  const values: (Address | number)[] = [];
  tokens.forEach((t, i) => {
    types.push("address");
    values.push(t);
    if (i < fees.length) {
      types.push("uint24");
      values.push(fees[i]);
    }
  });
  return encodePacked(types, values);
}

export function describePath(p: Path) {
  const hops = p.fees.map((f, i) => `${symbolOf(p.tokens[i])}→${symbolOf(p.tokens[i + 1])} ${(f / 10000).toFixed(2)}%`);
  return p.tokens.length === 2 ? `Direct pool · ${hops[0]}` : `Via ${symbolOf(p.tokens[1])} · ${hops.join(", ")}`;
}

export type SynthraRoute = {
  label: string;
  tokens: string[];
  fees: number[];
  amountIn: string;
  amountOut: string;
  gasEstimate: string;
};

export type SynthraTx = { to: Address; data: Hex; value: string; approve: { token: Address; spender: Address; amount: string } | null };

function wrapIn(token: string): Address {
  return (token.toLowerCase() === NATIVE_ETH ? RH_TEST_WETH.address : getAddress(token)) as Address;
}

/** Quotes every candidate path for an exact-input swap and returns them best-first. */
export async function quoteExactIn(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<SynthraRoute[]> {
  const a = wrapIn(tokenIn);
  const b = getAddress(tokenOut) as Address;
  if (a.toLowerCase() === b.toLowerCase()) throw new Error("Pick two different tokens");
  const paths = candidatePaths(a, b);
  const results = await rhTestClient.multicall({
    allowFailure: true,
    contracts: paths.map((p) => ({ address: SYNTHRA.quoter as Address, abi: quoterAbi, functionName: "quoteExactInput" as const, args: [encodePath(p.tokens, p.fees), amountIn] as const })),
  });
  const routes: SynthraRoute[] = [];
  results.forEach((r, i) => {
    if (r.status !== "success" || r.result[0] === BigInt(0)) return;
    routes.push({
      label: describePath(paths[i]),
      tokens: paths[i].tokens,
      fees: paths[i].fees,
      amountIn: amountIn.toString(),
      amountOut: r.result[0].toString(),
      gasEstimate: r.result[3].toString(),
    });
  });
  return routes.sort((x, y) => (BigInt(y.amountOut) > BigInt(x.amountOut) ? 1 : -1));
}

/** Quotes every candidate path for an exact-output swap (pay exactly N of tokenOut) and returns the cheapest first. */
export async function quoteExactOut(tokenIn: string, tokenOut: string, amountOut: bigint): Promise<SynthraRoute[]> {
  const a = wrapIn(tokenIn);
  const b = getAddress(tokenOut) as Address;
  const paths = candidatePaths(a, b);
  // Exact-output paths are encoded from tokenOut back to tokenIn.
  const results = await rhTestClient.multicall({
    allowFailure: true,
    contracts: paths.map((p) => ({
      address: SYNTHRA.quoter as Address,
      abi: quoterAbi,
      functionName: "quoteExactOutput" as const,
      args: [encodePath([...p.tokens].reverse(), [...p.fees].reverse()), amountOut] as const,
    })),
  });
  const routes: SynthraRoute[] = [];
  results.forEach((r, i) => {
    if (r.status !== "success" || r.result[0] === BigInt(0)) return;
    routes.push({
      label: describePath(paths[i]),
      tokens: paths[i].tokens,
      fees: paths[i].fees,
      amountIn: r.result[0].toString(),
      amountOut: amountOut.toString(),
      gasEstimate: r.result[3].toString(),
    });
  });
  return routes.sort((x, y) => (BigInt(x.amountIn) > BigInt(y.amountIn) ? 1 : -1));
}

function deadline() {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

/** Builds the router transaction for an exact-input route. Native ETH is wrapped by the router. */
export function buildExactInTx(tokenIn: string, route: SynthraRoute, recipient: string): SynthraTx {
  const amountIn = BigInt(route.amountIn);
  const minOut = (BigInt(route.amountOut) * (BigInt(10000) - SLIPPAGE_BPS)) / BigInt(10000);
  const native = tokenIn.toLowerCase() === NATIVE_ETH;
  const calls: Hex[] = [
    encodeFunctionData({
      abi: routerAbi,
      functionName: "exactInput",
      args: [{ path: encodePath(route.tokens as Address[], route.fees), recipient: getAddress(recipient), amountIn, amountOutMinimum: minOut }],
    }),
  ];
  if (native) calls.push(encodeFunctionData({ abi: routerAbi, functionName: "refundETH" }));
  return {
    to: SYNTHRA.router as Address,
    data: encodeFunctionData({ abi: routerAbi, functionName: "multicall", args: [deadline(), calls] }),
    value: native ? amountIn.toString() : "0",
    approve: native ? null : { token: getAddress(tokenIn) as Address, spender: SYNTHRA.router as Address, amount: amountIn.toString() },
  };
}

/** Builds the router transaction that delivers exactly route.amountOut to recipient (used to pay invoices with stocks). */
export function buildExactOutTx(tokenIn: string, route: SynthraRoute, recipient: string): SynthraTx {
  const maxIn = (BigInt(route.amountIn) * (BigInt(10000) + SLIPPAGE_BPS)) / BigInt(10000);
  const native = tokenIn.toLowerCase() === NATIVE_ETH;
  const calls: Hex[] = [
    encodeFunctionData({
      abi: routerAbi,
      functionName: "exactOutput",
      args: [
        {
          path: encodePath([...route.tokens].reverse() as Address[], [...route.fees].reverse()),
          recipient: getAddress(recipient),
          amountOut: BigInt(route.amountOut),
          amountInMaximum: maxIn,
        },
      ],
    }),
  ];
  if (native) calls.push(encodeFunctionData({ abi: routerAbi, functionName: "refundETH" }));
  return {
    to: SYNTHRA.router as Address,
    data: encodeFunctionData({ abi: routerAbi, functionName: "multicall", args: [deadline(), calls] }),
    value: native ? maxIn.toString() : "0",
    approve: native ? null : { token: getAddress(tokenIn) as Address, spender: SYNTHRA.router as Address, amount: maxIn.toString() },
  };
}

// Pools holding less than this much test USDC are shown but excluded from the spread: one tester's dust sets their price.
const THIN_POOL_USDC = 50;

export type TestTapeRow = {
  ticker: string;
  name: string;
  address: string;
  pools: { fee: number; pool: string; priceUsdc: number; liquidityUsdc: number; thin: boolean }[];
  spreadBps: number | null;
};

/**
 * The testnet tape: every stock/USDC pool at every fee tier, priced from slot0. Same token, different pools, different
 * prices, the fragmentation Fairtape routes around, reproducible with faucet tokens.
 */
export async function testnetTape(): Promise<TestTapeRow[]> {
  const usdc = RH_TEST_USDC.address as Address;
  const pairs = TEST_STOCKS.flatMap((s) => SYNTHRA.fees.map((fee) => ({ s, fee })));
  const pools = await rhTestClient.multicall({
    allowFailure: true,
    contracts: pairs.map(({ s, fee }) => ({ address: SYNTHRA.factory as Address, abi: factoryAbi, functionName: "getPool" as const, args: [s.address, usdc, fee] as const })),
  });
  const live = pairs
    .map((p, i) => ({ ...p, pool: pools[i].status === "success" ? (pools[i].result as Address) : null }))
    .filter((p): p is typeof p & { pool: Address } => Boolean(p.pool) && p.pool !== NATIVE_ETH);
  const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
  const reads = await rhTestClient.multicall({
    allowFailure: true,
    contracts: live.flatMap((p) => [
      { address: p.pool, abi: poolAbi, functionName: "slot0" as const },
      { address: p.pool, abi: poolAbi, functionName: "liquidity" as const },
      { address: p.pool, abi: poolAbi, functionName: "token0" as const },
      { address: usdc, abi: erc20, functionName: "balanceOf" as const, args: [p.pool] as const },
    ]),
  });
  const byTicker = new Map<string, TestTapeRow>(TEST_STOCKS.map((s) => [s.ticker, { ticker: s.ticker, name: s.name, address: s.address, pools: [], spreadBps: null }]));
  live.forEach((p, i) => {
    const [slot0, liq, token0, usdcBal] = reads.slice(i * 4, i * 4 + 4);
    if (slot0.status !== "success" || liq.status !== "success" || token0.status !== "success" || usdcBal.status !== "success") return;
    if ((liq.result as bigint) === BigInt(0)) return;
    const sqrt = Number((slot0.result as unknown as readonly [bigint])[0]) / 2 ** 96;
    const token1PerToken0 = sqrt * sqrt; // both tokens have 18 decimals
    const stockIs0 = (token0.result as string).toLowerCase() === p.s.address.toLowerCase();
    const priceUsdc = stockIs0 ? token1PerToken0 : 1 / token1PerToken0;
    const liquidityUsdc = Number(usdcBal.result as bigint) / 1e18;
    byTicker.get(p.s.ticker)!.pools.push({ fee: p.fee, pool: p.pool, priceUsdc, liquidityUsdc, thin: liquidityUsdc < THIN_POOL_USDC });
  });
  for (const row of byTicker.values()) {
    row.pools.sort((a, b) => b.liquidityUsdc - a.liquidityUsdc);
    const usable = row.pools.filter((p) => !p.thin);
    if (usable.length > 1) {
      const prices = usable.map((p) => p.priceUsdc);
      const lo = Math.min(...prices);
      row.spreadBps = ((Math.max(...prices) - lo) / lo) * 10000;
    }
  }
  return [...byTicker.values()];
}
