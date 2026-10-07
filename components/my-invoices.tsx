"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useSolanaWallet } from "./solana-wallet";
import type { Invoice } from "@/lib/server/invoices";
import { CHAIN_LABEL } from "@/lib/registry";
import { usd, amount as fmtAmount } from "@/lib/format";
import { TEST_CHAIN_LABEL } from "@/lib/testnet";

export function MyInvoices() {
  const evm = useAccount();
  const sol = useSolanaWallet();
  const addrs = [evm.address, sol.account?.address].filter(Boolean) as string[];
  const { data, isLoading } = useQuery<Invoice[]>({
    queryKey: ["my-invoices", ...addrs],
    enabled: addrs.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(addrs.map((a) => fetch(`/api/invoices?recipient=${a}`).then((r) => r.json())));
      return lists.flatMap((l) => l.invoices as Invoice[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    refetchInterval: 15_000,
  });

  if (!addrs.length) return <div className="panel p-8 text-center muted">Connect a wallet to see the links that pay you.</div>;
  if (isLoading) return <div className="skeleton h-40" />;
  if (!data?.length) return <div className="panel p-8 text-center muted">No pay links yet.</div>;
  return (
    <div className="panel overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Amount</th>
            <th>Settles on</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {data.map((inv) => (
            <tr key={inv.id}>
              <td>
                <Link href={`/pay/${inv.id}`} className="font-medium hover:underline">{inv.memo || inv.merchant_name}</Link>
              </td>
              <td className="num">{inv.network === "testnet" ? `${fmtAmount(inv.amount_usd, 2)} test` : usd(inv.amount_usd)}</td>
              <td>{inv.network === "testnet" ? TEST_CHAIN_LABEL[inv.settle_chain] : CHAIN_LABEL[inv.settle_chain]}</td>
              <td className={inv.status === "paid" ? "pos" : inv.status === "pending" ? "warn" : "muted"}>{inv.status}</td>
              <td className="small muted" suppressHydrationWarning>{new Date(inv.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
