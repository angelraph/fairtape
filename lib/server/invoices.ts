import "server-only";
import { customAlphabet } from "nanoid";
import { decodeEventLog, erc20Abi, formatUnits, getAddress, isAddress, type Hex } from "viem";
import { STABLES, type ChainKey } from "@/lib/registry";
import { getDb } from "./db";
import { evmClient, solanaRpc } from "./clients";
import { status as lifiStatus } from "./lifi";
import { testEvmClient, solanaDevnetRpc } from "./testnet-clients";
import { TEST_STABLES } from "@/lib/testnet";
import { forwardStatus } from "./cctp";

export type Network = "mainnet" | "testnet";
// Mainnet settles on Base or Solana. Testnet can also settle on Robinhood Chain Testnet (its USDC has a live DEX).
export type SettleChain = "base" | "solana" | "robinhood";

export type Invoice = {
  id: string;
  network: Network;
  created_at: string;
  merchant_name: string;
  memo: string | null;
  amount_usd: number;
  settle_chain: SettleChain;
  recipient: string;
  status: "open" | "pending" | "paid" | "failed";
  paid_at: string | null;
  payer_chain: ChainKey | null;
  payer_asset: string | null;
  source_tx: string | null;
  settle_tx: string | null;
  settled_amount: number | null;
};

const newId = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 10);
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// Exact-output routes can land a hair under target after rounding; anything below this is not "paid".
const TOLERANCE = 0.995;

function row(r: Record<string, unknown>): Invoice {
  return {
    ...(r as unknown as Invoice),
    network: r.network === "testnet" ? "testnet" : "mainnet",
    amount_usd: Number(r.amount_usd),
    settled_amount: r.settled_amount == null ? null : Number(r.settled_amount),
    created_at: new Date(r.created_at as string).toISOString(),
    paid_at: r.paid_at ? new Date(r.paid_at as string).toISOString() : null,
  };
}

export function settleStable(inv: Pick<Invoice, "network" | "settle_chain">) {
  return inv.network === "testnet" ? TEST_STABLES[inv.settle_chain] : STABLES[inv.settle_chain as "base" | "solana"];
}

