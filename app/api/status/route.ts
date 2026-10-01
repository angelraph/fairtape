import { status } from "@/lib/server/lifi";
import type { ChainKey } from "@/lib/registry";

export const dynamic = "force-dynamic";

const CHAINS = new Set(["solana", "base", "robinhood"]);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const txHash = sp.get("txHash");
  const fromChain = sp.get("fromChain") as ChainKey;
  const toChain = sp.get("toChain") as ChainKey;
  if (!txHash || !CHAINS.has(fromChain) || !CHAINS.has(toChain)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    return Response.json(await status({ txHash, fromChain, toChain }));
  } catch (e) {
    return Response.json({ status: "PENDING", substatusMessage: e instanceof Error ? e.message : "" });
  }
}
