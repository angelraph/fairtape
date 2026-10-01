import { isAddress } from "viem";
import { getHoldings } from "@/lib/server/balances";

export const dynamic = "force-dynamic";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const evm = sp.get("evm") || undefined;
  const solana = sp.get("solana") || undefined;
  if ((evm && !isAddress(evm)) || (solana && !SOLANA_ADDRESS.test(solana))) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  return Response.json(await getHoldings({ evm, solana }));
}
