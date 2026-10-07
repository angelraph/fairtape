import { testnetTape } from "@/lib/server/synthra";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ asOf: new Date().toISOString(), rows: await testnetTape() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : "Testnet tape unavailable" }, { status: 502 });
  }
}
