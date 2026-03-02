import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

// Priority fee: 200,000 micro-lamports per compute unit.
// This significantly improves confirmation speed on devnet.
const PRIORITY_FEE_MICRO_LAMPORTS = 200_000;
const COMPUTE_UNITS = 200_000;

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function getEscrowKeypair(): Keypair {
  const rawKey = process.env.ESCROW_PRIVATE_KEY;
  if (!rawKey) throw new Error("ESCROW_PRIVATE_KEY not set");
  const arr = JSON.parse(rawKey) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export function getEscrowPublicKey(): PublicKey {
  return getEscrowKeypair().publicKey;
}

/**
 * Returns the standard priority fee instructions to add to any transaction.
 * This dramatically speeds up confirmation time on devnet and mainnet.
 */
function getPriorityFeeInstructions() {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICRO_LAMPORTS }),
  ];
}

/**
 * Build a transaction that transfers SOL from `from` to the escrow.
 * This tx is unsigned — the user's wallet will sign it.
 */
export async function buildTransferToEscrow(
  from: PublicKey,
  solAmount: number
): Promise<Transaction> {
  const conn = getConnection();
  const escrow = getEscrowPublicKey();
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(
    ...getPriorityFeeInstructions(),
    SystemProgram.transfer({ fromPubkey: from, toPubkey: escrow, lamports })
  );

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = from;

  return tx;
}

/**
 * Build and SIGN (server-side) a transaction that pays out from escrow to winner.
 */
export async function buildAndSignPayoutFromEscrow(
  winner: PublicKey,
  solAmount: number
): Promise<Transaction> {
  const conn = getConnection();
  const escrow = getEscrowKeypair();
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(
    ...getPriorityFeeInstructions(),
    SystemProgram.transfer({
      fromPubkey: escrow.publicKey,
      toPubkey: winner,
      lamports,
    })
  );

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = escrow.publicKey;
  tx.sign(escrow);

  return tx;
}

/**
 * Build a no-op Memo transaction (used when no real SOL transfer needed,
 * but we still need to return a transaction for the Blink spec).
 */
export async function buildMemoTx(
  payer: PublicKey,
  memo: string
): Promise<Transaction> {
  const conn = getConnection();
  const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

  const ix = {
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  };

  const tx = new Transaction().add(...getPriorityFeeInstructions(), ix);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;

  return tx;
}

export function serializeTx(tx: Transaction): string {
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
}

export function serializeSignedTx(tx: Transaction): string {
  return tx.serialize().toString("base64");
}
