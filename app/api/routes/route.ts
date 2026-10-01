import { findRoutes, type Endpoint } from "@/lib/server/routes";

export const dynamic = "force-dynamic";

type Body = {
  from: Endpoint & { amount: string };
  fromAddress: string;
  toAddresses: { solana?: string; evm?: string };
  targets: Endpoint[];
};

const CHAINS = new Set(["solana", "base", "robinhood"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (
    !body?.from ||
    !CHAINS.has(body.from.chain) ||
    !/^\d+$/.test(body.from.amount ?? "") ||
    BigInt(body.from.amount) === BigInt(0) ||
    !body.fromAddress ||
    !Array.isArray(body.targets) ||
    body.targets.length === 0 ||
    body.targets.length > 6 ||
    body.targets.some((t) => !CHAINS.has(t.chain))
  ) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const routes = await findRoutes(body);
    return Response.json({ routes });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Routing failed" }, { status: 502 });
  }
}
