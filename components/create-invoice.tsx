"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useSolanaWallet } from "./solana-wallet";

export function CreateInvoice() {
  const router = useRouter();
  const evm = useAccount();
  const sol = useSolanaWallet();
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("50");
  const [chain, setChain] = useState<"base" | "solana">("base");
  // null = untouched, so the field follows whichever wallet is connected for the chosen chain.
  const [typedRecipient, setRecipient] = useState<string | null>(null);
  const recipient = typedRecipient ?? (chain === "base" ? evm.address : sol.account?.address) ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ merchantName: name, memo, amountUsd: Number(amount), settleChain: chain, recipient }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    router.push(`/pay/${json.id}?created=1`);
  }

  return (
    <form onSubmit={submit} className="panel p-5 grid gap-4">
      <div>
        <label className="label">Your name or business</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya Okafor Design" required />
      </div>
      <div>
        <label className="label">What it&apos;s for (optional)</label>
        <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Logo design — invoice #014" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (USD)</label>
          <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Receive USDC on</label>
          <select
            className="input"
            value={chain}
            onChange={(e) => {
              setChain(e.target.value as "base" | "solana");
              setRecipient(null);
            }}
          >
            <option value="base">Base</option>
            <option value="solana">Solana</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Your {chain === "base" ? "Base" : "Solana"} address</label>
        <input className="input num text-[13px]" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={chain === "base" ? "0x…" : "Solana address"} required />
        <p className="small faint mt-1">Funds go straight to this address. Fairtape never holds them.</p>
      </div>
      {error && <p className="small neg">{error}</p>}
      <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Creating…" : "Create pay link"}</button>
    </form>
  );
}
