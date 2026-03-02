import { NextResponse } from "next/server";

export const ACTIONS_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-action-version, x-blockchain-ids",
  "Access-Control-Expose-Headers":
    "x-action-version, x-blockchain-ids",
  "x-action-version": "2.1.3",
  // "x-blockchain-ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  "x-blockchain-ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
};

export function corsResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: ACTIONS_CORS_HEADERS,
  });
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: ACTIONS_CORS_HEADERS });
}
