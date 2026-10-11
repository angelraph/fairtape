"use client";

import { useQuery } from "@tanstack/react-query";
import type { DeskToken, RealPrice } from "@/lib/server/desk";

export type DeskBookRow = DeskToken & { price: RealPrice | null; inventory: string; inventoryUsd: number | null };
export type DeskBook = { live: boolean; address: string | null; asOf: string; book: DeskBookRow[] };

/** Live real-world prices and desk inventory for every testnet token. */
export function useDesk() {
  return useQuery<DeskBook>({
    queryKey: ["desk"],
    queryFn: async () => {
      const r = await fetch("/api/testnet/desk");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "unavailable");
      return j;
    },
    refetchInterval: 20_000,
    retry: 6,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
  });
}

export function priceOf(book: DeskBook | undefined, address: string) {
  return book?.book.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? null;
}
