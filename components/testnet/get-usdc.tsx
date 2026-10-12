"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, encodeFunctionData, encodePacked, formatUnits, http, parseEther, type Address } from "viem";
import { useEvmTx } from "../use-evm-tx";
import { TxStatus } from "./test-trade";
import { DESK, FAUCETS, RH_TEST_USDC, RH_TEST_WETH, SYNTHRA, TEST_CHAIN_LABEL, robinhoodTestnet } from "@/lib/testnet";

const client = createPublicClient({ chain: robinhoodTestnet, transport: http() });

const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [{ name: "path", type: "bytes" }, { name: "amountIn", type: "uint256" }],
    outputs: [{ name: "amountOut", type: "uint256" }, { type: "uint160[]" }, { type: "uint32[]" }, { type: "uint256" }],
  },
] as const;

const routerAbi = [
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

const PATH = encodePacked(["address", "uint24", "address"], [RH_TEST_WETH.address, SYNTHRA.ethUsdcFee, RH_TEST_USDC.address]);

/** Swaps a little test ETH for Robinhood Chain Testnet USDC on Synthra, the only source of that USDC. */
export function GetTestUsdc() {
  const { address } = useAccount();
  const { run, state, reset } = useEvmTx();
  const [eth, setEth] = useState("0.002");
  const [toDesk, setToDesk] = useState(false);
  // The latest quote, tagged with the amount it was for, so a stale one is never shown.
  const [quote, setQuote] = useState<{ amount: bigint; out: bigint | null; error: string | null } | null>(null);

  const amountIn = useMemo(() => {
    try {
      const v = parseEther(eth || "0");
      return v > BigInt(0) ? v : null;
    } catch {
      return null;
    }
  }, [eth]);

  useEffect(() => {
    if (!amountIn) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await client.simulateContract({ address: SYNTHRA.quoter, abi: quoterAbi, functionName: "quoteExactInput", args: [PATH, amountIn] });
        if (live) setQuote({ amount: amountIn, out: r.result[0], error: null });
      } catch {
        if (live) setQuote({ amount: amountIn, out: null, error: "Synthra has no quote for that amount right now. Try a smaller one." });
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [amountIn]);

  const current = quote && amountIn && quote.amount === amountIn ? quote : null;
  const out = current?.out ?? null;
  const quoteError = current?.error ?? null;

  const recipient = (toDesk && DESK.address ? DESK.address : address) as Address | undefined;

  async function swap() {
    if (!amountIn || !out || !recipient) return;
    const minOut = (out * BigInt(95)) / BigInt(100);
    const call = encodeFunctionData({
      abi: routerAbi,
      functionName: "exactInput",
      args: [{ path: PATH, recipient, amountIn, amountOutMinimum: minOut }],
    });
    // Called directly: the router wraps the ETH sent with the call, and the 5% minimum protects the fill.
    await run({ chainId: robinhoodTestnet.id, chainName: TEST_CHAIN_LABEL.robinhood, to: SYNTHRA.router, data: call, value: amountIn.toString() });
  }

  return (
    <div id="get-usdc" className="panel p-5 scroll-mt-24">
      <div className="font-medium">Get test USDC on Robinhood Chain Testnet</div>
      <p className="small muted mt-1 max-w-2xl">
        No faucet hands out this USDC. The only source is Synthra, a testnet exchange, so this swaps a little of your faucet ETH for it. Synthra&apos;s rate is an
        arbitrary testnet number, not a real price. Fairtape never uses it to price anything; it only gets you test USDC to try buying stocks and paying links.
      </p>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-4 items-end">
        <label className="grid gap-1">
          <span className="small muted">
            Test ETH to swap ·{" "}
            <a className="underline hover:text-text" href={FAUCETS.robinhood} target="_blank" rel="noreferrer">
              need test ETH? Free faucet ↗
            </a>
          </span>
          <input className="input num" inputMode="decimal" value={eth} onChange={(e) => setEth(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <div className="small muted num pb-2">
          {quoteError ? <span className="warn">{quoteError}</span> : out !== null ? <>≈ {Number(formatUnits(out, RH_TEST_USDC.decimals)).toFixed(4)} test USDC</> : amountIn ? "Quoting…" : ""}
        </div>
      </div>
      {DESK.address && (
        <label className="flex gap-2 items-start small mt-3">
          <input type="checkbox" checked={toDesk} onChange={(e) => setToDesk(e.target.checked)} className="mt-0.5" />
          <span className="muted">Send the USDC to the Fairtape testnet desk instead of my wallet. The desk pays merchants in USDC when someone pays a link with a stock.</span>
        </label>
      )}
      <button className="btn btn-primary mt-4" disabled={!address || !out || state.step === "working"} onClick={swap}>
        {!address ? "Connect a wallet first" : state.step === "working" ? "Swapping…" : toDesk ? "Swap and send to the desk" : "Swap for test USDC"}
      </button>
      <div className="mt-3">
        <TxStatus state={state} onReset={reset} />
      </div>
    </div>
  );
}
