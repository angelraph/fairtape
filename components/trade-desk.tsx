"use client";

import { useMemo, useState } from "react";
import { parseUnits } from "viem";
import type { Asset, ChainKey } from "@/lib/registry";
import { STABLES, CHAIN_LABEL } from "@/lib/registry";
import { NATIVE } from "@/lib/native";
import type { RouteResult } from "@/lib/server/routes";
import type { Holding } from "@/lib/server/balances";
import { useHoldings } from "./use-holdings";
import { useExecute } from "./use-execute";
import { ExecStatus } from "./exec-status";
import { usd, amount as fmtAmount } from "@/lib/format";
import { WalletBar, openConnect } from "./connect";

type Side = "buy" | "sell" | "move";
type Source = { chain: ChainKey; token: string; symbol: string; decimals: number; balance?: number; label: string };

// Addresses used only to price routes before a wallet is connected. Nothing is ever signed with them.
const PREVIEW_EVM = "0x1111111111111111111111111111111111111111";
const PREVIEW_SOL = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

const FUNDING: Source[] = (["base", "solana", "robinhood"] as ChainKey[]).flatMap((c) => [
  { chain: c, token: STABLES[c].address, symbol: STABLES[c].symbol, decimals: STABLES[c].decimals, label: `${STABLES[c].symbol} on ${CHAIN_LABEL[c]}` },
  { chain: c, token: NATIVE[c].address, symbol: NATIVE[c].symbol, decimals: NATIVE[c].decimals, label: `${NATIVE[c].symbol} on ${CHAIN_LABEL[c]}` },
]);

function holdingSource(h: Holding): Source {
  return {
    chain: h.chain,
    token: h.token,
    symbol: h.symbol,
    decimals: h.decimals,
    balance: h.amount,
    label: `${h.symbol}${h.issuer ? ` · ${h.issuer}` : ""} on ${CHAIN_LABEL[h.chain]}: ${fmtAmount(h.amount, 6)}`,
  };
}

