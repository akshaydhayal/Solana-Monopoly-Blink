import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import connectDB from "@/lib/db";
import Game, { IPlayerState } from "@/models/Game";
import { buildMemoTx, buildTransferToEscrow, serializeTx } from "@/lib/solana/escrow";
import {
  rollDice,
  advancePosition,
  getSquare,
  BOARD,
  GO_BONUS_SOL,
  TAX_AMOUNT_SOL,
} from "@/lib/game/board";
import { corsResponse, corsOptions } from "@/lib/cors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function OPTIONS() {
  return corsOptions();
}

function getIconUrl(game: any) {
  const p1 = game.players[0];
  const p2 = game.players[1];
  const turn = game.currentTurn === p1?.wallet ? "P1" : "P2";
  
  const params = new URLSearchParams({
    p1Pos: String(p1?.position || 0),
    p2Pos: String(p2?.position || 0),
    p1Bal: (p1?.balance || 0).toFixed(3),
    p2Bal: (p2?.balance || 0).toFixed(3),
    action: game.lastAction || "Game Active",
    turn: turn
  });
  
  return `${APP_URL}/api/actions/monopoly/${game._id}/board-image?${params.toString()}`;
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
    icon: getIconUrl(game),
    title: `🎲 Monopoly — Roll Dice`,
    description: buildBoardSummary(game),
    label: `Roll Dice (your turn: ${currentPlayer?.wallet === game.currentTurn ? "YES ✅" : "NO ❌"})`,
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

    // Roll the dice
    const [d1, d2] = rollDice();
    const roll = d1 + d2;

    const playerIdx = game.players.findIndex((p: IPlayerState) => p.wallet === wallet);
    const player = game.players[playerIdx];
    const opponent = game.players.find((p: IPlayerState) => p.wallet !== wallet)!;

    // Advance position
    const oldPos = player.position;
    const newPos = advancePosition(oldPos, roll);
    const passedGo = newPos < oldPos; // wrapped around

    game.players[playerIdx].position = newPos;
    if (passedGo) {
      game.players[playerIdx].balance += GO_BONUS_SOL;
    }

    const square = getSquare(newPos);
    game.turnNumber += 1;

    // Get properties map
    const propsMap: Record<string, string> = game.properties instanceof Map
      ? Object.fromEntries(game.properties.entries())
      : { ...game.properties };

    let actionMessage = `Rolled ${d1}+${d2}=${roll}. Landed on ${square.name}`;
    if (passedGo) actionMessage += ` (passed GO +${GO_BONUS_SOL} SOL)`;

    let needsRentTx = false;
    let rentAmount = 0;
    let txDescription = "";
    let nextAction: unknown = null;

    const otherWallet = opponent.wallet;
    const oppositePlayerIdx = game.players.findIndex((p: IPlayerState) => p.wallet === otherWallet);

    if (square.type === "property") {
      const propOwner = propsMap[String(newPos)];

      if (!propOwner) {
        // Unowned — offer to buy
        actionMessage += `. Available to buy for ${square.price} SOL!`;
        game.lastAction = actionMessage;
        game.currentTurn = wallet; // stay on current player until they decide
        game.markModified("properties");
        game.markModified("players");
        await game.save();

        const tx = await buildMemoTx(walletPubkey, `monopoly:roll:${gameId}:${roll}`);
        const serialized = serializeTx(tx);

        return corsResponse({
          type: "transaction",
          transaction: serialized,
          message: actionMessage,
          links: {
            next: {
              type: "inline",
              action: {
                type: "action",
                icon: getIconUrl(game),
                title: `🏠 Buy ${square.name}?`,
                description: `${actionMessage}\n\nBuy for ${square.price} SOL and collect ${square.rent} SOL rent per visit?\n\n${buildBoardSummary({ ...game.toObject(), lastAction: actionMessage })}`,
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
              },
            },
          },
        });
      } else if (propOwner === wallet) {
        // Own it
        actionMessage += `. You own this property.`;
        txDescription = "Own property — no rent";
      } else {
        // Opponent owns it — pay rent
        rentAmount = square.rent || 0;
        if (game.players[playerIdx].balance >= rentAmount) {
          game.players[playerIdx].balance -= rentAmount;
          game.players[oppositePlayerIdx].balance += rentAmount;
          actionMessage += `. Paid ${rentAmount} SOL rent to opponent!`;
        } else {
          // Bankrupt!
          game.players[playerIdx].bankrupt = true;
          actionMessage += `. BANKRUPT! Can't pay rent of ${rentAmount} SOL!`;
          game.status = "finished";
          game.winner = otherWallet;
          game.lastAction = actionMessage;
          game.markModified("players");
          await game.save();

          // Build payout tx (server-signed)
          const { buildAndSignPayoutFromEscrow, serializeSignedTx } = await import("@/lib/solana/escrow");
          const payoutTx = await buildAndSignPayoutFromEscrow(
            new PublicKey(otherWallet),
            game.escrowBalance
          );
          const payoutSerialized = serializeSignedTx(payoutTx);

          return corsResponse({
            type: "transaction",
            transaction: payoutSerialized,
            message: `💸 BANKRUPT! Game over! Winner: ${otherWallet.slice(0, 8)}...`,
            links: {
              next: {
                type: "inline",
                action: {
                  type: "completed",
                  icon: getIconUrl(game),
                  title: "🏆 Game Over — Bankrupt!",
                  description: `${actionMessage}\n\nWinner receives ${game.escrowBalance} SOL prize!`,
                  label: "Game Finished",
                },
              },
            },
          });
        }
        needsRentTx = true;
      }
    } else if (square.type === "tax") {
      if (game.players[playerIdx].balance >= TAX_AMOUNT_SOL) {
        game.players[playerIdx].balance -= TAX_AMOUNT_SOL;
        actionMessage += `. Paid ${TAX_AMOUNT_SOL} SOL tax.`;
      } else {
        actionMessage += `. Couldn't pay tax (low balance).`;
      }
    } else if (square.type === "go_to_jail") {
      game.players[playerIdx].position = 10; // jail square
      game.players[playerIdx].jailTurns = 1;
      actionMessage += `. Go to Jail! Lose next turn.`;
    } else if (square.type === "chance") {
      const bonus = GO_BONUS_SOL;
      game.players[playerIdx].balance += bonus;
      actionMessage += `. Chance: +${bonus} SOL bonus!`;
    } else if (square.type === "jail") {
      actionMessage += `. Just visiting jail.`;
    } else if (square.type === "free_parking") {
      actionMessage += `. Free Parking — relax!`;
    }

    // Switch turns
    game.currentTurn = otherWallet;
    game.lastAction = actionMessage;
    game.markModified("players");
    game.markModified("properties");
    await game.save();

    const tx = await buildMemoTx(walletPubkey, `monopoly:roll:${gameId}:${roll}`);
    const serialized = serializeTx(tx);

    const rollSummary = buildBoardSummary({ ...game.toObject(), lastAction: actionMessage });

    return corsResponse({
      type: "transaction",
      transaction: serialized,
      message: actionMessage,
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: getIconUrl(game),
            title: `🎲 Opponent's Turn`,
            description: `${actionMessage}\n\n${rollSummary}\n\nShare with opponent: ${APP_URL}/api/actions/monopoly/${gameId}/roll`,
            label: "Waiting for opponent...",
            disabled: true,
            links: {
              actions: [
                {
                  type: "transaction",
                  href: `${APP_URL}/api/actions/monopoly/${gameId}/roll`,
                  label: "🎲 It's your turn — Roll!",
                },
              ],
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("[roll] error:", err);
    return corsResponse({ message: "Internal server error" }, 500);
  }
}
