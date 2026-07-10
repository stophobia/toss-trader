import { NextResponse } from "next/server";
import { createSession, getSession, redactSession } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KeySource = "env" | "user" | "mixed";

/**
 * Resolve API credentials, falling back to .env.local defaults when the
 * caller did not supply them.
 *
 * Env var names: TOSSINVEST_DEFAULT_API_KEY, TOSSINVEST_DEFAULT_SECRET_KEY.
 * These are read from process.env (Next.js auto-loads .env.local). Neither
 * value is ever echoed back to the client — only the source label.
 */
function resolveCredentials(input: {
  apiKey?: string;
  secretKey?: string;
}): {
  apiKey: string;
  secretKey: string;
  keySource: KeySource;
} | null {
  const userApi = input.apiKey?.trim() || "";
  const userSecret = input.secretKey?.trim() || "";
  const envApi = process.env.TOSSINVEST_DEFAULT_API_KEY?.trim() || "";
  const envSecret = process.env.TOSSINVEST_DEFAULT_SECRET_KEY?.trim() || "";

  const apiKey = userApi || envApi;
  const secretKey = userSecret || envSecret;

  if (!apiKey || !secretKey) return null;

  let keySource: KeySource;
  if (userApi && userSecret) keySource = "user";
  else if (!userApi && !userSecret) keySource = "env";
  else keySource = "mixed";

  return { apiKey, secretKey, keySource };
}

export async function GET() {
  const session = getSession();
  return NextResponse.json({
    session: session ? redactSession(session) : null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apiKey?: string;
    secretKey?: string;
    instructions?: string;
    intervalSeconds?: number;
  };

  const resolved = resolveCredentials({
    apiKey: body.apiKey,
    secretKey: body.secretKey,
  });

  if (!resolved) {
    const envAvailable = Boolean(
      process.env.TOSSINVEST_DEFAULT_API_KEY &&
        process.env.TOSSINVEST_DEFAULT_SECRET_KEY,
    );
    return NextResponse.json(
      {
        error: envAvailable
          ? "API Key와 Secret Key가 모두 필요합니다."
          : "API Key와 Secret Key가 필요합니다. .env.local에 TOSSINVEST_DEFAULT_API_KEY / TOSSINVEST_DEFAULT_SECRET_KEY를 설정하거나 화면에서 직접 입력하세요.",
      },
      { status: 400 },
    );
  }

  const intervalSeconds = Math.max(
    30,
    Math.min(3600, Number(body.intervalSeconds || 60)),
  );

  const session = createSession({
    apiKey: resolved.apiKey,
    secretKey: resolved.secretKey,
    instructions: body.instructions || "",
    intervalSeconds,
  });

  return NextResponse.json({
    session,
    keySource: resolved.keySource,
  });
}
