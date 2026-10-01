import { refreshInvoice, attachPayment } from "@/lib/server/invoices";
import type { ChainKey } from "@/lib/registry";

export const dynamic = "force-dynamic";

const CHAINS = new Set(["solana", "base", "robinhood"]);

export async function GET(_req: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  const inv = await refreshInvoice(id);
  if (!inv) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ invoice: inv });
}

// Payer reports the transaction they signed; the server verifies it against chain data.
export async function POST(request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const sourceTx = String(body?.sourceTx ?? "");
  const payerChain = body?.payerChain as ChainKey;
  if (!/^(0x[0-9a-fA-F]{64}|[1-9A-HJ-NP-Za-km-z]{64,90})$/.test(sourceTx) || !CHAINS.has(payerChain)) {
    return Response.json({ error: "Invalid payment report" }, { status: 400 });
  }
  try {
    const inv = await attachPayment(id, { sourceTx, payerChain, payerAsset: String(body?.payerAsset ?? "").slice(0, 80) });
    return Response.json({ invoice: inv });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
