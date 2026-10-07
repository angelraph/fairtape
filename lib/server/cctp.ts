import "server-only";
import { encodeFunctionData, parseAbi, toHex, concat, pad, stringToHex, numberToHex, type Address, type Hex } from "viem";
import { address as solAddress, getAddressEncoder } from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from "@solana-program/token";
import { TEST_STABLES } from "@/lib/testnet";
import { solanaDevnetRpc } from "./testnet-clients";

// Circle CCTP V2 + Forwarding Service on testnet: Base Sepolia → Solana Devnet in one EVM signature. Circle relays the
// destination mint itself and takes its fee out of the minted USDC. Addresses and fees verified live 2026-10-07.

export const CCTP = {
  iris: "https://iris-api-sandbox.circle.com",
  domains: { base: 6, solana: 5 },
  baseSepoliaTokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address,
};

// Fast Transfer (attested after soft finality, seconds), Standard waits for L1 finality, far too slow for checkout.
const FAST_FINALITY = 1000;

const messengerAbi = parseAbi([
  "function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData)",
]);

type FeeRow = { finalityThreshold: number; minimumFee: number; forwardFee?: { low: number; med: number; high: number } };

async function recipientAta(wallet: string) {
  const [ata] = await findAssociatedTokenPda({
    owner: solAddress(wallet),
    mint: solAddress(TEST_STABLES.solana.address),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const info = await solanaDevnetRpc<{ value: unknown | null }>("getAccountInfo", [ata, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }]);
  return { ata, exists: info.value != null };
}

function hookData(createAtaFor: string | null): Hex {
  const magic = pad(stringToHex("cctp-forward"), { size: 24, dir: "right" });
  const version = numberToHex(0, { size: 4 });
  if (!createAtaFor) return concat([magic, version, numberToHex(0, { size: 4 })]);
  const wallet = toHex(new Uint8Array(getAddressEncoder().encode(solAddress(createAtaFor))));
  return concat([magic, version, numberToHex(33, { size: 4 }), "0x01", wallet]);
}

/**
 * Builds the burn that pays `amountRaw` (6dp) of USDC to a Solana Devnet wallet from Base Sepolia. The payer burns the
 * amount plus the maximum fee, so the merchant receives at least the invoiced amount.
 */
export async function buildBaseToSolanaPayment(amountRaw: bigint, recipientWallet: string) {
  const { ata, exists } = await recipientAta(recipientWallet);
  const sp = new URLSearchParams({ forward: "true" });
  if (!exists) sp.set("includeRecipientSetup", "true");
  const res = await fetch(`${CCTP.iris}/v2/burn/USDC/fees/${CCTP.domains.base}/${CCTP.domains.solana}?${sp}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Circle fee API ${res.status}`);
  const rows = (await res.json()) as FeeRow[];
  const fast = rows.find((r) => r.finalityThreshold === FAST_FINALITY);
  if (!fast?.forwardFee) throw new Error("Circle is not offering forwarding on this route right now");
  const forwardFee = BigInt(fast.forwardFee.high);
  // Protocol fee is quoted in bps with decimals (e.g. 1.3); round up, then add 10% headroom on the whole fee.
  const protocolFee = (amountRaw * BigInt(Math.ceil(fast.minimumFee * 100)) + BigInt(999_999)) / BigInt(1_000_000);
  const maxFee = ((forwardFee + protocolFee) * BigInt(11)) / BigInt(10);
  const total = amountRaw + maxFee;
  const usdc = TEST_STABLES.base.address as Address;
  const data = encodeFunctionData({
    abi: messengerAbi,
    functionName: "depositForBurnWithHook",
    args: [
      total,
      CCTP.domains.solana,
      toHex(new Uint8Array(getAddressEncoder().encode(ata))),
      usdc,
      pad("0x00", { size: 32 }),
      maxFee,
      FAST_FINALITY,
      hookData(exists ? null : recipientWallet),
    ],
  });
  return {
    tx: { to: CCTP.baseSepoliaTokenMessengerV2, data, value: "0", approve: { token: usdc, spender: CCTP.baseSepoliaTokenMessengerV2, amount: total.toString() } },
    total,
    maxFee,
    createsAccount: !exists,
  };
}

export type ForwardStatus = { status: "pending" | "complete" | "failed"; destinationTx: string | null; detail?: string };

/** Asks Circle where a Base Sepolia burn stands; destinationTx is the Solana Devnet mint once forwarded. */
export async function forwardStatus(burnTx: string): Promise<ForwardStatus> {
  const res = await fetch(`${CCTP.iris}/v2/messages/${CCTP.domains.base}?transactionHash=${burnTx}`, { cache: "no-store" });
  if (res.status === 404) return { status: "pending", destinationTx: null, detail: "Waiting for Circle to see the burn" };
  if (!res.ok) return { status: "pending", destinationTx: null, detail: `Circle API ${res.status}` };
  const json = (await res.json()) as { messages?: { status?: string; forwardState?: string; forwardTxHash?: string | null }[] };
  const m = json.messages?.[0];
  if (!m) return { status: "pending", destinationTx: null };
  if (m.forwardTxHash) return { status: "complete", destinationTx: m.forwardTxHash, detail: m.forwardState };
  if (/fail/i.test(m.forwardState ?? "")) return { status: "failed", destinationTx: null, detail: m.forwardState };
  return { status: "pending", destinationTx: null, detail: m.forwardState ?? m.status };
}
