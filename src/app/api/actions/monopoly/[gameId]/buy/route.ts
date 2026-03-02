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

    const propsMap: Record<string, string> = game.properties instanceof Map
      ? Object.fromEntries(game.properties.entries())
      : { ...game.properties };

    if (propsMap[String(position)]) {
      return corsResponse({ message: "Property already owned" }, 400);
    }

    const playerIdx = game.players.findIndex((p: IPlayerState) => p.wallet === wallet);
    const player = game.players[playerIdx];
    const price = square.price || 0;

    if (player.balance < price) {
      return corsResponse({ message: `Insufficient balance. Need ${price} SOL, have ${player.balance.toFixed(3)} SOL` }, 400);
    }

    // Deduct cost and assign property
    game.players[playerIdx].balance -= price;
    game.set(`properties.${position}`, wallet);

    // Switch turns
    const opponent = game.players.find((p: IPlayerState) => p.wallet !== wallet)!;
    game.currentTurn = opponent.wallet;
    const actionMessage = `${wallet.slice(0, 8)}... bought ${square.name} for ${price} SOL!`;
    game.lastAction = actionMessage;

    game.markModified("players");
    game.markModified("properties");
    await game.save();

    const tx = await buildMemoTx(walletPubkey, `monopoly:buy:${gameId}:${position}`);
    const serialized = serializeTx(tx);

    const p1 = game.players[0];
    const p2 = game.players[1];
    const ownedProps = BOARD.filter((sq) => {
      const map = game.properties instanceof Map
        ? Object.fromEntries(game.properties.entries())
        : game.properties;
      return map[String(sq.index)] === wallet;
    }).map(sq => sq.name).join(", ");

    return corsResponse({
      type: "transaction",
      transaction: serialized,
      message: actionMessage,
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: getIconUrl(game, APP_URL),
            title: "🏠 Property Purchased!",
            description: `${actionMessage}\n\nYour properties: ${ownedProps || "none"}\n\nP1 bal: ${p1?.balance?.toFixed(3)} SOL | P2 bal: ${p2?.balance?.toFixed(3)} SOL\n\nOpponent's turn: ${APP_URL}/api/actions/monopoly/${gameId}/roll`,
            label: "Opponent's turn",
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
    console.error("[buy] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
