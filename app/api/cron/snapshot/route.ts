import { getTape } from "@/lib/server/tape";
import { recordSnapshot } from "@/lib/server/snapshots";

export const dynamic = "force-dynamic";

// Called by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const tape = await getTape();
  const rows = await recordSnapshot(tape, true);
  return Response.json({ ok: true, rows, asOf: tape.asOf });
}
