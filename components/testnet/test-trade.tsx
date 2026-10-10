"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits, type Address, type Hex } from "viem";
import { TEST_STOCKS, RH_TEST_USDC, RH_TEST_WETH, TEST_CHAIN_ID, TEST_EXPLORER } from "@/lib/testnet";
import type { SynthraRoute, SynthraTx } from "@/lib/server/synthra";
import { useTestHoldings } from "../use-test-holdings";
import { useEvmTx } from "../use-evm-tx";
import { WalletBar, openConnect } from "../connect";
import { amount as fmtAmount } from "@/lib/format";

const ETH = "0x0000000000000000000000000000000000000000";
type Side = "buy" | "sell";
type Token = { address: string; symbol: string };

const FUNDING: Token[] = [
  { address: ETH, symbol: "ETH" },
  { address: RH_TEST_USDC.address, symbol: "USDC" },
  { address: RH_TEST_WETH.address, symbol: "WETH" },
];
const PROCEEDS: Token[] = [
  { address: RH_TEST_USDC.address, symbol: "USDC" },
  { address: RH_TEST_WETH.address, symbol: "WETH" },
];

export function TestTrade({ initialTicker = "TSLA" }: { initialTicker?: string }) {
  const qc = useQueryClient();
  const [side, setSide] = useState<Side>("buy");
  const [ticker, setTicker] = useState(initialTicker);
  const [other, setOther] = useState<string>(ETH);
  const [amountStr, setAmountStr] = useState("0.001");
  const [routes, setRoutes] = useState<SynthraRoute[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const { data, evmAddr } = useTestHoldings();
  const { state, run, reset } = useEvmTx();

  const stock = TEST_STOCKS.find((s) => s.ticker === ticker)!;
  // Buying a stock can also be paid with another stock (stock-to-stock swap).
  const counterOptions: Token[] = side === "buy" ? [...FUNDING, ...TEST_STOCKS.filter((s) => s.ticker !== ticker).map((s) => ({ address: s.address, symbol: s.ticker }))] : PROCEEDS;
  const counter = counterOptions.find((t) => t.address === other) ?? counterOptions[0];
  const tokenIn = side === "buy" ? counter : { address: stock.address, symbol: stock.ticker };
  const tokenOut = side === "buy" ? { address: stock.address, symbol: stock.ticker } : counter;

  const balanceOf = (token: string) =>
    data?.holdings.find((h) => h.chain === "robinhood" && h.token.toLowerCase() === token.toLowerCase())?.amount;
  const inBalance = balanceOf(tokenIn.address);

  const routeKey = (r: SynthraRoute) => `${r.tokens.join("-")}:${r.fees.join("-")}`;

  async function compare() {
    setError(null);
    setRoutes(null);
    reset();
    let raw: bigint;
    try {
      raw = parseUnits(amountStr.trim() || "0", 18);
    } catch {
      return setError("Enter a valid amount.");
    }
    if (raw <= BigInt(0)) return setError("Enter an amount above zero.");
    setLoading(true);
    try {
      const res = await fetch("/api/testnet/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenIn: tokenIn.address, tokenOut: tokenOut.address, amount: raw.toString() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Quote failed");
      setRoutes(json.routes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
    } finally {
      setLoading(false);
    }
  }

  async function execute(r: SynthraRoute) {
    if (!evmAddr) return;
    setExecuting(routeKey(r));
    setError(null);
    // Re-quote this exact path right before signing so the minimum-received reflects current pool state.
    const res = await fetch("/api/testnet/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokenIn: tokenIn.address, tokenOut: tokenOut.address, amount: r.amountIn, recipient: evmAddr, pick: { tokens: r.tokens, fees: r.fees } }),
    }).then((x) => x.json());
    const tx = res.tx as (SynthraTx & { route: SynthraRoute }) | null;
    if (!tx) {
      setExecuting(null);
      setError(res.error || "Route expired, compare again.");
      return;
    }
    const hash = await run({
      chainId: TEST_CHAIN_ID.robinhood,
      chainName: "Robinhood Chain Testnet",
      to: tx.to,
      data: tx.data as Hex,
      value: tx.value,
      approve: tx.approve ? { ...tx.approve, token: tx.approve.token as Address, spender: tx.approve.spender as Address, symbol: tokenIn.symbol } : null,
    });
    setExecuting(null);
    if (hash) void qc.invalidateQueries({ queryKey: ["test-holdings"] });
  }

  const best = routes?.[0];
  const worst = routes && routes.length > 1 ? routes.at(-1) : undefined;
  const out = (r: SynthraRoute) => Number(r.amountOut) / 1e18;
  const gain = useMemo(() => (best && worst ? out(best) - out(worst) : null), [best, worst]);

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <div className="panel p-5 grid gap-4">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-bg border border-line">
          {(["buy", "sell"] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSide(s);
                setOther(s === "buy" ? ETH : RH_TEST_USDC.address);
                setAmountStr(s === "buy" ? "0.001" : "1");
                setRoutes(null);
              }}
              className={`h-9 rounded-lg text-sm capitalize ${side === s ? "bg-panel-2 text-text border border-line" : "text-muted"}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Test stock (Robinhood Chain Testnet)</label>
          <select className="input" value={ticker} onChange={(e) => { setTicker(e.target.value); setRoutes(null); }}>
            {TEST_STOCKS.map((s) => (
              <option key={s.ticker} value={s.ticker}>
                {s.ticker} · {s.name}
                {balanceOf(s.address) ? ` (you hold ${fmtAmount(balanceOf(s.address), 4)})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">{side === "buy" ? "Pay with" : "Receive"}</label>
          <select className="input" value={counter.address} onChange={(e) => { setOther(e.target.value); setRoutes(null); }}>
            {counterOptions.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
                {balanceOf(t.address) != null ? `: ${fmtAmount(balanceOf(t.address), 6)}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between">
            <label className="label">Amount ({tokenIn.symbol})</label>
            {inBalance != null && inBalance > 0 && (
              <button
                className="link-button small"
                // Leave a little ETH behind for gas.
                onClick={() => setAmountStr(String(tokenIn.address === ETH ? Math.max(0, inBalance - 0.0005) : inBalance))}
              >
                Max
              </button>
            )}
          </div>
          <input className="input num" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        </div>

        <button className="btn btn-primary btn-lg" disabled={loading} onClick={compare}>
          {loading ? "Quoting every pool…" : "Compare every pool"}
        </button>
        {error && <p className="small neg">{error}</p>}
        {!evmAddr && (
          <div className="small muted flex items-center justify-between gap-2">
            <span>Preview: real testnet quotes, nothing to sign.</span>
            <WalletBar />
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {!routes && !loading && (
          <div className="panel p-8 text-center muted">
            <div className="text-text font-medium mb-1">
              {side === "buy" ? `Which path gets you the most ${ticker}?` : `Which path pays the most for your ${ticker}?`}
            </div>
            Fairtape checks every Synthra pool on Robinhood Chain Testnet, every fee tier and every two-step path through USDC, WETH and
            TSLA, all in one onchain call. Then it ranks them by what you actually get.
          </div>
        )}
        {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton h-[76px]" />)}
        {routes?.map((r, i) => {
          const key = routeKey(r);
          const isBest = i === 0;
          return (
            <div key={key} className={`panel p-4 ${isBest ? "!border-pos/50" : ""}`}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="chain-dot chain-robinhood" />
                    <span className="font-medium text-sm">{r.label}</span>
                    {isBest && <span className="chip !border-pos/40 pos">BEST PRINT</span>}
                  </div>
                  <div className="small faint mt-1">Synthra V3 · gas ≈ {Number(r.gasEstimate).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="num text-lg">
                    {fmtAmount(out(r), 6)} {tokenOut.symbol}
                  </div>
                  {best && !isBest && (
                    <div className="small neg num">{(((out(r) - out(best)) / out(best)) * 100).toFixed(2)}% vs best</div>
                  )}
                </div>
                <button
                  className={isBest ? "btn btn-primary" : "btn"}
                  disabled={executing !== null}
                  onClick={() => (evmAddr ? execute(r) : openConnect())}
                >
                  {executing === key ? "Executing…" : evmAddr ? "Execute" : "Connect to execute"}
                </button>
              </div>
            </div>
          );
        })}
        {gain != null && gain > 0 && best && (
          <p className="small muted">
            Best path vs worst path: <span className="text-text num">+{fmtAmount(gain, 6)} {tokenOut.symbol}</span> for the same{" "}
            {fmtAmount(Number(best.amountIn) / 1e18, 6)} {tokenIn.symbol}.
          </p>
        )}
        <TxStatus state={state} onReset={reset} />
      </div>
    </div>
  );
}

export function TxStatus({ state, onReset, chain = "robinhood" }: { state: ReturnType<typeof useEvmTx>["state"]; onReset?: () => void; chain?: "robinhood" | "base" }) {
  if (state.step === "idle") return null;
  if (state.step === "error")
    return (
      <div className="panel p-4 !border-neg/40">
        <div className="neg font-medium">Not executed</div>
        <p className="small muted mt-1">{state.message}</p>
        {onReset && <button className="link-button mt-2" onClick={onReset}>Dismiss</button>}
      </div>
    );
  if (state.step === "working")
    return (
      <div className="panel p-4">
        <div className="font-medium flex items-center gap-2">
          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-muted border-t-transparent animate-spin" /> {state.message}
        </div>
      </div>
    );
  return (
    <div className="panel p-4 !border-pos/40">
      <div className="font-medium pos">✓ Settled onchain (testnet)</div>
      <a className="small underline muted hover:text-text mt-2 inline-block" href={TEST_EXPLORER[chain].tx(state.txHash)} target="_blank" rel="noreferrer">
        View transaction on the explorer ↗
      </a>
      {onReset && <button className="link-button mt-3 block" onClick={onReset}>New trade</button>}
    </div>
  );
}
