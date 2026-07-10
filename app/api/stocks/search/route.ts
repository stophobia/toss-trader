import { NextResponse } from "next/server";
import { searchStocks, type Market } from "@/lib/stocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stocks/search?q=삼성&limit=10&market=KR
 *
 * 시드 (~3,000개 KRX + US) + 런타임 캐시 통합 fuzzy 검색.
 * UI의 자동완성 dropdown이 호출.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit") || 10)));
  const marketParam = searchParams.get("market");
  const marketFilter: Market | undefined =
    marketParam === "KR" || marketParam === "US" ? marketParam : undefined;

  try {
    const results = await searchStocks(q, limit, marketFilter);
    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "종목 검색에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
