"use client";

import { useQuery } from "@tanstack/react-query";
import type { Tape } from "@/lib/server/tape";

export function useTape(initial?: Tape) {
  return useQuery<Tape>({
    queryKey: ["tape"],
    queryFn: async () => {
      const res = await fetch("/api/tape");
      if (!res.ok) throw new Error("tape unavailable");
      return res.json();
    },
    initialData: initial,
    refetchInterval: 15_000,
  });
}
