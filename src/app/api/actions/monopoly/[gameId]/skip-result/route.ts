import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { getIconUrl } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * POST callback — called by blink client after skip Memo tx is submitted.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await req.json();
    const wallet = body.account as string;

    if (!wallet) return corsResponse({ message: "Missing account" }, 400);

    await connectDB();
    const game = await Game.findById(gameId);
    if (!game) return corsResponse({ message: "Game not found" }, 404);
    if (game.status !== "active") return corsResponse({ message: "Game not active" }, 400);

    if (game.currentTurn !== wallet) {
        return corsResponse({
            type: "action",
            icon: getIconUrl(game, APP_URL),
            title: "Action Already Processed",
            description: "Turn already passed.",
            label: "Done",
            disabled: true,
        });
    }

    // Switch turns
    const opponent = game.players.find((p: IPlayerState) => p.wallet !== wallet)!;
    game.currentTurn = opponent.wallet;
    game.lastAction = `${wallet.slice(0, 8)}... skipped buying. Opponent's turn.`;
    
    game.markModified("players");
    await game.save();

    const nextRollApiUrl = `${APP_URL}/api/actions/monopoly/${gameId}/roll`;
    const nextRollUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(nextRollApiUrl)}&cluster=devnet`;

    return corsResponse({
      type: "action",
      icon: getIconUrl(game, APP_URL),
      title: "⏭ Turn Passed",
      description: `Opponent's turn! Roll link:\n${nextRollUrl}`,
      label: "Waiting for opponent...",
      disabled: true,
    });
  } catch (err) {
    console.error("[skip-result] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
