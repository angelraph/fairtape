"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useSolanaWallet } from "./solana-wallet";
import type { Holding } from "@/lib/server/balances";

export function useHoldings() {
  const evm = useAccount();
  const sol = useSolanaWallet();
  const evmAddr = evm.address;
  const solAddr = sol.account?.address;
  const q = useQuery<{ holdings: Holding[]; errors: string[] }>({
    queryKey: ["holdings", evmAddr, solAddr],
    enabled: Boolean(evmAddr || solAddr),
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (evmAddr) sp.set("evm", evmAddr);
      if (solAddr) sp.set("solana", solAddr);
      const res = await fetch(`/api/balances?${sp}`);
      if (!res.ok) throw new Error("balances unavailable");
      return res.json();
    },
    refetchInterval: 30_000,
  });
  return { ...q, evmAddr, solAddr };
}
