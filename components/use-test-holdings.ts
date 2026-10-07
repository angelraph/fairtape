"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useSolanaWallet } from "./solana-wallet";
import type { TestHolding } from "@/lib/server/testnet-balances";

export function useTestHoldings() {
  const evm = useAccount();
  const sol = useSolanaWallet();
  const evmAddr = evm.address;
  const solAddr = sol.account?.address;
  const q = useQuery<{ holdings: TestHolding[]; errors: string[] }>({
    queryKey: ["test-holdings", evmAddr, solAddr],
    enabled: Boolean(evmAddr || solAddr),
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (evmAddr) sp.set("evm", evmAddr);
      if (solAddr) sp.set("solana", solAddr);
      const res = await fetch(`/api/testnet/balances?${sp}`);
      if (!res.ok) throw new Error("testnet balances unavailable");
      return res.json();
    },
    refetchInterval: 20_000,
  });
  return { ...q, evmAddr, solAddr };
}
