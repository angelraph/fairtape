import { getHistory } from "@/lib/server/snapshots";
import { getAsset } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/api/history/[ticker]">) {
  const { ticker } = await ctx.params;
  if (!getAsset(ticker)) return new Response("unknown ticker", { status: 404 });
  const hours = Math.min(Number(new URL(request.url).searchParams.get("hours") || 72), 24 * 30);
  const points = await getHistory(ticker.toUpperCase(), hours);
  return Response.json({ ticker: ticker.toUpperCase(), hours, points });
}
