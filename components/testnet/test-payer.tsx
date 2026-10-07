"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import type { Invoice } from "@/lib/server/invoices";
import type { SynthraTx } from "@/lib/server/synthra";
import { TEST_CHAIN_LABEL, TEST_STABLES } from "@/lib/testnet";
import { useTestHoldings } from "../use-test-holdings";
import { useEvmTx, friendlyError, type EvmTx } from "../use-evm-tx";
import { useSolanaWallet } from "../solana-wallet";
import { WalletBar } from "../connect";
import { TxStatus } from "./test-trade";
import { amount as fmtAmount } from "@/lib/format";

type Quote = {
  kind: "evm-transfer" | "evm-tx" | "solana-tx";
  chainId?: EvmTx["chainId"];
  chainName?: string;
  token?: string;
  to?: string;
  amount?: string;
  tx?: SynthraTx;
  transaction?: string;
  fromAmount: string;
  fromSymbol: string;
  fromDecimals: number;
  steps: string[];
  alternatives?: number;
};

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function TestPayer({ inv, onReported }: { inv: Invoice; onReported: () => void }) {
  const sol = useSolanaWallet();
  const { data, evmAddr, solAddr, isLoading } = useTestHoldings();
  const { state, run } = useEvmTx();
  const [selected, setSelected] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setError] = useState<string | null>(null);
  const chain = inv.settle_chain;
  const stable = TEST_STABLES[chain];

  // On Robinhood Chain Testnet any stock, ETH or WETH can pay (sold via Synthra). Solana Devnet links can also be paid
  // with Base Sepolia USDC through Circle CCTP. Otherwise: USDC on the settlement chain.
  const options = useMemo(
    () =>
      (data?.holdings ?? []).filter((h) => {
        if (h.amount <= 0) return false;
        if (chain === "solana" && h.chain === "base") return h.token.toLowerCase() === TEST_STABLES.base.address.toLowerCase() && h.amount > inv.amount_usd;
        if (h.chain !== chain) return false;
        return h.token.toLowerCase() === stable.address.toLowerCase() ? h.amount >= inv.amount_usd : chain === "robinhood";
      }),
    [data, chain, stable.address, inv.amount_usd],
  );
  const choice = options.find((h) => `${h.chain}:${h.token}` === selected) ?? options[0];
  const payChain = choice?.chain ?? chain;
  const fromAddress = payChain === "solana" ? solAddr : evmAddr;

  const quoteQuery = useQuery<Quote>({
    queryKey: ["test-pay-quote", inv.id, payChain, choice?.token, fromAddress],
    enabled: Boolean(choice && fromAddress),
    queryFn: async () => {
      const r = await fetch(`/api/invoices/${inv.id}/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromChain: payChain, fromToken: choice!.token, fromAddress }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "No route");
      return json;
    },
    refetchInterval: 30_000,
    retry: false,
  });
  const q = quoteQuery.data ?? null;
  const error = payError ?? (quoteQuery.error ? quoteQuery.error.message : null);

  async function report(sourceTx: string) {
    await fetch(`/api/invoices/${inv.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceTx, payerChain: payChain, payerAsset: choice ? `test ${choice.symbol}` : "" }),
    });
    onReported();
  }

  async function pay() {
    if (!q || !choice) return;
    setPaying(true);
    setError(null);
    try {
      if (q.kind === "solana-tx" && q.transaction) {
        if (!sol.sendDevnet) throw new Error("Connect Phantom with Testnet Mode on (Solana Devnet).");
        const sig = await sol.sendDevnet(b64ToBytes(q.transaction));
        await report(sig);
      } else if (q.kind === "evm-transfer" && q.chainId) {
        await run(
          {
            chainId: q.chainId,
            chainName: q.chainName!,
            to: q.token as Address,
            data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [q.to as Address, BigInt(q.amount!)] }),
          },
          report,
        );
      } else if (q.kind === "evm-tx" && q.chainId && q.tx) {
        await run(
          {
            chainId: q.chainId,
            chainName: q.chainName!,
            to: q.tx.to,
            data: q.tx.data as Hex,
            value: q.tx.value,
            approve: q.tx.approve ? { ...q.tx.approve, symbol: choice.symbol } : null,
          },
          report,
        );
      }
      onReported();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPaying(false);
    }
  }

  const connected = chain === "solana" ? Boolean(sol.account || evmAddr) : Boolean(evmAddr);
  const fromAmount = q ? Number(q.fromAmount) / 10 ** q.fromDecimals : null;

  return (
    <div className="panel p-5 grid gap-4">
      <div className="font-medium">Pay with test tokens</div>
      <p className="small warn -mt-2">Testnet: free faucet tokens, real onchain transaction.</p>
      {!connected && (
        <div className="grid gap-3">
          <p className="small muted">
            Connect {chain === "solana" ? "Phantom (Testnet Mode on), or MetaMask to pay from Base Sepolia," : "MetaMask"} to pay this test link.
          </p>
          <WalletBar />
        </div>
      )}
      {connected && isLoading && <div className="skeleton h-10" />}
      {connected && !isLoading && options.length === 0 && (
        <p className="small muted">
          No test {chain === "robinhood" ? "stocks, ETH or USDC" : "USDC"} found on {TEST_CHAIN_LABEL[chain]}
          {chain === "solana" ? " or Base Sepolia" : ""}.{" "}
          <a href="/test" className="underline hover:text-text">Get free test tokens</a>.
        </p>
      )}
      {options.length > 0 && (
        <div>
          <label className="label">Pay with</label>
          <select className="input" value={choice ? `${choice.chain}:${choice.token}` : ""} onChange={(e) => setSelected(e.target.value)}>
            {options.map((h) => (
              <option key={`${h.chain}:${h.token}`} value={`${h.chain}:${h.token}`}>
                test {h.symbol} on {TEST_CHAIN_LABEL[h.chain]} — {fmtAmount(h.amount, 6)}
              </option>
            ))}
          </select>
        </div>
      )}
      {quoteQuery.isFetching && !q && <div className="skeleton h-[74px]" />}
      {q && fromAmount != null && (
        <div className="panel !bg-bg p-4">
          <div className="flex justify-between items-baseline">
            <span className="small muted">You pay</span>
            <span className="num text-lg">
              {fmtAmount(fromAmount, 6)} {q.fromSymbol}
            </span>
          </div>
          <div className="flex justify-between small mt-1">
            <span className="muted">{inv.merchant_name} receives exactly</span>
            <span className="num pos">{fmtAmount(inv.amount_usd, 2)} test USDC</span>
          </div>
          <div className="small faint mt-2">
            {q.steps.join(" → ")}
            {q.alternatives && q.alternatives > 1 ? ` · cheapest of ${q.alternatives} paths` : ""}
          </div>
        </div>
      )}
      {error && <p className="small neg">{error}</p>}
      <TxStatus state={state} chain={payChain === "base" ? "base" : "robinhood"} />
      <button className="btn btn-primary btn-lg" disabled={!q || paying || inv.status === "pending"} onClick={pay}>
        {inv.status === "pending" ? "Verifying payment…" : paying ? "Paying…" : `Pay ${fmtAmount(inv.amount_usd, 2)} test USDC`}
      </button>
    </div>
  );
}
