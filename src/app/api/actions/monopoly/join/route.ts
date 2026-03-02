import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import connectDB from "@/lib/db";
import Game from "@/models/Game";
import { buildTransferToEscrow, serializeTx } from "@/lib/solana/escrow";
import { ENTRY_FEE_SOL, START_BALANCE_SOL } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS(_req: NextRequest) {
  return corsOptions();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return corsResponse({ message: "Missing gameId" }, 400);
  }

  await connectDB();
  const game = await Game.findById(gameId);

  if (!game) {
    return corsResponse({ message: "Game not found" }, 404);
  }

  if (game.status !== "waiting") {
    return corsResponse({
      type: "completed",
      icon: `${APP_URL}/monopoly-icon.png`,
      title: "❌ Game Already Started",
      description: "This game is no longer accepting players.",
      label: "Game Unavailable",
    });
  }

  return corsResponse({
    type: "action",
    icon: `${APP_URL}/monopoly-icon.png`,
    title: `🎲 Join Monopoly Game`,
    description: `You've been invited to a Monopoly game!\n\nGame ID: ${gameId.slice(-6)}\nPlayer 1: ${game.player1.slice(0, 8)}...\n\nStake ${ENTRY_FEE_SOL} SOL to join. Winner takes ${ENTRY_FEE_SOL * 2} SOL!`,
    label: `Join & Stake ${ENTRY_FEE_SOL} SOL`,
    links: {
      actions: [
        {
          type: "transaction",
          href: `/api/actions/monopoly/join?gameId=${gameId}`,
          label: `🎮 Join Game (${ENTRY_FEE_SOL} SOL)`,
        },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return corsResponse({ message: "Missing gameId" }, 400);
    }

    const body = await req.json();
    const player2 = body.account as string;

    if (!player2) {
      return corsResponse({ message: "Missing account" }, 400);
    }

    let player2Pubkey: PublicKey;
    try {
      player2Pubkey = new PublicKey(player2);
    } catch {
      return corsResponse({ message: "Invalid public key" }, 400);
    }

    await connectDB();
    const game = await Game.findById(gameId);

    if (!game) {
      return corsResponse({ message: "Game not found" }, 404);
    }
    if (game.status !== "waiting") {
      return corsResponse({ message: "Game is not waiting for a player" }, 400);
    }
    if (game.player1 === player2) {
      return corsResponse({ message: "Cannot join your own game" }, 400);
    }

    // Update game to active, assign player 2, set first turn to player 1
    game.player2 = player2;
    game.status = "active";
    game.currentTurn = game.player1;
    game.escrowBalance = ENTRY_FEE_SOL; // player1's stake (tracked)
    game.players.push({
      wallet: player2,
      position: 0,
      balance: START_BALANCE_SOL,
      bankrupt: false,
      jailTurns: 0,
    });
    game.lastAction = `${player2.slice(0, 8)}... joined! Player 1 goes first.`;
    await game.save();

    // Build stake transfer (player2 → escrow)
    const tx = await buildTransferToEscrow(player2Pubkey, ENTRY_FEE_SOL);
    const serialized = serializeTx(tx);

    const rollUrl = `/api/actions/monopoly/${gameId}/roll`;

    return corsResponse({
      type: "transaction",
      transaction: serialized,
      message: `Joined game! Player 1 (${game.player1.slice(0, 8)}...) goes first.`,
      links: {
        next: {
          type: "post",
          href: `/api/actions/monopoly/${gameId}/roll-callback`,
        },
      },
    });
  } catch (err) {
    console.error("[join] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
