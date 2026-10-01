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

// Unsigned USDC transfer (creates the recipient's token account if needed). The payer's wallet signs it.
export async function buildUsdcTransfer(from: string, to: string, rawAmount: bigint) {
  const mint = address(STABLES.solana.address);
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
    decimals: STABLES.solana.decimals,
  });
  const { value } = await solanaRpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>("getLatestBlockhash", [
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
