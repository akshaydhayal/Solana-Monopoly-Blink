import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { getSquare, BOARD, getIconUrl } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(req.url);
    const position = parseInt(searchParams.get("position") || "-1");

    const body = await req.json();
    const wallet = body.account as string;
    const signature = body.signature as string;

    if (!wallet) return corsResponse({ message: "Missing account" }, 400);
    console.log(`[buy-result] Sig: ${signature} for pos ${position}`);

    await connectDB();
    const game = await Game.findById(gameId);
    if (!game) return corsResponse({ message: "Game not found" }, 404);
    if (game.status !== "active") return corsResponse({ message: "Game not active" }, 400);

    // If turn already switched, just show status
    if (game.currentTurn !== wallet) {
        return corsResponse({
            type: "action",
            icon: getIconUrl(game, APP_URL),
            title: "Action Already Processed",
            description: `Turn already passed. Current turn: ${game.currentTurn?.slice(0, 8)}...`,
            label: "Done",
            disabled: true,
        });
    }

    const square = getSquare(position);
    const price = square.price || 0;
    const playerIdx = game.players.findIndex((p: IPlayerState) => p.wallet === wallet);
    
    // Check balance again
    if (game.players[playerIdx].balance < price) {
        return corsResponse({ message: "Insufficient balance at commit" }, 400);
    }

    // Deduct and own
    game.players[playerIdx].balance -= price;
    game.set(`properties.${position}`, wallet);

    // Switch turn
    const opponent = game.players.find((p: IPlayerState) => p.wallet !== wallet)!;
    game.currentTurn = opponent.wallet;
    const actionMessage = `${wallet.slice(0, 8)}... bought ${square.name} for ${price} SOL!`;
    game.lastAction = actionMessage;

    game.markModified("players");
    game.markModified("properties");
    await game.save();

    const nextRollApiUrl = `${APP_URL}/api/actions/monopoly/${gameId}/roll`;
    const nextRollUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(nextRollApiUrl)}&cluster=devnet`;

    return corsResponse({
      type: "action",
      icon: getIconUrl(game, APP_URL),
      title: "🏠 Property Purchased!",
      description: `${actionMessage}\n\nOpponent's turn link:\n${nextRollUrl}`,
      label: "Turn Passed",
      disabled: true,
    });
  } catch (err) {
    console.error("[buy-result] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
