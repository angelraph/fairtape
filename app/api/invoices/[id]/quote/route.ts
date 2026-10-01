import { parseUnits } from "viem";
import { getInvoice } from "@/lib/server/invoices";
import { quote } from "@/lib/server/lifi";
import { describe } from "@/lib/server/routes";
import { buildUsdcTransfer } from "@/lib/server/solana-transfer";
import { STABLES, type ChainKey } from "@/lib/registry";

export const dynamic = "force-dynamic";

const CHAINS = new Set(["solana", "base", "robinhood"]);

// Prices paying this invoice with any asset on any chain, delivering exactly the invoiced USDC.
export async function POST(request: Request, ctx: RouteContext<"/api/invoices/[id]/quote">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const fromChain = body?.fromChain as ChainKey;
  const fromToken = String(body?.fromToken ?? "");
  const fromAddress = String(body?.fromAddress ?? "");
  if (!CHAINS.has(fromChain) || !fromToken || !fromAddress) return Response.json({ error: "Invalid request" }, { status: 400 });

  const inv = await getInvoice(id);
  if (!inv) return Response.json({ error: "Invoice not found" }, { status: 404 });
  if (inv.status === "paid") return Response.json({ error: "Already paid" }, { status: 409 });

  const settle = STABLES[inv.settle_chain];
  const rawAmount = parseUnits(inv.amount_usd.toFixed(2), settle.decimals);
  const same = fromChain === inv.settle_chain && fromToken.toLowerCase() === settle.address.toLowerCase();

  try {
    if (same && inv.settle_chain === "base") {
      return Response.json({
        kind: "evm-transfer",
        token: settle.address,
        to: inv.recipient,
        amount: rawAmount.toString(),
        fromAmount: rawAmount.toString(),
        fromSymbol: "USDC",
        fromDecimals: 6,
        usdIn: inv.amount_usd,
        steps: ["Direct USDC transfer on Base"],
      });
    }
    if (same && inv.settle_chain === "solana") {
      const tx = await buildUsdcTransfer(fromAddress, inv.recipient, rawAmount);
      return Response.json({
        kind: "solana-tx",
        transaction: tx,
        fromAmount: rawAmount.toString(),
        fromSymbol: "USDC",
        fromDecimals: 6,
        usdIn: inv.amount_usd,
        steps: ["Direct USDC transfer on Solana"],
      });
    }
    const q = await quote({
      fromChain,
      toChain: inv.settle_chain,
      fromToken,
      toToken: settle.address,
      fromAddress,
      toAddress: inv.recipient,
      toAmount: rawAmount.toString(),
    });
    const info = await describe({ chain: fromChain, token: fromToken });
    return Response.json({
      kind: "lifi",
      quote: q,
      fromAmount: q.action.fromAmount,
      fromSymbol: q.action.fromToken.symbol,
      fromDecimals: q.action.fromToken.decimals,
      usdIn: q.estimate.fromAmountUSD ? Number(q.estimate.fromAmountUSD) : null,
      shares: info?.kind === "stock" ? (Number(q.action.fromAmount) / 10 ** info.decimals) * info.multiplier : null,
      steps: q.includedSteps.filter((s) => s.type !== "protocol").map((s) => `${s.type === "cross" ? "Bridge" : "Swap"} via ${s.toolDetails?.name ?? s.tool}`),
      durationSec: q.estimate.executionDuration,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No route" }, { status: 502 });
  }
}
