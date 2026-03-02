import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { buildMemoTx, serializeTx } from "@/lib/solana/escrow";
import { getIconUrl } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

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

  return corsResponse({
    type: "action",
    icon: getIconUrl(game, APP_URL),
    title: "⏭ Skip Buying Property",
    description: "Pass on buying this property and end your turn.",
    label: "Skip",
    links: {
      actions: [
        {
          type: "transaction",
          href: `${APP_URL}/api/actions/monopoly/${gameId}/skip`,
          label: "⏭ Skip",
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

    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(wallet);
    } catch {
      return corsResponse({ message: "Invalid public key" }, 400);
    }

    await connectDB();
    const game = await Game.findById(gameId);

    if (!game) return corsResponse({ message: "Game not found" }, 404);
    if (game.status !== "active") return corsResponse({ message: "Game not active" }, 400);
    if (game.currentTurn !== wallet) return corsResponse({ message: "Not your turn" }, 400);

    // Switch turns
    const opponent = game.players.find((p: IPlayerState) => p.wallet !== wallet)!;
    game.currentTurn = opponent.wallet;
    game.lastAction = `${wallet.slice(0, 8)}... skipped buying. Opponent's turn.`;
    await game.save();

    const tx = await buildMemoTx(walletPubkey, `monopoly:skip:${gameId}`);
    const serialized = serializeTx(tx);

    const p1 = game.players[0];
    const p2 = game.players[1];

    return corsResponse({
      type: "transaction",
      transaction: serialized,
      message: "Skipped buying. Opponent's turn!",
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: getIconUrl(game, APP_URL),
            title: "⏭ Turn Passed",
            description: `P1 bal: ${p1?.balance?.toFixed(3)} SOL | P2 bal: ${p2?.balance?.toFixed(3)} SOL\n\nOpponent's turn! Share roll link:\n${APP_URL}/api/actions/monopoly/${gameId}/roll`,
            label: "Waiting for opponent...",
            disabled: true,
            links: {
              actions: [
                {
                  type: "transaction",
                  href: `${APP_URL}/api/actions/monopoly/${gameId}/roll`,
                  label: "🎲 Roll Dice",
                },
              ],
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("[skip] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
