import { getTape } from "@/lib/server/tape";

export const dynamic = "force-dynamic";

export async function GET() {
  const tape = await getTape();
  return Response.json(tape, { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=20" } });
}