export async function createInvoice(input: {
  network: Network;
  merchantName: string;
  memo?: string;
  amountUsd: number;
  settleChain: SettleChain;
  recipient: string;
}) {
  const name = input.merchantName.trim().slice(0, 80);
  if (!name) throw new Error("Name is required");
  const testnet = input.network === "testnet";
  if (!testnet && input.settleChain === "robinhood") throw new Error("Mainnet pay links settle on Base or Solana");
  // Faucets hand out ~20 test USDC at a time, so testnet links go down to $0.10.
  const min = testnet ? 0.1 : 1;
  if (!(input.amountUsd >= min && input.amountUsd <= 100_000)) throw new Error(`Amount must be between $${min} and $100,000`);
  const evm = input.settleChain !== "solana";
  if (evm && !isAddress(input.recipient)) throw new Error("Enter a valid 0x address");
  if (!evm && !SOLANA_ADDRESS.test(input.recipient)) throw new Error("Enter a valid Solana address");
  const recipient = evm ? getAddress(input.recipient) : input.recipient;
  const id = newId();
  const db = await getDb();
  await db.query(
    `insert into invoices (id, network, merchant_name, memo, amount_usd, settle_chain, recipient) values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, input.network, name, input.memo?.trim().slice(0, 200) || null, Math.round(input.amountUsd * 100) / 100, input.settleChain, recipient],
  );
  return id;
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const db = await getDb();
  const { rows } = await db.query(`select * from invoices where id = $1`, [id]);
  return rows[0] ? row(rows[0]) : null;
}

export async function listInvoices(recipient: string): Promise<Invoice[]> {
  const db = await getDb();
  const { rows } = await db.query(`select * from invoices where lower(recipient) = lower($1) order by created_at desc limit 50`, [recipient]);
  return rows.map(row);
}

// ---- onchain verification: the chain, not the client, decides whether an invoice is paid ----

async function usdcReceivedEvm(inv: Invoice, txHash: string, recipient: string, notBefore: Date) {
  const chain = inv.settle_chain as "base" | "robinhood";
  const client = inv.network === "testnet" ? testEvmClient(chain) : evmClient("base");
  const stable = settleStable(inv);
  const receipt = await client.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null);
  if (!receipt) return null; // not mined yet
  if (receipt.status !== "success") return { amount: 0, reverted: true };
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (Number(block.timestamp) * 1000 < notBefore.getTime() - 60_000) return { amount: 0, tooOld: true };
  let total = BigInt(0);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== stable.address.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (ev.eventName === "Transfer" && ev.args.to.toLowerCase() === recipient.toLowerCase()) total += ev.args.value;
    } catch {}
  }
  return { amount: Number(formatUnits(total, stable.decimals)) };
}

type TokenBalance = { owner?: string; mint: string; uiTokenAmount: { amount: string } };
type SolTx = {
  blockTime: number | null;
  meta: { err: unknown; preTokenBalances: TokenBalance[]; postTokenBalances: TokenBalance[] } | null;
};

async function usdcReceivedSolana(inv: Invoice, sig: string, recipient: string, notBefore: Date) {
  const rpc = inv.network === "testnet" ? solanaDevnetRpc : solanaRpc;
  const mint = settleStable(inv).address;
  const tx = await rpc<SolTx | null>("getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
  if (!tx?.meta) return null;
  if (tx.meta.err) return { amount: 0, reverted: true };
  if (tx.blockTime && tx.blockTime * 1000 < notBefore.getTime() - 60_000) return { amount: 0, tooOld: true };
  const sum = (list: TokenBalance[]) =>
    list.filter((b) => b.owner === recipient && b.mint === mint).reduce((n, b) => n + BigInt(b.uiTokenAmount.amount), BigInt(0));
  const delta = sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
  return { amount: delta > BigInt(0) ? Number(formatUnits(delta, 6)) : 0 };
}

async function verifySettlement(inv: Invoice, settleTx: string) {
  return inv.settle_chain === "solana"
    ? usdcReceivedSolana(inv, settleTx, inv.recipient, new Date(inv.created_at))
    : usdcReceivedEvm(inv, settleTx, inv.recipient, new Date(inv.created_at));
}

// Payer reports the transaction they signed. We record it as pending and verify from chain data.
export async function attachPayment(id: string, p: { sourceTx: string; payerChain: ChainKey; payerAsset: string }) {
  const inv = await getInvoice(id);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "paid") return inv;
  // Testnet: same chain, or Base Sepolia → Solana Devnet through Circle CCTP. Nothing bridges Robinhood Chain Testnet.
  if (inv.network === "testnet" && p.payerChain !== inv.settle_chain && !(p.payerChain === "base" && inv.settle_chain === "solana")) {
    throw new Error("This testnet route is not supported");
  }
  const db = await getDb();
  const dup = await db.query(`select id from invoices where (source_tx = $1 or settle_tx = $1) and id <> $2`, [p.sourceTx, id]);
  if (dup.rows.length) throw new Error("This transaction already paid another invoice");
  await db.query(`update invoices set status='pending', source_tx=$2, payer_chain=$3, payer_asset=$4 where id=$1`, [id, p.sourceTx, p.payerChain, p.payerAsset]);
  return refreshInvoice(id);
}

export async function refreshInvoice(id: string): Promise<Invoice | null> {
  const inv = await getInvoice(id);
  if (!inv || inv.status !== "pending" || !inv.source_tx || !inv.payer_chain) return inv;
  const db = await getDb();

  let settleTx: string | null = null;
  if (inv.payer_chain === inv.settle_chain) {
    settleTx = inv.source_tx;
  } else if (inv.network === "testnet") {
    const st = await forwardStatus(inv.source_tx).catch(() => null);
    if (st?.status === "failed") {
      await db.query(`update invoices set status='open', source_tx=null, payer_chain=null, payer_asset=null where id=$1`, [id]);
      return getInvoice(id);
    }
    if (st?.status !== "complete" || !st.destinationTx) return inv;
    settleTx = st.destinationTx;
  } else {
    const st = await lifiStatus({ txHash: inv.source_tx, fromChain: inv.payer_chain, toChain: inv.settle_chain }).catch(() => null);
    if (st?.status === "FAILED") {
      await db.query(`update invoices set status='open', source_tx=null, payer_chain=null, payer_asset=null where id=$1`, [id]);
      return getInvoice(id);
    }
    if (st?.status !== "DONE" || !st.receiving?.txHash) return inv;
    settleTx = st.receiving.txHash;
  }

  const result = await verifySettlement(inv, settleTx).catch(() => null);
  if (!result) return inv; // not confirmed yet
  if (result.amount >= inv.amount_usd * TOLERANCE) {
    await db.query(`update invoices set status='paid', paid_at=now(), settle_tx=$2, settled_amount=$3 where id=$1 and status='pending'`, [
      id,
      settleTx,
      result.amount,
    ]);
  } else if ("reverted" in result || "tooOld" in result || inv.payer_chain === inv.settle_chain) {
    // Same-chain tx that didn't pay enough (or failed) can never become valid; reopen the invoice.
    await db.query(`update invoices set status='open', source_tx=null, payer_chain=null, payer_asset=null where id=$1`, [id]);
  }
  return getInvoice(id);
}
