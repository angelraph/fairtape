import { isAddress, getAddress } from "viem";
import { testnetHoldings } from "@/lib/server/testnet-balances";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const evm = sp.get("evm");
  const sol = sp.get("solana");
  if (evm && !isAddress(evm)) return Response.json({ error: "Invalid EVM address" }, { status: 400 });
  if (sol && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sol)) return Response.json({ error: "Invalid Solana address" }, { status: 400 });
  return Response.json(await testnetHoldings(evm ? getAddress(evm) : undefined, sol ?? undefined));
}
