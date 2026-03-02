"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";

interface Player {
  wallet: string;
  position: number;
  positionName: string;
  balance: number;
  bankrupt: boolean;
  properties: string;
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
}

const BOARD_SQUARES = 30;

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
    <main className="min-h-screen bg-[#00392b] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-white text-[#00392b] p-6 rounded-2xl border-8 border-[#cc0000] shadow-2xl">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">
              Game #{game.gameId.slice(-6)}
            </h1>
            <p className="font-bold text-sm opacity-60 uppercase tracking-widest mt-1">
              {game.status === "active" ? "🟢 Status: Active Battle" : game.status === "finished" ? "🏁 Status: Game Finished" : "⏳ Status: Awaiting Player 2"}
            </p>
          </div>
          
          <div className="flex space-x-4 mt-4 md:mt-0">
            <div className="bg-[#cc0000] text-white px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest shadow-lg">
              Escrow: {game.escrowBalance.toFixed(2)} SOL
            </div>
            <div className="bg-[#4caf50] text-white px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest shadow-lg">
              Turn #{game.turnNumber}
            </div>
          </div>
        </div>

        {/* Game Stats & Board Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Player Cards */}
          <div className="space-y-6">
            <PlayerCard player={p1} isCurrent={game.currentTurn === p1?.wallet} title="Player 1 (Host)" color="#cc0000" />
            <PlayerCard player={p2} isCurrent={game.currentTurn === p2?.wallet} title="Player 2 (Opponent)" color="#00392b" />
            
            {/* Action Log */}
            <div className="bg-white/10 p-6 rounded-2xl border-4 border-white/20">
              <h3 className="text-xl font-black uppercase tracking-widest mb-4 border-b-2 border-white/20 pb-2">Action Log</h3>
              <p className="font-mono text-sm leading-relaxed italic opacity-90 break-words">
                {game.lastAction || "Awaiting first move..."}
              </p>
            </div>
          </div>

          {/* Board & Share */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-8 border-8 border-white shadow-2xl overflow-hidden min-h-[400px] flex flex-col items-center justify-center text-[#00392b]">
              <Image src="/monopoly-icon.png" alt="Board" width={150} height={150} className="mb-6 opacity-80" />
              <div className="text-center">
                 <h4 className="text-3xl font-black uppercase mb-4 tracking-tighter">Blink Links</h4>
                 <div className="space-y-4">
                    <div className="bg-gray-100 p-4 rounded-xl border-2 border-dashed border-gray-400">
                      <p className="text-xs font-black uppercase text-gray-500 mb-1">Create Shareable URL</p>
                      <code className="text-xs break-all font-mono font-bold bg-white p-2 rounded block">
                        {game.joinUrl}
                      </code>
                    </div>
                    {game.status === "active" && (
                    <div className="bg-[#cc0000]/10 p-4 rounded-xl border-2 border-[#cc0000]">
                      <p className="text-xs font-black uppercase text-[#cc0000] mb-1">Current Turn URL (Copy to Dial.to)</p>
                      <code className="text-xs break-all font-mono font-bold bg-white p-2 rounded block">
                        {game.rollUrl}
                      </code>
                    </div>
                    )}
                 </div>
              </div>
            </div>

            {game.status === "finished" && (
              <div className="bg-[#ffeb3b] text-black p-8 rounded-2xl border-8 border-white shadow-2xl text-center">
                <h2 className="text-5xl font-black uppercase tracking-tighter mb-4">🏆 Winner!</h2>
                <p className="text-xl font-bold break-all opacity-80 mb-6 px-4">
                  {game.winner}
                </p>
                <div className="text-xs font-black uppercase tracking-widest bg-black text-white py-2 px-4 rounded-full inline-block">
                  Prize Paid Out on Devnet
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function PlayerCard({ player, isCurrent, title }: { player: Player | undefined; isCurrent: boolean; title: string; color: string }) {
  if (!player) return (
    <div className="bg-white/5 p-6 rounded-2xl border-4 border-dashed border-white/20 text-center py-12">
      <p className="text-sm font-black uppercase tracking-widest opacity-30">Awaiting Challenger...</p>
    </div>
  );

  return (
    <div className={`p-6 rounded-2xl border-4 transition-all ${isCurrent ? "bg-white shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-105" : "bg-white/10 border-white/20 opacity-80"}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
           <p className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? "text-indigo-600" : "text-white/40"}`}>
             {isCurrent ? "⚡ Current Turn" : "⏳ Waiting"}
           </p>
           <h3 className={`text-xl font-black uppercase tracking-tighter ${isCurrent ? "text-black" : "text-white"}`}>
             {title}
           </h3>
        </div>
        <div className="bg-[#4caf50] text-white font-black px-2 py-1 rounded text-[10px] uppercase shadow-lg">
          {player.balance.toFixed(3)} SOL
        </div>
      </div>
      
      <div className={`space-y-3 font-bold text-xs ${isCurrent ? "text-black/70" : "text-white/60"}`}>
        <div className="flex justify-between">
          <span className="uppercase tracking-widest opacity-50">Pos:</span>
          <span className={`uppercase font-black ${isCurrent ? "text-black" : "text-white"}`}>{player.positionName} (#{player.position})</span>
        </div>
        <div className="flex justify-between">
          <span className="uppercase tracking-widest opacity-50">Wallet:</span>
          <span className="font-mono text-[9px]">{player.wallet.slice(0, 12)}...</span>
        </div>
        <div>
          <span className="uppercase tracking-widest opacity-50 block mb-1">Properties:</span>
          <p className={`p-2 rounded italic text-[10px] leading-tight ${isCurrent ? "bg-gray-100" : "bg-black/20"}`}>
            {player.properties || "None yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
