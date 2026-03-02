export interface BoardSquare {
  index: number;
  name: string;
  icon?: string;
  type: "property" | "go" | "jail" | "free_parking" | "go_to_jail" | "tax" | "chance";
  price?: number;   // in SOL
  rent?: number;    // in SOL
  color?: string;
}

export const BOARD: BoardSquare[] = [
  { index: 0,  name: "GO",            icon: "🚀", type: "go" },
  { index: 1,  name: "Baltic",        icon: "🏪", type: "property", price: 0.06, rent: 0.02, color: "#8B4513" },
  { index: 2,  name: "Income Tax",    icon: "💸", type: "tax" },
  { index: 3,  name: "Oriental Ave",  icon: "🚋", type: "property", price: 0.10, rent: 0.03, color: "#87CEEB" },
  { index: 4,  name: "Vermont Ave",   icon: "🏢", type: "property", price: 0.10, rent: 0.03, color: "#87CEEB" },
  { index: 5,  name: "Jail / Visit",  icon: "⛓️", type: "jail" },
  { index: 6,  name: "Virginia Ave",  icon: "🏘️", type: "property", price: 0.16, rent: 0.06, color: "#FF69B4" },
  { index: 7,  name: "Chance",        icon: "❓", type: "chance" },
  { index: 8,  name: "St. James",     icon: "🏭", type: "property", price: 0.18, rent: 0.07, color: "#FFA500" },
  { index: 9,  name: "New York",      icon: "🏙️", type: "property", price: 0.20, rent: 0.08, color: "#FFA500" },
  { index: 10, name: "Free Parking",  icon: "🅿️", type: "free_parking" },
  { index: 11, name: "Indiana Ave",   icon: "🏠", type: "property", price: 0.22, rent: 0.09, color: "#FF0000" },
  { index: 12, name: "Chance",        icon: "❓", type: "chance" },
  { index: 13, name: "Illinois Ave",  icon: "🏨", type: "property", price: 0.24, rent: 0.10, color: "#FF0000" },
  { index: 14, name: "Atlantic Ave",  icon: "🏦", type: "property", price: 0.26, rent: 0.11, color: "#FFFF00" },
  { index: 15, name: "Go To Jail",    icon: "🚓", type: "go_to_jail" },
  { index: 16, name: "Pacific Ave",   icon: "🏝️", type: "property", price: 0.30, rent: 0.13, color: "#006400" },
  { index: 17, name: "Luxury Tax",    icon: "💎", type: "tax" },
  { index: 18, name: "Park Place",    icon: "🎰", type: "property", price: 0.35, rent: 0.17, color: "#00008B" },
  { index: 19, name: "Boardwalk",     icon: "🏰", type: "property", price: 0.40, rent: 0.20, color: "#00008B" },
];

export const BOARD_SIZE = BOARD.length; // 20 squares
export const ENTRY_FEE_SOL = 0.1;       // SOL each player pays to join
export const START_BALANCE_SOL = 0.20;  // virtual game balance to buy/pay rent
export const GO_BONUS_SOL = 0.02;       // collect on passing GO
export const TAX_AMOUNT_SOL = 0.01;

export function rollDice(): [number, number] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

export function advancePosition(current: number, roll: number): number {
  return (current + roll) % BOARD_SIZE;
}

export function getSquare(index: number): BoardSquare {
  return BOARD[index];
}

export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

export function getIconUrl(game: { _id: unknown; players: { position: number; balance: number; wallet: string }[]; currentTurn?: string; lastAction?: string }, appUrl: string) {
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
  
  return `${appUrl}/api/actions/monopoly/${game._id}/board-image?${params.toString()}`;
}
