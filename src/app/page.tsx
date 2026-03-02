"use client";

import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#00392b] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-[#f0f0f0] border-8 border-[#00392b] rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-[#cc0000] p-6 text-center border-b-8 border-[#00392b]">
          <h1 className="text-5xl font-black uppercase tracking-tighter text-white drop-shadow-lg">
            Monopoly Blink
          </h1>
          <p className="text-xl font-bold mt-2 text-white/90">
            Solana Devnet Edition
          </p>
        </div>

        <div className="p-8 flex flex-col items-center space-y-8 bg-white text-[#00392b]">
          <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-4 border-[#00392b] shadow-lg hover:scale-105 transition-transform">
            <Image
              src="/monopoly-icon.png"
              alt="Monopoly Blink Icon"
              fill
              className="object-cover"
            />
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black uppercase">Start Your Empire</h2>
            <p className="text-lg font-medium max-w-md mx-auto leading-relaxed">
              Experience the classic game reinvented as a Solana Blink. 
              Stake SOL, roll dice, buy properties, and bankrupt your opponent — 
              all within your wallet!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
            <div className="bg-[#e8f5e9] p-6 rounded-xl border-2 border-[#4caf50] flex flex-col items-center text-center">
              <span className="text-4xl mb-2">🎲</span>
              <h3 className="font-black text-xl mb-1">STAKE & PLAY</h3>
              <p className="text-sm font-bold opacity-75">0.1 SOL Entry Fee<br/>Winner takes all!</p>
            </div>
            <div className="bg-[#fff3e0] p-6 rounded-xl border-2 border-[#ff9800] flex flex-col items-center text-center">
              <span className="text-4xl mb-2">🔗</span>
              <h3 className="font-black text-xl mb-1">BLINK READY</h3>
              <p className="text-sm font-bold opacity-75">No frontend needed<br/>Play in your wallet</p>
            </div>
          </div>

          <div className="w-full flex flex-col items-center space-y-4 pt-4">
            <button
               onClick={() => {
                 window.location.href = "https://dial.to/?action=solana-action:" + window.location.origin + "/api/actions/monopoly/create";
               }}
               className="bg-[#cc0000] hover:bg-[#a30000] text-white text-2xl font-black py-4 px-10 rounded-full shadow-xl transform active:scale-95 transition-all uppercase tracking-widest border-4 border-[#00392b]"
            >
              Play Now (Dial.to)
            </button>
            <p className="text-xs font-bold uppercase tracking-widest opacity-50">
              Approved by OrbitFlare & Solana Foundation
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-white/50 text-sm font-bold uppercase tracking-widest">
        Built for Graveyard Hackathon 2026
      </footer>
    </main>
  );
}
