import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  buildTransferToEscrow,
  serializeTx,
} from "@/lib/solana/escrow";
import { ENTRY_FEE_SOL } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";
import { getBaseUrl } from "@/lib/getBaseUrl";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS(_req: NextRequest) {
  return corsOptions();
}

// GET — return blink metadata for creating a game
export async function GET(_req: NextRequest) {
  return corsResponse({
    type: "action",
    chains: ["solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"],
    icon: `${APP_URL}/monopoly-icon.png`,
    title: "🎲 Monopoly Blink — Create Game",
    description: `Start a 2-player Monopoly game on Solana devnet! Both players stake ${ENTRY_FEE_SOL} SOL. Winner takes all. Share the join link with your opponent after creating.`,
    label: `Create & Stake ${ENTRY_FEE_SOL} SOL`,
    links: {
      actions: [
        {
          type: "transaction",
          href: `${APP_URL}/api/actions/monopoly/create`,
          label: `🎲 Create Game (${ENTRY_FEE_SOL} SOL)`,
        },
      ],
    },
  });
}

// POST — build stake transfer tx; game is created in create-callback after signature
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const player1 = body.account as string;

    if (!player1) {
      return corsResponse({ message: "Missing account" }, 400);
    }

    let player1Pubkey: PublicKey;
    try {
      player1Pubkey = new PublicKey(player1);
    } catch {
      return corsResponse({ message: "Invalid public key" }, 400);
    }

    // Derive the base URL from the incoming request so callbacks always
    // point to the correct server regardless of env variable value.
    const baseUrl = getBaseUrl(req);
    console.log(`[create] Using baseUrl: ${baseUrl}`);

    // Build the stake transfer tx (player → escrow)
    const startTime = Date.now();
    const tx = await buildTransferToEscrow(player1Pubkey, ENTRY_FEE_SOL);
    const serialized = serializeTx(tx);
    console.log(`[create] Tx built for ${player1} in ${Date.now() - startTime}ms`);

    return corsResponse({
      type: "transaction",
      transaction: serialized,
      message: `Stake ${ENTRY_FEE_SOL} SOL to create your Monopoly game!`,
      links: {
        next: {
          type: "post",
          href: `${baseUrl}/api/actions/monopoly/create-callback`,
        },
      },
    });
  } catch (err) {
    console.error("[create] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