export function TradeDesk({ assets, initialTicker, initialSide }: { assets: Asset[]; initialTicker: string; initialSide: Side }) {
  const [ticker, setTicker] = useState(initialTicker);
  const [side, setSide] = useState<Side>(initialSide);
  const [sourceKey, setSourceKey] = useState<string>("");
  const [amountStr, setAmountStr] = useState("25");
  const [routes, setRoutes] = useState<RouteResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const { data, evmAddr, solAddr } = useHoldings();
  const { state, execute, reset } = useExecute();

  const asset = assets.find((a) => a.ticker === ticker)!;
  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const connected = Boolean(evmAddr || solAddr);

  const sources: Source[] = useMemo(() => {
    if (side === "buy") {
      const owned = holdings.filter((h) => h.kind !== "stock").map(holdingSource);
      return connected ? owned : FUNDING;
    }
    return holdings.filter((h) => h.kind === "stock" && h.ticker === ticker).map(holdingSource);
  }, [side, holdings, connected, ticker]);

  const source = sources.find((s) => `${s.chain}:${s.token}` === sourceKey) ?? sources[0];

  const targets = useMemo(() => {
    if (!source) return [];
    if (side === "sell") return (["base", "solana", "robinhood"] as ChainKey[]).map((c) => ({ chain: c, token: STABLES[c].address }));
    return asset.venues
      .filter((v) => !(v.chain === source.chain && v.address.toLowerCase() === source.token.toLowerCase()))
      .map((v) => ({ chain: v.chain, token: v.address }));
  }, [side, asset, source]);

  async function compare() {
    if (!source) return;
    setError(null);
    setRoutes(null);
    reset();
    let raw: bigint;
    try {
      raw = parseUnits(amountStr.trim() || "0", source.decimals);
    } catch {
      return setError("Enter a valid amount.");
    }
    if (raw <= BigInt(0)) return setError("Enter an amount above zero.");
    setLoading(true);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: { chain: source.chain, token: source.token, amount: raw.toString() },
          fromAddress: source.chain === "solana" ? solAddr ?? PREVIEW_SOL : evmAddr ?? PREVIEW_EVM,
          toAddresses: { solana: solAddr ?? (connected ? undefined : PREVIEW_SOL), evm: evmAddr ?? (connected ? undefined : PREVIEW_EVM) },
          targets,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Routing failed");
      setRoutes(json.routes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Routing failed");
    } finally {
      setLoading(false);
    }
  }

  async function run(r: RouteResult) {
    if (!source || !r.quote) return;
    setExecuting(`${r.target.chain}:${r.target.token}`);
    // Re-quote right before signing so the transaction reflects current prices.
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: { chain: source.chain, token: source.token, amount: r.quote.action.fromAmount },
        fromAddress: source.chain === "solana" ? solAddr : evmAddr,
        toAddresses: { solana: solAddr, evm: evmAddr },
        targets: [r.target],
      }),
    }).then((x) => x.json());
    const fresh: RouteResult | undefined = res.routes?.[0];
    if (!fresh?.ok || !fresh.quote) {
      setExecuting(null);
      setError(fresh?.error || res.error || "Route expired, compare again.");
      return;
    }
    await execute(fresh.quote);
    setExecuting(null);
  }

  const best = routes?.find((r) => r.ok);
  const canExecute = (r: RouteResult) =>
    connected && source && (source.chain === "solana" ? Boolean(solAddr) : Boolean(evmAddr)) && (r.target.chain === "solana" ? Boolean(solAddr) : Boolean(evmAddr));

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <div className="panel p-5 grid gap-4">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-bg border border-line">
          {(["buy", "sell", "move"] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSide(s);
                setRoutes(null);
                setSourceKey("");
              }}
              className={`h-9 rounded-lg text-sm capitalize ${side === s ? "bg-panel-2 text-text border border-line" : "text-muted"}`}
            >
              {s === "move" ? "Switch issuer" : s}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Stock</label>
          <select className="input" value={ticker} onChange={(e) => { setTicker(e.target.value); setRoutes(null); }}>
            {assets.map((a) => (
              <option key={a.ticker} value={a.ticker}>{a.ticker} · {a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">{side === "buy" ? "Pay with" : side === "sell" ? "Sell from" : "Move from"}</label>
          {sources.length ? (
            <select className="input" value={source ? `${source.chain}:${source.token}` : ""} onChange={(e) => { setSourceKey(e.target.value); setRoutes(null); }}>
              {sources.map((s) => (
                <option key={`${s.chain}:${s.token}`} value={`${s.chain}:${s.token}`}>{s.label}</option>
              ))}
            </select>
          ) : (
            <div className="small muted panel !bg-bg p-3">
              {connected ? `No ${side === "buy" ? "funds" : ticker + " tokens"} found in your connected wallets.` : "Connect a wallet to use your holdings."}
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between">
            <label className="label">Amount{source ? ` (${source.symbol})` : ""}</label>
            {source?.balance != null && (
              <button className="link-button small" onClick={() => setAmountStr(String(source.balance))}>Max</button>
            )}
          </div>
          <input className="input num" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        </div>

        <button className="btn btn-primary btn-lg" disabled={loading} onClick={source ? compare : connected ? () => setError(`You don't hold any ${ticker} yet. Switch to Buy.`) : openConnect}>
          {loading ? "Asking every venue…" : source ? "Compare every venue" : connected ? "Compare every venue" : "Connect a wallet"}
        </button>
        {error && <p className="small neg">{error}</p>}
        {!connected && (
          <div className="small muted flex items-center justify-between gap-2">
            <span>Preview mode: real quotes, nothing to sign.</span>
            <WalletBar />
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {!routes && !loading && (
          <div className="panel p-8 text-center muted">
            <div className="text-text font-medium mb-1">
              {side === "buy" && `Which ${ticker} gives you the most real shares?`}
              {side === "sell" && `Where does your ${ticker} fetch the most dollars?`}
              {side === "move" && `Move your ${ticker} to another issuer or chain`}
            </div>
            Fairtape asks LI.FI for an executable route to every venue, then ranks them by value delivered per underlying share,
            after fees, bridges and each issuer&apos;s multiplier.
          </div>
        )}
        {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton h-[92px]" />)}
        {routes?.map((r) => {
          const isBest = r === best;
          const key = `${r.target.chain}:${r.target.token}`;
          return (
            <div key={key} className={`panel p-4 ${isBest ? "!border-pos/50" : ""} ${!r.ok ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`chain-dot chain-${r.target.chain}`} />
                    <span className="font-medium">{r.label}</span>
                    {isBest && <span className="chip !border-pos/40 pos">BEST PRINT</span>}
                  </div>
                  {r.ok ? (
                    <div className="small muted mt-1">
                      {r.steps?.join(" → ") || "Direct"} · ~{Math.max(1, r.durationSec ?? 0)}s
                    </div>
                  ) : (
                    <div className="small neg mt-1">{r.error}</div>
                  )}
                </div>
                {r.ok && (
                  <div className="text-right">
                    <div className="num text-lg">
                      {r.shares != null ? `${fmtAmount(r.shares, 6)} sh` : `${fmtAmount(Number(r.toAmount) / 10 ** (r.toDecimals ?? 6), 4)} ${r.toSymbol}`}
                    </div>
                    <div className="small muted num">
                      ≈ {usd(r.usdOut)} · cost {r.costBps != null ? `${r.costBps.toFixed(1)} bp` : "n/a"}
                    </div>
                  </div>
                )}
                {r.ok && (
                  <button
                    className={isBest ? "btn btn-primary" : "btn"}
                    disabled={executing !== null}
                    onClick={() => (canExecute(r) ? run(r) : openConnect())}
                  >
                    {executing === key ? "Executing…" : canExecute(r) ? "Execute" : "Connect to execute"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {routes && best && routes.filter((r) => r.ok).length > 1 && (
          <p className="small muted">
            Choosing the best print instead of the worst saves{" "}
            <span className="text-text num">
              {usd((best.usdOut ?? 0) - (routes.filter((r) => r.ok).at(-1)!.usdOut ?? 0))}
            </span>{" "}
            on this trade.
          </p>
        )}
        <ExecStatus state={state} onReset={reset} />
      </div>
    </div>
  );
}
