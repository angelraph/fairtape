import { deskBook, deskConfigured } from "@/lib/server/desk";
import { DESK } from "@/lib/testnet";

export const dynamic = "force-dynamic";

// Live real-world prices for every testnet token, and how much of each the desk can deliver right now.
export async function GET() {
  try {
    return Response.json({ live: deskConfigured(), address: DESK.address, asOf: new Date().toISOString(), book: await deskBook() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : "Desk unavailable" }, { status: 502 });
  }
}
