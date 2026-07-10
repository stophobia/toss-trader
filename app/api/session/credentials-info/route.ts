import { NextResponse } from "next/server";

/**
 * Reports whether default API credentials are available via environment
 * variables, WITHOUT returning the values themselves. The UI uses this to
 * decide whether to enable the "기본 키로 시작" shortcut.
 *
 * Env vars: TOSSINVEST_DEFAULT_API_KEY, TOSSINVEST_DEFAULT_SECRET_KEY.
 * Both must be present for `available` to be true.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.TOSSINVEST_DEFAULT_API_KEY?.trim() || "";
  const secretKey = process.env.TOSSINVEST_DEFAULT_SECRET_KEY?.trim() || "";
  const available = Boolean(apiKey && secretKey);

  // Surface length only as a sanity check — never echo the value.
  return NextResponse.json({
    available,
    apiKeyLength: apiKey.length,
    secretKeyLength: secretKey.length,
  });
}
