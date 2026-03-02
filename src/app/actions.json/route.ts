import { NextRequest } from "next/server";
import { corsResponse, corsOptions } from "@/lib/cors";

export async function GET() {
  return corsResponse({
    rules: [
      {
        pathPattern: "/api/actions/**",
        apiPath: "/api/actions/**",
      },
    ],
  });
}

export async function OPTIONS(_req: NextRequest) {
  return corsOptions();
}
