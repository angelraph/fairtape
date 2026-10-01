import { solanaRpc } from "@/lib/server/clients";

export const dynamic = "force-dynamic";

type SigStatus = { confirmationStatus?: string; err: unknown } | null;

// Confirms a Solana signature server-side (wallets return before the network finalizes).
export async function GET(request: Request) {
  const sig = new URL(request.url).searchParams.get("sig");
  if (!sig || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) return Response.json({ error: "Invalid signature" }, { status: 400 });
  const res = await solanaRpc<{ value: SigStatus[] }>("getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
  const s = res.value[0];
  if (!s) return Response.json({ status: "pending" });
  if (s.err) return Response.json({ status: "failed", error: JSON.stringify(s.err) });
  return Response.json({ status: s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized" ? "confirmed" : "pending" });
}
