import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Game from "@/models/Game";
import { getIconUrl } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

// POST callback — called by blink client after join tx confirms
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await req.json();
    const wallet = (body.account as string) || "";

    await connectDB();
    const game = await Game.findById(gameId);
    if (!game) return corsResponse({ message: "Game not found" }, 404);

    // Update escrow balance now that player2 has staked
    if (game.status === "active" && game.escrowBalance < 0.15) {
      game.escrowBalance = 0.2; // both players staked
      await game.save();
    }

    const p1 = game.players[0];
    const p2 = game.players[1];

    return corsResponse({
      type: "action",
      icon: getIconUrl(game, APP_URL),
      title: "🎲 Game Started! Player 1's Turn",
      description: `Both players have joined and staked!\n\nP1: ${p1?.wallet?.slice(0, 8)}... bal=${p1?.balance?.toFixed(3)} SOL\nP2: ${p2?.wallet?.slice(0, 8)}... bal=${p2?.balance?.toFixed(3)} SOL\n\nPlayer 1 goes first! Roll link:\n${APP_URL}/api/actions/monopoly/${gameId}/roll`,
      label: "Roll Dice",
      links: {
        actions: [
          {
            type: "transaction",
            href: `/api/actions/monopoly/${gameId}/roll`,
            label: "🎲 Roll Dice!",
          },
        ],
      },
    });
  } catch (err) {
    console.error("[roll-callback] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
