import { parseUnits } from "viem";
import { getInvoice, settleStable, type Invoice } from "@/lib/server/invoices";
import { quote } from "@/lib/server/lifi";
import { describe } from "@/lib/server/routes";
import { buildUsdcTransfer } from "@/lib/server/solana-transfer";
import { STABLES, type ChainKey } from "@/lib/registry";
import { TEST_CHAIN_ID, TEST_CHAIN_LABEL, TEST_STABLES } from "@/lib/testnet";
import { quoteExactOut, buildExactOutTx, isKnownToken, symbolOf } from "@/lib/server/synthra";
import { solanaDevnetRpc } from "@/lib/server/testnet-clients";
import { buildBaseToSolanaPayment } from "@/lib/server/cctp";

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
  if (inv.network === "testnet") return testnetQuote(inv, fromChain, fromToken, fromAddress);

  const settle = STABLES[inv.settle_chain as "base" | "solana"];
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

// Testnet: same-chain USDC transfers on all three testnets, plus "pay with a stock" on Robinhood Chain Testnet, where one
// Synthra exact-output swap sells the payer's stock and delivers exactly the invoiced USDC to the merchant.
async function testnetQuote(inv: Invoice, fromChain: ChainKey, fromToken: string, fromAddress: string) {
  // Cross-chain on testnet: Base Sepolia USDC → Solana Devnet via Circle CCTP V2 with the Forwarding Service.
  if (fromChain === "base" && inv.settle_chain === "solana") {
    if (fromToken.toLowerCase() !== TEST_STABLES.base.address.toLowerCase()) {
      return Response.json({ error: "Pay from Base Sepolia with test USDC." }, { status: 400 });
    }
    try {
      const amountRaw = parseUnits(inv.amount_usd.toFixed(2), 6);
      const p = await buildBaseToSolanaPayment(amountRaw, inv.recipient);
      return Response.json({
        kind: "evm-tx",
        network: "testnet",
        chainId: TEST_CHAIN_ID.base,
        chainName: TEST_CHAIN_LABEL.base,
        tx: p.tx,
        fromAmount: p.total.toString(),
        fromSymbol: "USDC",
        fromDecimals: 6,
        usdIn: null,
        steps: [
          "Burn on Base Sepolia (Circle CCTP V2, fast transfer)",
          `Circle mints on Solana Devnet${p.createsAccount ? " and opens the merchant's USDC account" : ""}`,
          `max fee ${(Number(p.maxFee) / 1e6).toFixed(4)} USDC`,
        ],
      });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : "No route" }, { status: 502 });
    }
  }
  if (fromChain !== inv.settle_chain) {
    const alt = inv.settle_chain === "solana" ? " or with USDC from Base Sepolia" : "";
    return Response.json({ error: `Pay this test link from ${TEST_CHAIN_LABEL[inv.settle_chain]}${alt}.` }, { status: 400 });
  }
  const settle = settleStable(inv);
  const rawAmount = parseUnits(inv.amount_usd.toFixed(2), settle.decimals);
  const isStable = fromToken.toLowerCase() === settle.address.toLowerCase();
  try {
    if (isStable && inv.settle_chain === "solana") {
      const tx = await buildUsdcTransfer(fromAddress, inv.recipient, rawAmount, { mint: settle.address, decimals: settle.decimals, rpc: solanaDevnetRpc });
      return Response.json({ kind: "solana-tx", network: "testnet", transaction: tx, fromAmount: rawAmount.toString(), fromSymbol: "USDC", fromDecimals: settle.decimals, usdIn: inv.amount_usd, steps: ["Direct USDC transfer on Solana Devnet"] });
    }
    if (isStable) {
      const chain = inv.settle_chain as "base" | "robinhood";
      return Response.json({
        kind: "evm-transfer",
        network: "testnet",
        chainId: TEST_CHAIN_ID[chain],
        chainName: TEST_CHAIN_LABEL[chain],
        token: settle.address,
        to: inv.recipient,
        amount: rawAmount.toString(),
        fromAmount: rawAmount.toString(),
        fromSymbol: "USDC",
        fromDecimals: settle.decimals,
        usdIn: inv.amount_usd,
        steps: [`Direct USDC transfer on ${TEST_CHAIN_LABEL[chain]}`],
      });
    }
    if (inv.settle_chain !== "robinhood" || !isKnownToken(fromToken)) {
      return Response.json({ error: "On this testnet, pay with test USDC." }, { status: 400 });
    }
    const routes = await quoteExactOut(fromToken, settle.address, rawAmount);
    const best = routes[0];
    if (!best) return Response.json({ error: "No Synthra pool can sell enough of this token right now." }, { status: 404 });
    const tx = buildExactOutTx(fromToken, best, inv.recipient);
    return Response.json({
      kind: "evm-tx",
      network: "testnet",
      chainId: TEST_CHAIN_ID.robinhood,
      chainName: TEST_CHAIN_LABEL.robinhood,
      tx,
      fromAmount: best.amountIn,
      fromSymbol: symbolOf(fromToken),
      fromDecimals: 18,
      usdIn: null,
      shares: fromToken.toLowerCase() === settle.address.toLowerCase() ? null : Number(best.amountIn) / 1e18,
      steps: [`Sell via Synthra · ${best.label}`, "USDC delivered straight to the merchant"],
      alternatives: routes.length,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : "No route" }, { status: 502 });
  }
}
