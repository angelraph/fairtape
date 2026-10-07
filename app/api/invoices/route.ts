import { createInvoice, listInvoices } from "@/lib/server/invoices";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    const network = body?.network === "testnet" ? "testnet" : "mainnet";
    const id = await createInvoice({
      network,
      merchantName: String(body?.merchantName ?? ""),
      memo: body?.memo ? String(body.memo) : undefined,
      amountUsd: Number(body?.amountUsd),
      settleChain: body?.settleChain === "solana" ? "solana" : body?.settleChain === "robinhood" ? "robinhood" : "base",
      recipient: String(body?.recipient ?? ""),
    });
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not create" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const recipient = new URL(request.url).searchParams.get("recipient");
  if (!recipient) return Response.json({ invoices: [] });
  return Response.json({ invoices: await listInvoices(recipient) });
}
