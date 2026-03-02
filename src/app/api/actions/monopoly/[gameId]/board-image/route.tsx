import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import React from "react";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const p1Pos = parseInt(searchParams.get("p1Pos") || "0");
    const p2Pos = parseInt(searchParams.get("p2Pos") || "0");
    const p1Bal = searchParams.get("p1Bal") || "0";
    const p2Bal = searchParams.get("p2Bal") || "0";
    const lastAction = searchParams.get("action") || "Game Started!";
    const turn = searchParams.get("turn") || "P1";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#00392b",
            padding: "40px",
            fontFamily: "sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              marginBottom: "20px",
              paddingBottom: "10px",
              borderBottom: "4px solid #cc0000",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "white", fontSize: "32px", fontWeight: "black", textTransform: "uppercase" }}>
                Monopoly Blink
              </span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", fontWeight: "bold" }}>
                {turn}'s Turn | Devnet
              </span>
            </div>
            <div style={{ backgroundColor: "#cc0000", padding: "5px 15px", borderRadius: "10px", display: "flex", alignItems: "center" }}>
              <span style={{ color: "white", fontSize: "20px", fontWeight: "black" }}>MVP</span>
            </div>
          </div>

          {/* Player Stats */}
          <div style={{ display: "flex", width: "100%", gap: "20px", marginBottom: "20px" }}>
            <div style={{ flex: 1, backgroundColor: "white", borderRadius: "15px", padding: "15px", display: "flex", flexDirection: "column", border: turn === "P1" ? "6px solid #ffeb3b" : "none" }}>
              <span style={{ color: "#cc0000", fontSize: "14px", fontWeight: "black" }}>PLAYER 1</span>
              <span style={{ color: "#00392b", fontSize: "24px", fontWeight: "black" }}>{p1Bal} <small style={{ fontSize: "12px" }}>SOL</small></span>
              <span style={{ color: "#00392b", fontSize: "12px", opacity: 0.6 }}>Square #{p1Pos}</span>
            </div>
            <div style={{ flex: 1, backgroundColor: "white", borderRadius: "15px", padding: "15px", display: "flex", flexDirection: "column", border: turn === "P2" ? "6px solid #ffeb3b" : "none" }}>
              <span style={{ color: "#00392b", fontSize: "14px", fontWeight: "black" }}>PLAYER 2</span>
              <span style={{ color: "#00392b", fontSize: "24px", fontWeight: "black" }}>{p2Bal} <small style={{ fontSize: "12px" }}>SOL</small></span>
              <span style={{ color: "#00392b", fontSize: "12px", opacity: 0.6 }}>Square #{p2Pos}</span>
            </div>
          </div>

          {/* Action Text */}
          <div
            style={{
              width: "100%",
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: "15px",
              padding: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "white", fontSize: "24px", fontWeight: "bold", textAlign: "center", fontStyle: "italic" }}>
              {lastAction}
            </span>
          </div>

          {/* Footer */}
          <div style={{ position: "absolute", bottom: "10px", right: "20px", display: "flex" }}>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", fontWeight: "black", textTransform: "uppercase" }}>
              OrbitFlare Track
            </span>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 600,
      }
    );
  } catch (err: any) {
    return new Response("Failed to generate image", { status: 500 });
  }
}
