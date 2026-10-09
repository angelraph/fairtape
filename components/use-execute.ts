"use client";

import { useCallback, useState } from "react";
import { useConfig, useAccount } from "wagmi";
import { switchChain, readContract, writeContract, sendTransaction, waitForTransactionReceipt, getChainId } from "wagmi/actions";
import { erc20Abi, type Address, type Hex } from "viem";
import type { LifiQuote } from "@/lib/server/lifi";
import type { ChainKey } from "@/lib/registry";
import { EVM_CHAIN_ID, LIFI_CHAIN } from "@/lib/chains";
import { isNative } from "@/lib/native";
import { useSolanaWallet } from "./solana-wallet";

export type ExecState =
  | { step: "idle" }
  | { step: "approving"; message: string }
  | { step: "signing"; message: string }
  | { step: "submitted"; txHash: string; fromChain: ChainKey; toChain: ChainKey }
  | { step: "bridging"; txHash: string; fromChain: ChainKey; toChain: ChainKey; message: string }
  | { step: "done"; txHash: string; receivingTxHash?: string; fromChain: ChainKey; toChain: ChainKey; receivedAmount?: string }
  | { step: "error"; message: string };

const CHAIN_BY_LIFI: Record<number, ChainKey> = {
  [LIFI_CHAIN.solana]: "solana",
  [LIFI_CHAIN.base]: "base",
  [LIFI_CHAIN.robinhood]: "robinhood",
};

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function friendly(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|rejected the request|cancel/i.test(msg)) return "You rejected the request in your wallet.";
  if (/unrecognized chain|chain.*not (supported|configured)|unsupported chain|4902|addEthereumChain/i.test(msg))
    return "This wallet can't use this network. Disconnect and connect OKX Wallet, MetaMask or Rabby instead.";
  if (/insufficient/i.test(msg)) return "Insufficient balance for this amount plus network fees.";
  return msg.split("\n")[0].slice(0, 220);
}

export function useExecute() {
  const config = useConfig();
  const evm = useAccount();
  const sol = useSolanaWallet();
  const [state, setState] = useState<ExecState>({ step: "idle" });

  const track = useCallback(async (txHash: string, fromChain: ChainKey, toChain: ChainKey) => {
    if (fromChain === toChain) {
      if (fromChain === "solana") {
        setState({ step: "bridging", txHash, fromChain, toChain, message: "Confirming on Solana…" });
        for (let i = 0; i < 60; i++) {
          const res = await fetch(`/api/confirm?sig=${txHash}`).then((r) => r.json()).catch(() => null);
          if (res?.status === "confirmed") break;
          if (res?.status === "failed") {
            setState({ step: "error", message: `Transaction failed onchain: ${res.error}` });
            return { status: "FAILED" as const };
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      setState({ step: "done", txHash, fromChain, toChain });
      return { status: "DONE" as const };
    }
    setState({ step: "bridging", txHash, fromChain, toChain, message: "Waiting for the destination chain…" });
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(`/api/status?txHash=${txHash}&fromChain=${fromChain}&toChain=${toChain}`).then((r) => r.json()).catch(() => null);
      if (!res) continue;
      if (res.status === "DONE") {
        setState({ step: "done", txHash, fromChain, toChain, receivingTxHash: res.receiving?.txHash, receivedAmount: res.receiving?.amount });
        return res;
      }
      if (res.status === "FAILED") {
        setState({ step: "error", message: res.substatusMessage || "The bridge reported a failure. Funds are refunded by the bridge on the source chain." });
        return res;
      }
      if (res.substatusMessage) setState({ step: "bridging", txHash, fromChain, toChain, message: res.substatusMessage });
    }
    return { status: "PENDING" as const };
  }, []);

  const execute = useCallback(
    async (quote: LifiQuote): Promise<{ txHash: string; fromChain: ChainKey; toChain: ChainKey } | null> => {
      const fromChain = CHAIN_BY_LIFI[quote.action.fromChainId];
      const toChain = CHAIN_BY_LIFI[quote.action.toChainId];
      const tx = quote.transactionRequest;
      if (!tx) {
        setState({ step: "error", message: "Route has no transaction to sign." });
        return null;
      }
      try {
        let txHash: string;
        if (fromChain === "solana") {
          if (!sol.send) throw new Error("Connect a Solana wallet first.");
          setState({ step: "signing", message: "Confirm in your Solana wallet…" });
          txHash = await sol.send(b64ToBytes(tx.data));
        } else {
          if (!evm.address) throw new Error("Connect a Base / Robinhood wallet first.");
          const chainId = EVM_CHAIN_ID[fromChain as "base" | "robinhood"];
          if (getChainId(config) !== chainId) {
            setState({ step: "signing", message: `Switch your wallet to ${fromChain === "base" ? "Base" : "Robinhood Chain"}…` });
            await switchChain(config, { chainId });
          }
          const token = quote.action.fromToken.address;
          if (!isNative(fromChain, token)) {
            const spender = quote.estimate.approvalAddress as Address;
            const needed = BigInt(quote.action.fromAmount);
            const allowance = await readContract(config, {
              chainId,
              address: token as Address,
              abi: erc20Abi,
              functionName: "allowance",
              args: [evm.address, spender],
            });
            if (allowance < needed) {
              setState({ step: "approving", message: `Approve exactly ${quote.action.fromToken.symbol} for this trade…` });
              const approveHash = await writeContract(config, {
                chainId,
                address: token as Address,
                abi: erc20Abi,
                functionName: "approve",
                args: [spender, needed],
              });
              await waitForTransactionReceipt(config, { chainId, hash: approveHash });
            }
          }
          setState({ step: "signing", message: "Confirm the trade in your wallet…" });
          txHash = await sendTransaction(config, {
            chainId,
            to: tx.to as Address,
            data: tx.data as Hex,
            value: tx.value ? BigInt(tx.value) : undefined,
            gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
          });
          setState({ step: "submitted", txHash, fromChain, toChain });
          const receipt = await waitForTransactionReceipt(config, { chainId, hash: txHash as Hex });
          if (receipt.status !== "success") throw new Error("Transaction reverted onchain.");
        }
        setState({ step: "submitted", txHash, fromChain, toChain });
        void track(txHash, fromChain, toChain);
        return { txHash, fromChain, toChain };
      } catch (e) {
        setState({ step: "error", message: friendly(e) });
        return null;
      }
    },
    [config, evm.address, sol, track],
  );

  return { state, execute, reset: () => setState({ step: "idle" }), track };
}
