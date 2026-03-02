import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { buildMemoTx, serializeTx } from "@/lib/solana/escrow";
import { getSquare, BOARD, getIconUrl } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const { searchParams } = new URL(req.url);
  const position = parseInt(searchParams.get("position") || "0");
  const square = getSquare(position);

  await connectDB();
  const game = await Game.findById(gameId);
  if (!game) return corsResponse({ message: "Game not found" }, 404);

  return corsResponse({
    type: "action",
    icon: getIconUrl(game, APP_URL),
    title: `🏠 Buy ${square.name}?`,
    description: `Purchase ${square.name} for ${square.price} SOL. Collect ${square.rent} SOL rent when opponent lands here.`,
    label: `Buy for ${square.price} SOL`,
    links: {
      actions: [
        {
          type: "transaction",
          href: `${APP_URL}/api/actions/monopoly/${gameId}/buy?position=${position}`,
          label: `💰 Buy ${square.name}`,
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
    const { searchParams } = new URL(req.url);
    const position = parseInt(searchParams.get("position") || "-1");

    if (position < 0) return corsResponse({ message: "Missing position" }, 400);

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

    const square = getSquare(position);
    if (square.type !== "property") return corsResponse({ message: "Not a property" }, 400);

    const tx = await buildMemoTx(walletPubkey, `monopoly:buy:${gameId}:${position}`);
    const serialized = serializeTx(tx);

    return corsResponse({
      type: "transaction",
      transaction: serialized,
      message: `Finalizing purchase of ${square.name}...`,
      links: {
        next: {
          type: "post",
          href: `${APP_URL}/api/actions/monopoly/${gameId}/buy-result?position=${position}`,
        },
      },
    });
  } catch (err) {
    console.error("[buy] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
