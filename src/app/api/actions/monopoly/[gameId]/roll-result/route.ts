import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import {
  rollDice,
  advancePosition,
  getSquare,
  BOARD,
  GO_BONUS_SOL,
  TAX_AMOUNT_SOL,
  getIconUrl,
} from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

function buildBoardSummary(game: { turnNumber: number; players: { wallet: string; position: number; balance: number }[]; properties: Record<string, string>; lastAction?: string }) {
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

  return `Turn #${game.turnNumber}\n🎩 P1 (${p1?.wallet?.slice(0, 6)}...): pos=${p1?.position} bal=${p1?.balance?.toFixed(3)} SOL\n🎲 P2 (${p2?.wallet?.slice(0, 6)}...): pos=${p2?.position} bal=${p2?.balance?.toFixed(3)} SOL\n🏠 P1 owns: ${p1Props}\n🏚 P2 owns: ${p2Props}\nLast: ${game.lastAction || "—"}`;
}

/**
 * POST callback — called by blink client after roll Memo tx is submitted.
 * This is where the actual dice roll and state update happens.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await req.json();
    const wallet = body.account as string;
    const signature = body.signature as string;

    if (!wallet) return corsResponse({ message: "Missing account" }, 400);

    console.log(`[roll-result] Sig received: ${signature} for ${wallet}`);

    await connectDB();
    const game = await Game.findById(gameId);

    if (!game) return corsResponse({ message: "Game not found" }, 404);
    if (game.status !== "active") return corsResponse({ message: "Game is not active" }, 400);
    
    // Safety: only one roll per turnNumber
    // We can use a simple check or just let it be (idempotency is hard with random rolls)
    if (game.currentTurn !== wallet) {
       // Maybe they already rolled and the refresh happened?
       // Let's just return the current state Action
       return corsResponse({
         type: "action",
         icon: getIconUrl(game, APP_URL),
         title: "Turn Already Processed",
         description: buildBoardSummary(game),
         label: "Wait for opponent",
         disabled: true,
       });
    }

    // --- GAME LOGIC START ---
    const [d1, d2] = rollDice();
    const roll = d1 + d2;

    const playerIdx = game.players.findIndex((p: IPlayerState) => p.wallet === wallet);
    const player = game.players[playerIdx];
    const opponent = game.players.find((p: IPlayerState) => p.wallet !== wallet)!;

    const oldPos = player.position;
    const newPos = advancePosition(oldPos, roll);
    const passedGo = newPos < oldPos;

    game.players[playerIdx].position = newPos;
    if (passedGo) {
      game.players[playerIdx].balance += GO_BONUS_SOL;
    }

    const square = getSquare(newPos);
    game.turnNumber += 1;

    let actionMessage = `Rolled ${d1}+${d2}=${roll}. Landed on ${square.name}`;
    if (passedGo) actionMessage += ` (passed GO +${GO_BONUS_SOL} SOL)`;

    const otherWallet = opponent.wallet;
    const oppositePlayerIdx = game.players.findIndex((p: IPlayerState) => p.wallet === otherWallet);

    const propsMap: Record<string, string> = game.properties instanceof Map
      ? Object.fromEntries(game.properties.entries())
      : { ...game.properties };

    // Handle Buy Logic vs Move Logic
    if (square.type === "property") {
      const propOwner = propsMap[String(newPos)];

      if (!propOwner) {
        // Unowned — check if affordable
        if (square.price && player.balance >= square.price) {
          actionMessage += `. Available to buy for ${square.price} SOL!`;
          game.lastAction = actionMessage;
          game.currentTurn = wallet; // stay on current player!
          game.markModified("players");
          await game.save();

          return corsResponse({
            type: "action",
            icon: getIconUrl(game, APP_URL),
            title: `🏠 Buy ${square.name}?`,
            description: `${actionMessage}\n\nBuy for ${square.price} SOL and collect ${square.rent} SOL rent per visit?\n\n${buildBoardSummary(game)}`,
            label: `Buy ${square.name}`,
            links: {
              actions: [
                {
                  type: "transaction",
                  href: `${APP_URL}/api/actions/monopoly/${gameId}/buy?position=${newPos}`,
                  label: `💰 Buy for ${square.price} SOL`,
                },
                {
                  type: "transaction",
                  href: `${APP_URL}/api/actions/monopoly/${gameId}/skip`,
                  label: "⏭ Skip (don't buy)",
                },
              ],
            },
          });
        } else {
          // Cannot afford, auto skip
          actionMessage += `. Too expensive to buy! ${square.price} SOL needed.`;
        }
      } else if (propOwner === wallet) {
        actionMessage += `. You own this property.`;
      } else {
        // Rent
        const rentAmount = square.rent || 0;
        if (game.players[playerIdx].balance >= rentAmount) {
          game.players[playerIdx].balance -= rentAmount;
          game.players[oppositePlayerIdx].balance += rentAmount;
          actionMessage += `. Paid ${rentAmount} SOL rent to opponent!`;
        } else {
          // Bankrupt
          game.players[playerIdx].bankrupt = true;
          actionMessage += `. BANKRUPT! Can't pay rent.`;
          game.status = "finished";
          game.winner = otherWallet;
          // Payout handles below...
        }
      }
    } else if (square.type === "tax") {
       const tax = TAX_AMOUNT_SOL;
       if (game.players[playerIdx].balance >= tax) {
         game.players[playerIdx].balance -= tax;
         actionMessage += `. Paid ${tax} SOL tax.`;
       } else {
         actionMessage += `. Couldn't pay tax.`;
       }
    } else if (square.type === "go_to_jail") {
      game.players[playerIdx].position = 10;
      game.players[playerIdx].jailTurns = 1;
      actionMessage += `. Go to Jail!`;
    } else if (square.type === "chance") {
      game.players[playerIdx].balance += GO_BONUS_SOL;
      actionMessage += `. Chance: +${GO_BONUS_SOL} SOL bonus!`;
    }

    // Handle Bankrupt Payout
    if (game.status === "finished") {
        game.lastAction = actionMessage;
        await game.save();
        
        const { buildAndSignPayoutFromEscrow, serializeSignedTx } = await import("@/lib/solana/escrow");
        const payoutTx = await buildAndSignPayoutFromEscrow(new PublicKey(otherWallet), game.escrowBalance);
        
        return corsResponse({
            type: "transaction",
            transaction: serializeSignedTx(payoutTx),
            message: `💸 BANKRUPT! Game over! Winner: ${otherWallet.slice(0, 8)}...`,
            links: {
                next: {
                    type: "inline",
                    action: {
                        type: "completed",
                        icon: getIconUrl(game, APP_URL),
                        title: "🏆 Game Over — Bankrupt!",
                        description: `${actionMessage}\n\nWinner receives ${game.escrowBalance} SOL prize!`,
                        label: "Game Finished",
                    }
                }
            }
        });
    }

    // Normal Turn Switch
    game.currentTurn = otherWallet;
    game.lastAction = actionMessage;
    game.markModified("players");
    await game.save();

    const nextRollApiUrl = `${APP_URL}/api/actions/monopoly/${gameId}/roll`;
    const nextRollUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(nextRollApiUrl)}&cluster=devnet`;

    return corsResponse({
      type: "action",
      icon: getIconUrl(game, APP_URL),
      title: `🎲 Rolled ${roll}!`,
      description: `${actionMessage}\n\n${buildBoardSummary(game)}\n\nNext turn link:\n${nextRollUrl}`,
      label: "Opponent's Turn",
      disabled: true,
      links: {
        actions: [
          {
            type: "transaction",
            href: `${APP_URL}/api/actions/monopoly/${gameId}/roll`,
            label: "🎲 Wait for turn...",
          },
        ],
      },
    });
  } catch (err) {
    console.error("[roll-result] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
