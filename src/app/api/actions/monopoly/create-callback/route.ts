import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Game from "@/models/Game";
import { corsResponse, corsOptions } from "@/lib/cors";
import { ENTRY_FEE_SOL, START_BALANCE_SOL } from "@/lib/game/board";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * GET — helpful error for debugging if hit manually.
 */
export async function GET() {
  return corsResponse({
    message: "This endpoint expects a POST callback from a Solana Blink client.",
  }, 405);
}

/**
 * POST callback — called by blink client after create tx is submitted.
 * We create the actual Game record here only AFTER the user signs.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const player1 = body.account as string;
    const signature = body.signature as string;

    if (!player1) return corsResponse({ message: "Missing account in callback" }, 400);

    console.log(`[create-callback] Sig received from ${player1}: ${signature}`);

    const dbStartTime = Date.now();
    await connectDB();
    console.log(`[create-callback] DB connected in ${Date.now() - dbStartTime}ms`);

    // Create game record now
    const game = await Game.create({
      status: "waiting",
      player1,
      escrowBalance: ENTRY_FEE_SOL, // stake sent
      players: [
        {
          wallet: player1,
          position: 0,
          balance: START_BALANCE_SOL,
          bankrupt: false,
          jailTurns: 0,
        },
      ],
      properties: {},
      turnNumber: 0,
      lastAction: `Game created! Waiting for Player 2.`,
    });

    const gameId = game._id.toString();
    const joinApiUrl = `${APP_URL}/api/actions/monopoly/join?gameId=${gameId}`;
    const joinUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(joinApiUrl)}&cluster=devnet`;
    const dashboardUrl = `${APP_URL}/game/${gameId}`;

    return corsResponse({
      type: "completed",
      icon: `${APP_URL}/monopoly-icon.png`,
      title: "✅ Game Created Successfully!",
      description: `Your 0.1 SOL stake has been submitted.\n\nShare this link with Player 2 to start playing:\n${joinUrl}\n\nLive Game Dashboard:\n${dashboardUrl}`,
      label: "Game Ready!",
    });
  } catch (err) {
    console.error("[create-callback] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
