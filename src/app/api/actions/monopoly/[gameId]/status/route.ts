import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { corsResponse, corsOptions } from "@/lib/cors";
import { BOARD } from "@/lib/game/board";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  await connectDB();

  const game = await Game.findById(gameId);
  if (!game) return corsResponse({ message: "Game not found" }, 404);

  const p1 = game.players[0];
  const p2 = game.players[1];

  const propsMap: Record<string, string> = game.properties instanceof Map
    ? Object.fromEntries(game.properties.entries())
    : game.properties;

  const p1Props = BOARD.filter((sq) => propsMap[String(sq.index)] === p1?.wallet)
    .map(sq => `${sq.name}(${sq.rent}SOL)`)
    .join(", ") || "none";
  const p2Props = BOARD.filter((sq) => propsMap[String(sq.index)] === p2?.wallet)
    .map(sq => `${sq.name}(${sq.rent}SOL)`)
    .join(", ") || "none";

  const p1Pos = BOARD[p1?.position ?? 0]?.name || "?";
  const p2Pos = BOARD[p2?.position ?? 0]?.name || "?";

  const description = game.status === "finished"
    ? `🏆 WINNER: ${game.winner?.slice(0, 8)}...\n\n`
    : `Turn #${game.turnNumber} | ${game.status === "waiting" ? "⏳ Waiting for Player 2" : `🎯 Current: ${game.currentTurn?.slice(0, 8)}...`}\n\n`;

  return corsResponse({
    gameId: game._id,
    status: game.status,
    turnNumber: game.turnNumber,
    currentTurn: game.currentTurn,
    winner: game.winner,
    lastAction: game.lastAction,
    players: [
      {
        wallet: p1?.wallet,
        position: p1?.position,
        positionName: p1Pos,
        balance: p1?.balance,
        bankrupt: p1?.bankrupt,
        properties: p1Props,
      },
      {
        wallet: p2?.wallet,
        position: p2?.position,
        positionName: p2Pos,
        balance: p2?.balance,
        bankrupt: p2?.bankrupt,
        properties: p2Props,
      },
    ],
    escrowBalance: game.escrowBalance,
    rollUrl: `${APP_URL}/api/actions/monopoly/${gameId}/roll`,
    joinUrl: `${APP_URL}/api/actions/monopoly/join?gameId=${gameId}`,
  });
}
