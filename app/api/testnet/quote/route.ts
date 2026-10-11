import { isAddress } from "viem";
import { quoteDesk, deskToken } from "@/lib/server/desk";
import { DESK } from "@/lib/testnet";

export const dynamic = "force-dynamic";

// Quotes a testnet trade at the live real-world market price through the Fairtape desk.
// With `recipient`, the response includes the signed transaction to send; without it, it's a price preview.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tokenIn = String(body?.tokenIn ?? "");
  const tokenOut = String(body?.tokenOut ?? "");
  const mode = body?.mode === "exactOut" ? "exactOut" : "exactIn";
  const recipient = body?.recipient ? String(body.recipient) : null;
  let amount: bigint;
  try {
    amount = BigInt(String(body?.amount ?? "0"));
  } catch {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!deskToken(tokenIn) || !deskToken(tokenOut) || amount <= BigInt(0)) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (recipient && !isAddress(recipient)) return Response.json({ error: "Invalid recipient" }, { status: 400 });
  try {
    // Previews still sign a quote, bound to the desk itself as recipient, and the transaction is dropped from the reply.
    const q = await quoteDesk({ tokenIn, tokenOut, amount, mode, recipient: recipient ?? DESK.address ?? "0x0000000000000000000000000000000000000001" });
    return Response.json({ quote: recipient ? q : { ...q, tx: null } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : "Quote failed" }, { status: 502 });
  }
}
