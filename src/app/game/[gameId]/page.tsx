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

// 20 squares, perimeter layout around a 6x6 CSS Grid:
// Bottom row = index 0 to 5 (6 squares, right-to-left)
// Left col = index 6 to 9 (4 squares, bottom-to-top)
// Top row = index 10 to 15 (6 squares, left-to-right)
// Right col = index 16 to 19 (4 squares, top-to-bottom)
function getGridPos(index: number) {
  if (index <= 5) return { gridRow: 6, gridColumn: 6 - index }; 
  if (index >= 6 && index <= 9) return { gridRow: 11 - index, gridColumn: 1 };
  if (index >= 10 && index <= 15) return { gridRow: 1, gridColumn: index - 9 };
  if (index >= 16 && index <= 19) return { gridRow: index - 14, gridColumn: 6 };
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
        <div className="mx-auto mt-2" style={{
          maxWidth: '650px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(6, minmax(0, 1fr))',
          gap: '4px',
          backgroundColor: '#cc0000',
          padding: '6px',
          borderRadius: '16px',
          aspectRatio: '1/1',
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
                  <div className="absolute top-0 w-full h-[12px] lg:h-[16px] border-b border-black/30" style={{ backgroundColor: square.color }} />
                )}

                {/* Tokens (pulse if current turn) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 z-30 pointer-events-none items-center justify-center">
                  {isP1Here && (
                    <div className={`text-xl sm:text-2xl filter drop-shadow-md lg:translate-y-2 ${game.currentTurn === p1?.wallet ? 'animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : ''}`}>
                      🎩
                    </div>
                  )}
                  {isP2Here && (
                    <div className={`text-xl sm:text-2xl filter drop-shadow-md lg:-translate-y-2 ${game.currentTurn === p2?.wallet ? 'animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : ''}`}>
                      🏎️
                    </div>
                  )}
                </div>

                {/* Property Icon (The "Picture") */}
                {square.icon && (
                  <div className="z-10 mt-2 text-xl sm:text-2xl lg:text-3xl drop-shadow-sm opacity-90 select-none">
                    {square.icon}
                  </div>
                )}

                <div className="z-10 mt-1 px-1 text-[7px] lg:text-[9px] font-black uppercase leading-[1] break-words max-w-[90%]">
                  {square.name}
                </div>
                
                {square.price ? (
                  <div className="z-10 mt-auto mb-1.5 text-[7px] lg:text-[8px] font-bold opacity-70">
                    {square.price} SOL
                  </div>
                ) : null}

                {/* Ownership bottom bar */}
                {owner === p1?.wallet && <div className="absolute bottom-0 w-full h-1 bg-[#cc0000]" />}
                {owner === p2?.wallet && <div className="absolute bottom-0 w-full h-1 bg-[#000000]" />}
              </div>
            );
          })}

          {/* Center Dashboard (Grid Center hollow area) */}
          <div style={{
            gridColumn: '2 / 5',
            gridRow: '2 / 6',
            backgroundColor: '#00392b',
            borderRadius: '12px',
            margin: '6px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            border: '4px solid white'
          }} className="space-y-3 text-white text-center">
            
            <div className="flex justify-between items-center border-b border-white/20 pb-2">
               <div>
                  <h1 className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-[#ffeb3b] leading-none">
                    Game #{game.gameId.slice(-6)}
                  </h1>
                  <p className="font-bold text-[8px] lg:text-[10px] uppercase tracking-widest opacity-80 mt-1">
                    Turn #{game.turnNumber} • Escrow: {game.escrowBalance.toFixed(2)} SOL
                  </p>
               </div>
               
               {game.status === "finished" && (
                 <div className="bg-[#cc0000] px-4 py-2 rounded font-black uppercase shadow-lg">
                   🏆 WINNER: {game.winner.slice(0, 8)}...
                 </div>
               )}
            </div>

            <div className="bg-white/10 p-2 rounded-lg shadow-inner border border-dashed border-white/20 my-auto text-sm lg:text-md font-black uppercase leading-tight h-[60px] flex items-center justify-center italic text-[#ffeb3b]">
              "{game.lastAction || "Waiting for Player 2"}"
            </div>

            {/* Players Status Horizontal */}
            <div className="flex justify-around gap-2 w-full">
              {/* P1 */}
              <div className={`p-2 rounded-lg border-2 flex-1 text-left flex flex-col justify-between ${game.currentTurn === p1?.wallet ? 'border-[#ffeb3b] bg-white text-black shadow-md transform scale-105 transition-transform' : 'border-white/20 bg-white/10 text-white'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">🎩</span>
                    <span className="font-black uppercase text-[10px]">P1</span>
                  </div>
                  <span className={`${game.currentTurn === p1?.wallet ? 'bg-black text-white' : 'bg-white/20 text-white'} px-1 py-0.5 rounded text-[9px] font-bold`}>{p1 ? `${p1.balance.toFixed(2)}` : '...'}</span>
                </div>
                <div className="bg-black/5 px-1 py-0.5 mt-auto rounded flex justify-between items-center">
                   <span className="text-[7px] uppercase font-bold opacity-50">Loc</span>
                   <span className="text-[8px] font-black uppercase tracking-wide text-[#cc0000]">{p1?.positionName || "GO"}</span>
                </div>
              </div>

               {/* P2 */}
               <div className={`p-2 rounded-lg border-2 flex-1 text-left flex flex-col justify-between ${game.currentTurn === p2?.wallet ? 'border-[#ffeb3b] bg-white text-black shadow-md transform scale-105 transition-transform' : 'border-white/20 bg-white/10 text-white'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">🏎️</span>
                    <span className="font-black uppercase text-[10px]">P2</span>
                  </div>
                  <span className={`${game.currentTurn === p2?.wallet ? 'bg-black text-white' : 'bg-white/20 text-white'} px-1 py-0.5 rounded text-[9px] font-bold`}>{p2 ? `${p2.balance.toFixed(2)}` : '...'}</span>
                </div>
                <div className="bg-black/5 px-1 py-0.5 mt-auto rounded flex justify-between items-center">
                   <span className="text-[7px] uppercase font-bold opacity-50">Loc</span>
                   <span className="text-[8px] font-black uppercase tracking-wide text-[#000000]">{p2?.positionName || "GO"}</span>
                </div>
              </div>
            </div>

            {/* Blink Actions */}
            <div className="flex flex-col gap-2 justify-between mt-auto">
                {game.status === "waiting" && (
                  <div className="bg-white p-2 rounded-lg border border-dashed border-gray-400 text-black w-full text-left">
                    <p className="text-[8px] font-black uppercase text-gray-500 mb-0.5">
                      🔗 Share with Player 2 to join
                    </p>
                    <code className="text-[7px] font-mono block mb-1 bg-gray-100 p-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">{game.joinUrl}</code>
                    <a href={game.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-block w-full bg-[#00392b] hover:bg-[#002219] text-white font-black text-[9px] py-1.5 rounded text-center uppercase tracking-widest transition-colors">
                      Join via Dial.to →
                    </a>
                  </div>
                )}

                {game.status === "active" && (
                <div className="bg-white p-2 rounded-lg border-2 border-[#cc0000] text-black w-full text-left">
                  <p className="text-[8px] font-black uppercase text-[#cc0000] mb-0.5">
                    🎲 Current Player Roll Action
                  </p>
                  <code className="text-[7px] font-mono block mb-1 bg-gray-100 p-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">{game.rollUrl}</code>
                  <a href={game.rollUrl} target="_blank" rel="noopener noreferrer" className="inline-block w-full bg-[#cc0000] hover:bg-[#a30000] text-white font-black text-[9px] py-1.5 rounded text-center uppercase tracking-widest transition-colors animate-pulse">
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
