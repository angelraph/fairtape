"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits, type Address, type Hex } from "viem";
import { TEST_STOCKS, RH_TEST_USDC, TEST_CHAIN_ID, TEST_EXPLORER } from "@/lib/testnet";
import type { DeskQuote } from "@/lib/server/desk";
import { useTestHoldings } from "../use-test-holdings";
import { useEvmTx } from "../use-evm-tx";
import { WalletBar, openConnect } from "../connect";
import { amount as fmtAmount, usd } from "@/lib/format";
import { useDesk, priceOf } from "./use-desk";

const ETH = "0x0000000000000000000000000000000000000000";
type Side = "buy" | "sell";
type Token = { address: string; symbol: string };

const FUNDING: Token[] = [
  { address: ETH, symbol: "ETH" },
  { address: RH_TEST_USDC.address, symbol: "USDC" },
];
const PROCEEDS: Token[] = [
  { address: RH_TEST_USDC.address, symbol: "USDC" },
  { address: ETH, symbol: "ETH" },
];

function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function TestTrade({ initialTicker = "TSLA" }: { initialTicker?: string }) {
  const qc = useQueryClient();
  const [side, setSide] = useState<Side>("buy");
  const [ticker, setTicker] = useState(initialTicker);
  const [other, setOther] = useState<string>(RH_TEST_USDC.address);
  const [amountStr, setAmountStr] = useState("1");
  const [quote, setQuote] = useState<DeskQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const { data, evmAddr } = useTestHoldings();
  const { data: desk } = useDesk();
  const { state, run, reset } = useEvmTx();

  const stock = TEST_STOCKS.find((s) => s.ticker === ticker)!;
  // Buying a stock can also be paid with another stock (stock-to-stock at both market prices).
  const counterOptions: Token[] = side === "buy" ? [...FUNDING, ...TEST_STOCKS.filter((s) => s.ticker !== ticker).map((s) => ({ address: s.address, symbol: s.ticker }))] : PROCEEDS;
  const counter = counterOptions.find((t) => t.address === other) ?? counterOptions[0];
  const tokenIn = side === "buy" ? counter : { address: stock.address, symbol: stock.ticker };
  const tokenOut = side === "buy" ? { address: stock.address, symbol: stock.ticker } : counter;

  const balanceOf = (token: string) => data?.holdings.find((h) => h.chain === "robinhood" && h.token.toLowerCase() === token.toLowerCase())?.amount;
  const inBalance = balanceOf(tokenIn.address);
  const stockPrice = priceOf(desk, stock.address)?.price;
  const inPrice = priceOf(desk, tokenIn.address)?.price;
  const typed = Number(amountStr);
  const typedUsd = inPrice && typed > 0 ? typed * inPrice.usd : null;

  function parsed(): bigint | null {
    try {
      const raw = parseUnits(amountStr.trim() || "0", 18);
      return raw > BigInt(0) ? raw : null;
    } catch {
      return null;
    }
  }

  async function getQuote(recipient?: string): Promise<DeskQuote | null> {
    const raw = parsed();
    if (!raw) {
      setError("Enter an amount above zero.");
      return null;
    }
    const res = await fetch("/api/testnet/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokenIn: tokenIn.address, tokenOut: tokenOut.address, amount: raw.toString(), mode: "exactIn", recipient }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Quote failed");
    return json.quote;
  }

  async function preview() {
    setError(null);
    setQuote(null);
    reset();
    setLoading(true);
    try {
      setQuote(await getQuote());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote failed");
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    if (!evmAddr) return openConnect();
    setExecuting(true);
    setError(null);
    try {
      // Fresh signed quote right before signing, so the price is the live one.
      const q = await getQuote(evmAddr);
      if (!q?.tx) throw new Error("Couldn't prepare the trade. Try again.");
      if (!q.enoughInventory) throw new Error(`The desk only holds ${fmtAmount(Number(q.inventoryOut) / 1e18, 6)} ${q.symbolOut} right now. Try a smaller amount.`);
      setQuote(q);
      const hash = await run({
        chainId: TEST_CHAIN_ID.robinhood,
        chainName: "Robinhood Chain Testnet",
        to: q.tx.to,
        data: q.tx.data as Hex,
        value: q.tx.value,
        approve: q.tx.approve ? { ...q.tx.approve, token: q.tx.approve.token as Address, spender: q.tx.approve.spender as Address, symbol: q.symbolIn } : null,
      });
      if (hash) {
        void qc.invalidateQueries({ queryKey: ["test-holdings"] });
        void qc.invalidateQueries({ queryKey: ["desk"] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setExecuting(false);
    }
  }

  const amountIn = quote ? Number(quote.amountIn) / 1e18 : null;
  const amountOut = quote ? Number(quote.amountOut) / 1e18 : null;

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <div className="panel p-5 grid gap-4">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-bg border border-line">
          {(["buy", "sell"] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSide(s);
                setOther(RH_TEST_USDC.address);
                setAmountStr(s === "buy" ? "1" : "0.002");
                setQuote(null);
              }}
              className={`h-9 rounded-lg text-sm capitalize ${side === s ? "bg-panel-2 text-text border border-line" : "text-muted"}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Stock</label>
          <select className="input" value={ticker} onChange={(e) => { setTicker(e.target.value); setQuote(null); }}>
            {TEST_STOCKS.map((s) => {
              const p = priceOf(desk, s.address)?.price;
              return (
                <option key={s.ticker} value={s.ticker}>
                  {s.ticker} · {s.name}
                  {p ? ` · ${usd(p.usd)}` : ""}
                  {balanceOf(s.address) ? ` (you hold ${fmtAmount(balanceOf(s.address), 4)})` : ""}
                </option>
              );
            })}
          </select>
          {stockPrice && (
            <p className="small muted mt-1.5">
              Live price {usd(stockPrice.usd)} from {stockPrice.source}, updated {ago(stockPrice.asOf)}.
            </p>
          )}
        </div>

        <div>
          <label className="label">{side === "buy" ? "Pay with" : "Receive"}</label>
          <select className="input" value={counter.address} onChange={(e) => { setOther(e.target.value); setQuote(null); }}>
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
          <input className="input num" inputMode="decimal" value={amountStr} onChange={(e) => { setAmountStr(e.target.value); setQuote(null); }} />
          {typedUsd != null && <p className="small muted mt-1.5 num">≈ {usd(typedUsd)} at the market price</p>}
        </div>

        <button className="btn btn-primary btn-lg" disabled={loading || executing} onClick={preview}>
          {loading ? "Getting the market price…" : "Get the market price"}
        </button>
        {error && <p className="small neg">{error}</p>}
        {!evmAddr && (
          <div className="small muted flex items-center justify-between gap-2">
            <span>Preview with live prices. Connect to trade.</span>
            <WalletBar />
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {!quote && !loading && (
          <div className="panel p-8 text-center muted">
            <div className="text-text font-medium mb-1">Trade at the real market price, with free test tokens</div>
            On testnet, Fairtape&apos;s desk fills every trade at the live price of the real stock, read from Robinhood&apos;s market data
            and checked against xStocks on Solana. The tokens are free test tokens, but the price is the real one.
          </div>
        )}
        {loading && <div className="skeleton h-[180px]" />}
        {quote && amountIn != null && amountOut != null && (
          <div className="panel p-5 !border-pos/40">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="panel !bg-bg p-4">
                <div className="label">You pay</div>
                <div className="num text-2xl">
                  {fmtAmount(amountIn, 6)} {quote.symbolIn}
                </div>
                <div className="small muted num">{usd(amountIn * quote.priceIn.usd)}</div>
              </div>
              <div className="panel !bg-bg p-4">
                <div className="label">You get</div>
                <div className="num text-2xl pos">
                  {fmtAmount(amountOut, 6)} {quote.symbolOut}
                </div>
                <div className="small muted num">{usd(amountOut * quote.priceOut.usd)}</div>
              </div>
            </div>
            <ul className="small muted mt-4 grid gap-1">
              <li>
                {quote.symbolIn} at {usd(quote.priceIn.usd)} · {quote.priceIn.source}
              </li>
              <li>
                {quote.symbolOut} at {usd(quote.priceOut.usd)} · {quote.priceOut.source}
              </li>
              <li>
                Filled by the Fairtape testnet desk at exactly these prices, with no spread.{" "}
                {quote.enoughInventory ? (
                  <>The desk holds {fmtAmount(Number(quote.inventoryOut) / 1e18, 6)} {quote.symbolOut}.</>
                ) : (
                  <span className="warn">The desk only holds {fmtAmount(Number(quote.inventoryOut) / 1e18, 6)} {quote.symbolOut}, so try a smaller amount.</span>
                )}
              </li>
            </ul>
            <button className="btn btn-primary btn-lg mt-5 w-full" disabled={executing || !quote.enoughInventory} onClick={execute}>
              {executing ? "Trading…" : evmAddr ? "Trade at these prices" : "Connect to trade"}
            </button>
          </div>
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
