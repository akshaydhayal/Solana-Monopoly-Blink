import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { buildMemoTx, buildTransferToEscrow, serializeTx } from "@/lib/solana/escrow";
import { getIconUrl, BOARD } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

function buildBoardSummary(game: {
  players: IPlayerState[];
  properties: Map<string, string> | Record<string, string>;
  turnNumber: number;
  lastAction?: string;
}) {
  const p1 = game.players[0];
  const p2 = game.players[1];
  const props = game.properties instanceof Map
    ? Object.fromEntries(game.properties.entries())
    : game.properties;

  const p1Props = Object.entries(props)
    .filter(([, owner]) => owner === p1?.wallet)
    .map(([idx]) => BOARD[parseInt(idx)]?.name || `Square ${idx}`)
    .join(", ") || "none";

  const p2Props = Object.entries(props)
    .filter(([, owner]) => owner === p2?.wallet)
    .map(([idx]) => BOARD[parseInt(idx)]?.name || `Square ${idx}`)
    .join(", ") || "none";

  return `Turn #${game.turnNumber}
🎩 P1 (${p1?.wallet?.slice(0, 6)}...): pos=${p1?.position} bal=${p1?.balance?.toFixed(3)} SOL
🎲 P2 (${p2?.wallet?.slice(0, 6)}...): pos=${p2?.position} bal=${p2?.balance?.toFixed(3)} SOL
🏠 P1 owns: ${p1Props}
🏚 P2 owns: ${p2Props}
Last: ${game.lastAction || "—"}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  await connectDB();
  const game = await Game.findById(gameId);

  if (!game) return corsResponse({ message: "Game not found" }, 404);

  if (game.status === "finished") {
    return corsResponse({
      type: "completed",
      icon: `${APP_URL}/monopoly-icon.png`,
      title: "🏆 Game Over!",
      description: `Winner: ${game.winner?.slice(0, 8)}...\n\n${buildBoardSummary(game)}`,
      label: "Game Finished",
    });
  }

  if (game.status === "waiting") {
    return corsResponse({
      type: "action",
      icon: `${APP_URL}/monopoly-icon.png`,
      title: "⏳ Waiting for Player 2",
      description: `Share the join link: ${APP_URL}/api/actions/monopoly/join?gameId=${gameId}`,
      label: "Waiting...",
      disabled: true,
    });
  }

  const currentPlayer = game.players.find((p: IPlayerState) => p.wallet === game.currentTurn);

  return corsResponse({
    type: "action",
    icon: getIconUrl(game, APP_URL),
    title: `🎲 Monopoly — Roll Dice`,
    description: buildBoardSummary(game),
    label: `Roll Dice (your turn: ${currentPlayer?.wallet === game.currentTurn ? "YES ✅" : "NO ❌"})`,
    links: {
      actions: [
        {
          type: "transaction",
          href: `${APP_URL}/api/actions/monopoly/${gameId}/roll`,
          label: "🎲 Roll Dice!",
        },
      ],
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await req.json();
    const wallet = body.account as string;

    if (!wallet) return corsResponse({ message: "Missing account" }, 400);

    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(wallet);
    } catch {
      return corsResponse({ message: "Invalid public key" }, 400);
    }

    await connectDB();
    const game = await Game.findById(gameId);

    if (!game) return corsResponse({ message: "Game not found" }, 404);
    if (game.status !== "active") return corsResponse({ message: "Game is not active" }, 400);
    if (game.currentTurn !== wallet) {
      return corsResponse({
        message: `Not your turn! It's ${game.currentTurn?.slice(0, 8)}...'s turn.`,
      }, 400);
    }

    // Build the Memo tx (player signs to "commit" to a roll)
    const tx = await buildMemoTx(walletPubkey, `monopoly:roll:${gameId}:${game.turnNumber}`);
    const serialized = serializeTx(tx);

    return corsResponse({
      type: "transaction",
      transaction: serialized,
      message: "Rolling dice...",
      links: {
        next: {
          type: "post",
          href: `${APP_URL}/api/actions/monopoly/${gameId}/roll-result`,
        },
      },
    });
  } catch (err) {
    console.error("[roll] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
