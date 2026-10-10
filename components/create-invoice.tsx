"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useSolanaWallet } from "./solana-wallet";
import { TEST_CHAIN_LABEL } from "@/lib/testnet";

type Network = "mainnet" | "testnet";
type Chain = "base" | "solana" | "robinhood";

const CHAINS: Record<Network, { value: Chain; label: string }[]> = {
  mainnet: [
    { value: "base", label: "Base" },
    { value: "solana", label: "Solana" },
  ],
  testnet: [
    { value: "robinhood", label: TEST_CHAIN_LABEL.robinhood },
    { value: "base", label: TEST_CHAIN_LABEL.base },
    { value: "solana", label: TEST_CHAIN_LABEL.solana },
  ],
};

export function CreateInvoice({ initialNetwork = "mainnet" }: { initialNetwork?: Network }) {
  const router = useRouter();
  const evm = useAccount();
  const sol = useSolanaWallet();
  const [network, setNetwork] = useState<Network>(initialNetwork);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState(initialNetwork === "testnet" ? "1" : "50");
  const [chain, setChain] = useState<Chain>(initialNetwork === "testnet" ? "robinhood" : "base");
  // null = untouched, so the field follows whichever wallet is connected for the chosen chain.
  const [typedRecipient, setRecipient] = useState<string | null>(null);
  const recipient = typedRecipient ?? (chain === "solana" ? sol.account?.address : evm.address) ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chainLabel = CHAINS[network].find((c) => c.value === chain)?.label ?? chain;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ network, merchantName: name, memo, amountUsd: Number(amount), settleChain: chain, recipient }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    router.push(`/pay/${json.id}?created=1`);
  }

  return (
    <form onSubmit={submit} className="panel p-5 grid gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-bg border border-line">
        {(["mainnet", "testnet"] as Network[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setNetwork(n);
              setChain(CHAINS[n][0].value);
              setRecipient(null);
              if (n === "testnet") setAmount("1");
            }}
            className={`h-9 rounded-lg text-sm ${network === n ? "bg-panel-2 text-text border border-line" : "text-muted"}`}
          >
            {n === "mainnet" ? "Mainnet" : "Testnet ($0)"}
          </button>
        ))}
      </div>
      {network === "testnet" && (
        <p className="small warn -mt-1">Uses free test USDC from the faucets. The transactions are real, the money isn&apos;t.</p>
      )}
      <div>
        <label className="label">Your name or business</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya Okafor Design" required />
      </div>
      <div>
        <label className="label">What it&apos;s for (optional)</label>
        <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Logo design, invoice #014" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount ({network === "testnet" ? "test USDC" : "USD"})</label>
          <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Receive USDC on</label>
          <select
            className="input"
            value={chain}
            onChange={(e) => {
              setChain(e.target.value as Chain);
              setRecipient(null);
            }}
          >
            {CHAINS[network].map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Your {chainLabel} address</label>
        <input
          className="input num text-[13px]"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={chain === "solana" ? "Solana address" : "0x…"}
          required
        />
        <p className="small faint mt-1">Funds go straight to this address. Fairtape never holds them.</p>
      </div>
      {error && <p className="small neg">{error}</p>}
      <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Creating…" : network === "testnet" ? "Create test pay link" : "Create pay link"}</button>
    </form>
  );
}
