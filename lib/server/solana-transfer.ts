import "server-only";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import { STABLES } from "@/lib/registry";
import { solanaRpc } from "./clients";

type Rpc = <T>(method: string, params: unknown[]) => Promise<T>;

// Unsigned USDC transfer (creates the recipient's token account if needed). The payer's wallet signs it.
// Defaults to mainnet USDC; testnet passes Solana Devnet's USDC mint and RPC.
export async function buildUsdcTransfer(
  from: string,
  to: string,
  rawAmount: bigint,
  opts: { mint: string; decimals: number; rpc: Rpc } = { mint: STABLES.solana.address, decimals: STABLES.solana.decimals, rpc: solanaRpc },
) {
  const mint = address(opts.mint);
  const owner = address(from);
  const recipient = address(to);
  const payer = createNoopSigner(owner);
  const [[source], [destination]] = await Promise.all([
    findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    findAssociatedTokenPda({ owner: recipient, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
  ]);
  const createAta = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer, owner: recipient, mint });
  const transfer = getTransferCheckedInstruction({
    source,
    mint,
    destination,
    authority: payer,
    amount: rawAmount,
    decimals: opts.decimals,
  });
  const { value } = await opts.rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>("getLatestBlockhash", [
    { commitment: "confirmed" },
  ]);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(owner, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: value.blockhash as Blockhash, lastValidBlockHeight: BigInt(value.lastValidBlockHeight) },
        m,
      ),
    (m) => appendTransactionMessageInstructions([createAta, transfer], m),
  );
  return getBase64EncodedWireTransaction(compileTransaction(message));
}
