import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Player State ─────────────────────────────────────────────────────────────
export interface IPlayerState {
  wallet: string;
  position: number;
  balance: number;    // SOL virtual game balance
  bankrupt: boolean;
  jailTurns: number;  // turns spent in jail
}

// ─── Game ────────────────────────────────────────────────────────────────────
export interface IGame extends Document {
  status: "waiting" | "active" | "finished";
  player1: string;         // wallet pubkey
  player2?: string;
  currentTurn?: string;    // wallet pubkey of who rolls next
  winner?: string;
  escrowBalance: number;   // SOL held in escrow
  players: IPlayerState[];
  properties: {            // index => owner wallet pubkey
    [key: string]: string;
  };
  turnNumber: number;
  lastAction?: string;     // human-readable last event
  createdAt: Date;
  updatedAt: Date;
}

const PlayerStateSchema = new Schema<IPlayerState>({
  wallet:   { type: String, required: true },
  position: { type: Number, default: 0 },
  balance:  { type: Number, default: 0.20 },
  bankrupt: { type: Boolean, default: false },
  jailTurns:{ type: Number, default: 0 },
}, { _id: false });

const GameSchema = new Schema<IGame>(
  {
    status:       { type: String, enum: ["waiting", "active", "finished"], default: "waiting" },
    player1:      { type: String, required: true },
    player2:      { type: String },
    currentTurn:  { type: String },
    winner:       { type: String },
    escrowBalance:{ type: Number, default: 0 },
    players:      [PlayerStateSchema],
    properties:   { type: Map, of: String, default: {} },
    turnNumber:   { type: Number, default: 0 },
    lastAction:   { type: String },
  },
  { timestamps: true }
);

const Game: Model<IGame> =
  mongoose.models.Game || mongoose.model<IGame>("Game", GameSchema);

export default Game;
