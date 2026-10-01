"use client";

import { EXPLORER, CHAIN_LABEL } from "@/lib/registry";
import type { ExecState } from "./use-execute";

export function ExecStatus({ state, onReset }: { state: ExecState; onReset?: () => void }) {
  if (state.step === "idle") return null;
  if (state.step === "error")
    return (
      <div className="panel p-4 !border-neg/40">
        <div className="neg font-medium">Not executed</div>
        <p className="small muted mt-1">{state.message}</p>
        {onReset && <button className="link-button mt-2" onClick={onReset}>Dismiss</button>}
      </div>
    );
  if (state.step === "approving" || state.step === "signing")
    return (
      <div className="panel p-4">
        <div className="font-medium flex items-center gap-2"><Spinner /> {state.message}</div>
      </div>
    );
  const done = state.step === "done";
  return (
    <div className={`panel p-4 ${done ? "!border-pos/40" : ""}`}>
      <div className="font-medium flex items-center gap-2">
        {done ? <span className="pos">✓ Settled onchain</span> : <><Spinner /> {state.step === "bridging" ? state.message : "Submitted"}</>}
      </div>
      <div className="small mt-2 grid gap-1">
        <a className="underline muted hover:text-text" href={EXPLORER[state.fromChain].tx(state.txHash)} target="_blank" rel="noreferrer">
          Source transaction on {CHAIN_LABEL[state.fromChain]} ↗
        </a>
        {done && state.receivingTxHash && state.receivingTxHash !== state.txHash && (
          <a className="underline muted hover:text-text" href={EXPLORER[state.toChain].tx(state.receivingTxHash)} target="_blank" rel="noreferrer">
            Delivery transaction on {CHAIN_LABEL[state.toChain]} ↗
          </a>
        )}
      </div>
      {done && onReset && <button className="link-button mt-3" onClick={onReset}>New trade</button>}
    </div>
  );
}

function Spinner() {
  return <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-muted border-t-transparent animate-spin" />;
}
