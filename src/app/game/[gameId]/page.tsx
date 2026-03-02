"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BOARD, BoardSquare } from "@/lib/game/board";

interface Player {
  wallet: string;
  position: number;
  positionName: string;
  balance: number;
  bankrupt: boolean;
  properties: string; // formatted summary string
}

interface GameStatus {
  gameId: string;
  status: string;
  turnNumber: number;
  currentTurn: string;
  winner: string;
  lastAction: string;
  players: Player[];
  escrowBalance: number;
  rollUrl: string;
  joinUrl: string;
  rawProperties: Record<string, string>; // square index -> owner wallet
}

// 30 squares, perimeter layout around a 9x8 CSS Grid:
// Bottom row = index 0 to 8 (9 squares, right-to-left)
// Left col = index 9 to 14 (6 squares, bottom-to-top)
// Top row = index 15 to 23 (9 squares, left-to-right)
// Right col = index 24 to 29 (6 squares, top-to-bottom)
function getGridPos(index: number) {
  if (index <= 8) return { gridRow: 8, gridColumn: 9 - index }; 
  if (index >= 9 && index <= 14) return { gridRow: 16 - index, gridColumn: 1 };
  if (index >= 15 && index <= 23) return { gridRow: 1, gridColumn: index - 14 };
  if (index >= 24 && index <= 29) return { gridRow: index - 22, gridColumn: 9 };
  return { gridRow: 1, gridColumn: 1 };
}

