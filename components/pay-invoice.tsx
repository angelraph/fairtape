"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfig, useAccount } from "wagmi";
import { switchChain, writeContract, waitForTransactionReceipt, getChainId } from "wagmi/actions";
import { erc20Abi, type Address } from "viem";
import type { Invoice } from "@/lib/server/invoices";
import type { LifiQuote } from "@/lib/server/lifi";
import { CHAIN_LABEL, EXPLORER, type ChainKey } from "@/lib/registry";
import { EVM_CHAIN_ID } from "@/lib/chains";
import { useHoldings } from "./use-holdings";
import { useExecute } from "./use-execute";
import { useSolanaWallet } from "./solana-wallet";
import { WalletBar, short } from "./connect";
import { usd, amount as fmtAmount } from "@/lib/format";

type PayQuote = {
  kind: "lifi" | "evm-transfer" | "solana-tx";
  quote?: LifiQuote;
  transaction?: string;
  token?: string;
  to?: string;
  amount?: string;
  fromAmount: string;
  fromSymbol: string;
  fromDecimals: number;
  usdIn: number | null;
  shares?: number | null;
  steps: string[];
  durationSec?: number;
};

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function PayInvoice({ initial, justCreated }: { initial: Invoice; justCreated: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery<{ invoice: Invoice }>({
    queryKey: ["invoice", initial.id],
    queryFn: () => fetch(`/api/invoices/${initial.id}`).then((r) => r.json()),
    initialData: { invoice: initial },
    refetchInterval: (q) => (q.state.data?.invoice.status === "pending" ? 4000 : false),
  });
  const inv = data.invoice;
  const link = useSyncExternalStore(
    () => () => {},
    () => window.location.href.split("?")[0],
    () => "",
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid md:grid-cols-[1fr_440px] gap-8 items-start">
      <div className="panel p-6">
        <div className="small muted">Payment request</div>
        <div className="text-2xl font-semibold mt-1">{inv.merchant_name}</div>
        {inv.memo && <div className="muted mt-1">{inv.memo}</div>}
        <div className="num text-5xl mt-6 tracking-tight">{usd(inv.amount_usd)}</div>
        <div className="flex items-center gap-2 mt-2 small muted">
          <span className={`chain-dot chain-${inv.settle_chain}`} />
          Settles as USDC on {CHAIN_LABEL[inv.settle_chain]} to <span className="num">{short(inv.recipient, 6)}</span>
        </div>
        <div className="mt-6">
          <StatusBadge inv={inv} />
        </div>
        {inv.status === "paid" && (
          <div className="mt-5 grid gap-1.5 small">
            <div className="muted">
              Received <span className="num text-text">{usd(inv.settled_amount)}</span> USDC
              {inv.payer_chain && <> · paid from {CHAIN_LABEL[inv.payer_chain]}</>}
              {inv.payer_asset && <> with {inv.payer_asset}</>}
            </div>
            {inv.source_tx && inv.payer_chain && (
              <a className="underline muted hover:text-text" target="_blank" rel="noreferrer" href={EXPLORER[inv.payer_chain].tx(inv.source_tx)}>
                Payer transaction ↗
              </a>
            )}
            {inv.settle_tx && inv.settle_tx !== inv.source_tx && (
              <a className="underline muted hover:text-text" target="_blank" rel="noreferrer" href={EXPLORER[inv.settle_chain].tx(inv.settle_tx)}>
                Settlement transaction ↗
              </a>
            )}
          </div>
        )}
        {justCreated && inv.status === "open" && (
          <div className="mt-6 panel !bg-bg p-4">
            <div className="small muted mb-2">Share this link with whoever is paying you</div>
            <div className="flex gap-2">
              <input className="input num text-[13px]" readOnly value={link} />
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard.writeText(link).then(() => setCopied(true));
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>
      {inv.status !== "paid" && <Payer inv={inv} onReported={() => qc.invalidateQueries({ queryKey: ["invoice", inv.id] })} />}
    </div>
  );
}

function StatusBadge({ inv }: { inv: Invoice }) {
  if (inv.status === "paid") return <span className="chip !border-pos/40 pos !h-7 !px-3 !text-sm">✓ Paid — verified onchain</span>;
  if (inv.status === "pending")
    return <span className="chip !border-warn/40 warn !h-7 !px-3 !text-sm">Payment in flight — verifying on {CHAIN_LABEL[inv.settle_chain]}…</span>;
  return <span className="chip !h-7 !px-3 !text-sm">Awaiting payment</span>;
}

function Payer({ inv, onReported }: { inv: Invoice; onReported: () => void }) {
  const config = useConfig();
  const evm = useAccount();
  const sol = useSolanaWallet();
  const { data, evmAddr, solAddr, isLoading } = useHoldings();
  const { execute, state } = useExecute();
  const [selected, setSelected] = useState<string>("");
  const [paying, setPaying] = useState(false);
  const [payError, setError] = useState<string | null>(null);

  const options = useMemo(
    () => (data?.holdings ?? []).filter((h) => h.usd == null || h.usd >= inv.amount_usd * 0.5).sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0)),
    [data, inv.amount_usd],
  );
  const choice = options.find((h) => `${h.chain}:${h.token}` === selected) ?? options[0];
  const fromAddress = choice?.chain === "solana" ? solAddr : evmAddr;

  const quoteQuery = useQuery<PayQuote>({
    queryKey: ["pay-quote", inv.id, choice?.chain, choice?.token, fromAddress],
    enabled: Boolean(choice && fromAddress),
    queryFn: async () => {
      const r = await fetch(`/api/invoices/${inv.id}/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromChain: choice!.chain, fromToken: choice!.token, fromAddress }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "No route");
      return json;
    },
    refetchInterval: 30_000,
    retry: false,
  });
  const q = quoteQuery.data ?? null;
  const quoting = quoteQuery.isFetching && !q;
  const error = payError ?? (quoteQuery.error ? quoteQuery.error.message : null);

  async function report(sourceTx: string, payerChain: ChainKey) {
    await fetch(`/api/invoices/${inv.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceTx, payerChain, payerAsset: choice ? `${choice.symbol}${choice.issuer ? ` (${choice.issuer})` : ""}` : "" }),
    });
    onReported();
  }

  async function pay() {
    if (!q || !choice) return;
    setPaying(true);
    setError(null);
    try {
      if (q.kind === "lifi" && q.quote) {
        const res = await execute(q.quote);
        if (res) await report(res.txHash, res.fromChain);
      } else if (q.kind === "evm-transfer") {
        const chainId = EVM_CHAIN_ID.base;
        if (getChainId(config) !== chainId) await switchChain(config, { chainId });
        const hash = await writeContract(config, {
          chainId,
          address: q.token as Address,
          abi: erc20Abi,
          functionName: "transfer",
          args: [q.to as Address, BigInt(q.amount!)],
        });
        await report(hash, "base");
        await waitForTransactionReceipt(config, { chainId, hash });
        onReported();
      } else if (q.kind === "solana-tx" && q.transaction) {
        if (!sol.send) throw new Error("Connect a Solana wallet");
        const sig = await sol.send(b64ToBytes(q.transaction));
        await report(sig, "solana");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/reject|denied|cancel/i.test(msg) ? "You rejected the request in your wallet." : msg.split("\n")[0]);
    } finally {
      setPaying(false);
    }
  }

  const connected = Boolean(evm.address || sol.account);
  const fromAmount = q ? Number(q.fromAmount) / 10 ** q.fromDecimals : null;

  return (
    <div className="panel p-5 grid gap-4">
      <div className="font-medium">Pay with anything you hold</div>
      {!connected && (
        <div className="grid gap-3">
          <p className="small muted">Connect a Solana or Base / Robinhood wallet. Fairtape shows what you hold on all three chains.</p>
          <WalletBar />
        </div>
      )}
      {connected && isLoading && <div className="skeleton h-10" />}
      {connected && !isLoading && options.length === 0 && (
        <p className="small muted">No assets large enough to cover {usd(inv.amount_usd)} were found in your connected wallets.</p>
      )}
      {options.length > 0 && (
        <div>
          <label className="label">Pay with</label>
          <select className="input" value={choice ? `${choice.chain}:${choice.token}` : ""} onChange={(e) => setSelected(e.target.value)}>
            {options.map((h) => (
              <option key={`${h.chain}:${h.token}`} value={`${h.chain}:${h.token}`}>
                {h.symbol}
                {h.issuer ? ` · ${h.issuer}` : ""} on {CHAIN_LABEL[h.chain]} — {fmtAmount(h.amount, 6)}
                {h.usd != null ? ` (${usd(h.usd)})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {quoting && <div className="skeleton h-[74px]" />}
      {q && fromAmount != null && (
        <div className="panel !bg-bg p-4">
          <div className="flex justify-between items-baseline">
            <span className="small muted">You pay</span>
            <span className="num text-lg">
              {fmtAmount(fromAmount, 6)} {q.fromSymbol}
            </span>
          </div>
          {q.shares != null && (
            <div className="flex justify-between small muted mt-1">
              <span>= underlying shares</span>
              <span className="num">{fmtAmount(q.shares, 6)}</span>
            </div>
          )}
          <div className="flex justify-between small muted mt-1">
            <span>Value</span>
            <span className="num">{usd(q.usdIn)}</span>
          </div>
          <div className="flex justify-between small mt-1">
            <span className="muted">{inv.merchant_name} receives</span>
            <span className="num pos">{usd(inv.amount_usd)} USDC</span>
          </div>
          <div className="small faint mt-2">
            {q.steps.join(" → ")}
            {q.durationSec ? ` · ~${Math.max(1, q.durationSec)}s` : ""}
          </div>
        </div>
      )}
      {error && <p className="small neg">{error}</p>}
      {state.step === "error" && <p className="small neg">{state.message}</p>}
      {(state.step === "signing" || state.step === "approving") && <p className="small muted">{state.message}</p>}
      <button className="btn btn-primary btn-lg" disabled={!q || paying || quoting || inv.status === "pending"} onClick={pay}>
        {inv.status === "pending" ? "Verifying payment…" : paying ? "Paying…" : `Pay ${usd(inv.amount_usd)}`}
      </button>
      <p className="small faint">Tokenized stocks are not available to US persons.</p>
    </div>
  );
}
