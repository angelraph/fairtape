"use client";

import { useCallback, useState } from "react";
import { useConfig, useAccount } from "wagmi";
import { switchChain, readContract, writeContract, sendTransaction, waitForTransactionReceipt, getChainId } from "wagmi/actions";
import { erc20Abi, type Address, type Hex } from "viem";
import type { wagmiConfig } from "@/lib/wagmi";

type ChainId = (typeof wagmiConfig)["chains"][number]["id"];

export type EvmTx = {
  chainId: ChainId;
  chainName: string;
  to: Address;
  data: Hex;
  value?: string;
  approve?: { token: Address; spender: Address; amount: string; symbol: string } | null;
};

export type TxState =
  | { step: "idle" }
  | { step: "working"; message: string }
  | { step: "done"; txHash: Hex }
  | { step: "error"; message: string };

export function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|rejected the request|cancel/i.test(msg)) return "You rejected the request in your wallet.";
  if (/insufficient funds|exceeds balance|insufficient/i.test(msg)) return "Not enough balance for this amount plus gas. Top up from the faucet.";
  if (/Too little received|Too much requested|STF|slippage/i.test(msg)) return "Price moved past the 1% limit. Compare again.";
  return msg.split("\n")[0].slice(0, 220);
}

/** Switch chain → exact approval (only if needed) → send → wait for a successful receipt. */
export function useEvmTx() {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<TxState>({ step: "idle" });

  const run = useCallback(
    async (tx: EvmTx, onSubmitted?: (hash: Hex) => void | Promise<void>): Promise<Hex | null> => {
      try {
        if (!address) throw new Error("Connect MetaMask (or another EVM wallet) first.");
        const chainId = tx.chainId;
        if (getChainId(config) !== chainId) {
          setState({ step: "working", message: `Switch your wallet to ${tx.chainName}…` });
          await switchChain(config, { chainId });
        }
        if (tx.approve) {
          const allowance = await readContract(config, {
            chainId,
            address: tx.approve.token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, tx.approve.spender],
          });
          if (allowance < BigInt(tx.approve.amount)) {
            setState({ step: "working", message: `Approve exactly this much ${tx.approve.symbol} in your wallet…` });
            const h = await writeContract(config, {
              chainId,
              address: tx.approve.token,
              abi: erc20Abi,
              functionName: "approve",
              args: [tx.approve.spender, BigInt(tx.approve.amount)],
            });
            await waitForTransactionReceipt(config, { chainId, hash: h });
          }
        }
        setState({ step: "working", message: "Confirm the transaction in your wallet…" });
        const hash = await sendTransaction(config, { chainId, to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined });
        await onSubmitted?.(hash);
        setState({ step: "working", message: `Waiting for ${tx.chainName} to confirm…` });
        const receipt = await waitForTransactionReceipt(config, { chainId, hash });
        if (receipt.status !== "success") throw new Error("Transaction reverted onchain.");
        setState({ step: "done", txHash: hash });
        return hash;
      } catch (e) {
        setState({ step: "error", message: friendlyError(e) });
        return null;
      }
    },
    [config, address],
  );

  return { state, run, reset: () => setState({ step: "idle" }) };
}