export default function GameBoard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<GameStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/actions/monopoly/${gameId}/status`);
        if (!res.ok) throw new Error("Game not found");
        const data = await res.json();
        setGame(data);
      } catch (err) {
        setError("Failed to load game");
        console.error(err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [gameId]);

  if (error) return <div className="min-h-screen bg-red-900 text-white flex items-center justify-center p-6 font-black text-2xl uppercase tracking-widest">{error}</div>;
  if (!game) return <div className="min-h-screen bg-[#00392b] text-white flex items-center justify-center p-6 animate-pulse font-black text-2xl uppercase tracking-widest">Loading Game State...</div>;

  const p1 = game.players[0];
  const p2 = game.players[1];

  return (
    <main className="min-h-screen bg-[#00392b] text-white p-4 font-sans flex items-center justify-center">
      <div className="w-full max-w-7xl mx-auto overflow-x-auto overflow-y-hidden py-4">
        
        {/* Monopoly Visual Grid Layout */}
        <div style={{
          minWidth: '900px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
          gap: '4px',
          backgroundColor: '#cc0000',
          padding: '8px',
          borderRadius: '16px',
          aspectRatio: '9/8',
          boxShadow: '0 25px 50px -12px rgba(0, 57, 43, 0.5)'
        }}>

          {/* Render 30 Perimeter Tiles */}
          {BOARD.map((square: BoardSquare) => {
            const { gridRow, gridColumn } = getGridPos(square.index);
            const isP1Here = p1?.position === square.index;
            const isP2Here = p2?.position === square.index;
            const owner = game.rawProperties?.[square.index.toString()];

            let baseBgClass = "bg-[#f8f9fa]"; // standard property
            if (square.type === "go") baseBgClass = "bg-[#ffeb3b]";
            if (square.type === "tax" || square.type === "jail" || square.type === "go_to_jail") baseBgClass = "bg-[#e0e0e0]";

            // Determine border color based on ownership
            let borderClass = "border-black/20";
            if (owner === p1?.wallet) borderClass = "border-[#cc0000] shadow-[inset_0_0_15px_rgba(204,0,0,0.3)]";
            else if (owner === p2?.wallet) borderClass = "border-[#00392b] shadow-[inset_0_0_15px_rgba(0,57,43,0.3)]";

            return (
              <div
                key={square.index}
                className={`relative flex flex-col items-center justify-center ${baseBgClass} text-black border-2 ${borderClass} rounded overflow-hidden text-center`}
                style={{ gridRow, gridColumn }}
              >
                {/* Property Header Color */}
                {square.color && (
                  <div className="absolute top-0 w-full h-1/4 min-h-[16px] border-b-2 border-black/30" style={{ backgroundColor: square.color }} />
                )}

                {/* Tokens */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 sm:gap-2 z-20 pointer-events-none">
                  {isP1Here && <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#cc0000] border-2 border-white shadow-xl translate-y-2 lg:translate-y-4" />}
                  {isP2Here && <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#000000] border-2 border-white shadow-xl -translate-y-2 lg:-translate-y-4" />}
                </div>

                <div className="z-10 mt-2 px-1 text-[10px] lg:text-xs font-black uppercase leading-[1.1] break-words">
                  {square.name}
                </div>
                
                {square.price ? (
                  <div className="z-10 mt-auto mb-1 text-[9px] lg:text-[10px] font-bold opacity-60">
                    {square.price} SOL
                  </div>
                ) : null}

                {/* Ownership bottom bar */}
                {owner === p1?.wallet && <div className="absolute bottom-0 w-full h-1.5 bg-[#cc0000]" />}
                {owner === p2?.wallet && <div className="absolute bottom-0 w-full h-1.5 bg-[#000000]" />}
              </div>
            );
          })}

          {/* Center Dashboard (Grid Center hollow area) */}
          <div style={{
            gridColumn: '2 / 9',
            gridRow: '2 / 8',
            backgroundColor: '#00392b',
            borderRadius: '12px',
            margin: '8px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            border: '6px solid white'
          }} className="space-y-6 text-white text-center">
            
            <div className="flex justify-between items-center border-b-2 border-white/20 pb-4">
               <div>
                  <h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter text-[#ffeb3b]">
                    Game #{game.gameId.slice(-6)}
                  </h1>
                  <p className="font-bold text-xs uppercase tracking-widest opacity-80 mt-1">
                    Turn #{game.turnNumber} • Escrow: {game.escrowBalance.toFixed(2)} SOL
                  </p>
               </div>
               
               {game.status === "finished" && (
                 <div className="bg-[#cc0000] px-4 py-2 rounded font-black uppercase shadow-lg">
                   🏆 WINNER: {game.winner.slice(0, 8)}...
                 </div>
               )}
            </div>

            <div className="bg-white/10 p-4 rounded-xl shadow-lg border-2 border-dashed border-white/20 my-auto text-lg lg:text-2xl font-black uppercase leading-relaxed h-[100px] flex items-center justify-center italic text-[#ffeb3b]">
              "{game.lastAction || "Waiting for Player 2"}"
            </div>

            {/* Players Status Horizontal */}
            <div className="flex justify-around gap-4 w-full">
              {/* P1 */}
              <div className={`p-4 rounded-xl border-4 flex-1 text-left ${game.currentTurn === p1?.wallet ? 'border-[#ffeb3b] bg-white text-black shadow-xl transform scale-105 transition-transform' : 'border-[#cc0000] bg-[#cc0000]/20 text-white'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#cc0000] border-2 border-white" />
                    <span className="font-black uppercase text-sm">Player 1</span>
                  </div>
                  <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">{p1 ? `${p1.balance.toFixed(3)} SOL` : 'Wait...'}</span>
                </div>
                <p className="text-[10px] font-mono break-all opacity-80">{p1?.wallet || "Host..."}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">📍 {p1?.positionName || "GO"}</p>
              </div>

               {/* P2 */}
              <div className={`p-4 rounded-xl border-4 flex-1 text-left ${game.currentTurn === p2?.wallet ? 'border-[#ffeb3b] bg-white text-black shadow-xl transform scale-105 transition-transform' : 'border-[#000000] bg-black/40 text-white'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#000000] border-2 border-white" />
                    <span className="font-black uppercase text-sm">Player 2</span>
                  </div>
                  <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">{p2 ? `${p2.balance.toFixed(3)} SOL` : 'Wait...'}</span>
                </div>
                <p className="text-[10px] font-mono break-all opacity-80">{p2?.wallet || "Waiting..."}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">📍 {p2?.positionName || "GO"}</p>
              </div>
            </div>

            {/* Blink Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-between mt-auto">
                <div className="bg-white p-3 rounded-xl border-2 border-dashed border-gray-400 text-black flex-1 text-left">
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                    {game.status === "waiting" ? "🔗 Share with Player 2 to join" : "Player 2 Join Link"}
                  </p>
                  <code className="text-[9px] font-mono block mb-2 bg-gray-100 p-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">{game.joinUrl}</code>
                  <a href={game.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-block w-full bg-[#00392b] hover:bg-[#002219] text-white font-black text-[10px] py-2 rounded text-center uppercase tracking-widest transition-colors">
                    Join via Dial.to →
                  </a>
                </div>

                {game.status === "active" && (
                <div className="bg-[#cc0000]/10 p-3 rounded-xl border-2 border-[#cc0000] text-black flex-1 text-left bg-white">
                  <p className="text-[10px] font-black uppercase text-[#cc0000] mb-1">
                    🎲 Current Player Roll
                  </p>
                  <code className="text-[9px] font-mono block mb-2 bg-gray-100 p-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">{game.rollUrl}</code>
                  <a href={game.rollUrl} target="_blank" rel="noopener noreferrer" className="inline-block w-full bg-[#cc0000] hover:bg-[#a30000] text-white font-black text-[10px] py-2 rounded text-center uppercase tracking-widest transition-colors animate-pulse">
                    Open Action in Dial.to →
                  </a>
                </div>
                )}
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}
