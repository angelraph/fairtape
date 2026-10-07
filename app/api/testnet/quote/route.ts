import { isAddress } from "viem";
import { quoteExactIn, buildExactInTx, isKnownToken } from "@/lib/server/synthra";

export const dynamic = "force-dynamic";

// Quotes every Synthra path on Robinhood Chain Testnet. With `recipient`, also returns the signed-ready transaction for
// the best path, or for `pick` (a path the user chose) re-quoted at current prices.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tokenIn = String(body?.tokenIn ?? "");
  const tokenOut = String(body?.tokenOut ?? "");
  const recipient = body?.recipient ? String(body.recipient) : null;
  const pick = body?.pick as { tokens: string[]; fees: number[] } | undefined;
  let amount: bigint;
  try {
    amount = BigInt(String(body?.amount ?? "0"));
  } catch {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!isKnownToken(tokenIn) || !isKnownToken(tokenOut) || amount <= BigInt(0)) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (recipient && !isAddress(recipient)) return Response.json({ error: "Invalid recipient" }, { status: 400 });
  try {
    const routes = await quoteExactIn(tokenIn, tokenOut, amount);
    if (!routes.length) return Response.json({ error: "No Synthra pool can fill this trade right now." }, { status: 404 });
    let tx = null;
    if (recipient) {
      const chosen = pick
        ? routes.find((r) => r.tokens.join().toLowerCase() === pick.tokens.join().toLowerCase() && r.fees.join() === pick.fees.join())
        : routes[0];
      if (!chosen) return Response.json({ error: "That path can no longer fill this trade. Compare again." }, { status: 409 });
      tx = { route: chosen, ...buildExactInTx(tokenIn, chosen, recipient) };
    }
    return Response.json({ routes, tx });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : "Quote failed" }, { status: 502 });
  }
}
