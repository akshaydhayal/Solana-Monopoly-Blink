import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { getIconUrl, START_BALANCE_SOL, ENTRY_FEE_SOL } from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * POST callback — called by blink client after Player 2 join tx is submitted.
 * We officially start the game here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await req.json();
    const player2 = body.account as string;
    const signature = body.signature as string;

    if (!player2) return corsResponse({ message: "Missing account in callback" }, 400);

    console.log(`[join-callback] Sig received from ${player2}: ${signature}`);

    await connectDB();
    const game = await Game.findById(gameId);
    if (!game) return corsResponse({ message: "Game not found" }, 404);

    // If already active, just show status
    if (game.status === "active") {
        return corsResponse({
            type: "action",
            icon: getIconUrl(game, APP_URL),
            title: "Game Already Active",
            description: "You've successfully joined the game! It's currently playing.",
            label: "Roll Dice",
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

    // Official Game Start
    game.player2 = player2;
    game.status = "active";
    game.currentTurn = game.player1; // P1 starts
    game.escrowBalance = ENTRY_FEE_SOL * 2; // both stakes in escrow
    
    // Add Player 2 to players array if not already there
    const hasP2 = game.players.some((p: IPlayerState) => p.wallet === player2);
    if (!hasP2) {
        game.players.push({
            wallet: player2,
            position: 0,
            balance: START_BALANCE_SOL,
            bankrupt: false,
            jailTurns: 0,
        });
    }

    game.lastAction = `${player2.slice(0, 8)}... joined! Game is now LIVE.`;
    game.markModified("players");
    await game.save();

    return corsResponse({
      type: "action",
      icon: getIconUrl(game, APP_URL),
      title: "🎲 Game Started! Player 1's Turn",
      description: `You've joined the game! Player 1 goes first.\n\nShare the dashboard with your opponent:\n${APP_URL}/game/${gameId}`,
      label: "Waiting for P1...",
      disabled: true,
      links: {
        actions: [
          {
            type: "transaction",
            href: `${APP_URL}/api/actions/monopoly/${gameId}/roll`,
            label: "🎲 Your Turn Soon",
          },
        ],
      },
    });
  } catch (err) {
    console.error("[join-callback] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
