import { NextResponse } from "next/server";
import { authenticate, tossFetchAuthed, TossinvestError } from "@/lib/tossinvest";
import { getAllCachedEntries, upsertStockEntries } from "@/lib/stocks-cache";
import {
  POPULAR_STOCKS,
  getPopularKrSymbols,
  getPopularSymbols,
  getPopularUsSymbols,
} from "@/lib/popular-stocks";
import { getSession } from "@/lib/session-store";
import type { Market } from "@/lib/stocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/stocks/refresh
 *
 * 토스 Open API에 인기 종목 ~200개를 batch fetch 해서 stocks-cache.json에
 * 추가. 사용자가 검색 dropdown을 새로고침할 때 호출.
 *
 * 흐름:
 *   1) 세션에서 사용자 자격증명 사용 (POST 본문은 불필요)
 *   2) 토큰 발급 (캐시됨 — 즉시)
 *   3) accounts 조회 (캐시 안 됨 — 1회)
 *   4) /api/v1/stocks?symbols=AAPL,MSFT,NVDA,... (200개 batch) → 1회
 *   5) 응답을 upsertStockEntries로 캐시 갱신
 *   6) { added, total, errors } 반환
 *
 * 새 상장 종목은 이 endpoint로 자동 추가되지 않음 (시드 + 인기 종목에
 * 포함되어야 함). 하지만 사용자가 직접 분석을 시작하면 stockInfo 결과가
 * market-context에서 캐시에 자동 추가되므로, 시간이 지나며 검색 결과가
 * 점진적으로 풍부해진다.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    /** Optional: 사용자가 직접 입력한 symbol도 함께 fetch. e.g. 상장 직후 종목. */
    extraSymbols?: string[];
  };
  // URL query: ?market=US | KR | all (기본 all)
  const marketParam = url.searchParams.get("market");
  const marketFilter: "KR" | "US" | "all" =
    marketParam === "US" || marketParam === "KR" ? marketParam : "all";

  const session = getSession(body.sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "활성 세션이 없습니다. 시작 버튼을 먼저 눌러주세요." },
      { status: 404 },
    );
  }

  try {
    // 1) 인증
    const { account } = await authenticate(session.apiKey, session.secretKey);

    // 2) batch fetch — 마켓 필터 적용
    const baseSymbols =
      marketFilter === "US"
        ? getPopularUsSymbols()
        : marketFilter === "KR"
          ? getPopularKrSymbols()
          : getPopularSymbols();

    // 3) batch fetch — 인기 종목 + 사용자 추가 종목 (dedup, 100개 cap)
    //    Toss API는 100개 이상 batch에서 500 반환하는 케이스가 있어 100 cap.
    const allSymbols = Array.from(
      new Set([...baseSymbols, ...(body.extraSymbols ?? [])]),
    ).slice(0, 100);

    const stocksPath = `/api/v1/stocks?symbols=${allSymbols.map(encodeURIComponent).join(",")}`;
    const result = await tossFetchAuthed<{ result: StockInfoDto[] }>(stocksPath, {
      apiKey: session.apiKey,
      secretKey: session.secretKey,
      accountSeq: account.accountSeq,
    });

    // 3) 응답 정규화 → 캐시 upsert
    //    market은 (a) 토스 응답의 market 필드 (KRX/NASDAQ/...) 가 있으면 그걸로,
    //    없으면 (b) 우리가 보낸 symbol 리스트의 market 매핑으로 결정.
    const symbolMarket = new Map<string, Market>();
    for (const s of POPULAR_STOCKS) {
      symbolMarket.set(s.symbol, s.market);
    }
    function inferMarket(dto: StockInfoDto): Market {
      const raw = (dto.market || "").toUpperCase();
      if (raw === "US" || raw.includes("NASDAQ") || raw.includes("NYSE") || raw.includes("AMEX")) {
        return "US";
      }
      return "KR";
    }

    const list = Array.isArray(result?.result) ? result.result : [];
    const entries = list
      .filter((s) => s && typeof s === "object" && s.symbol && s.name)
      .map((s) => {
        const fromDto = inferMarket(s);
        const market: Market = fromDto === "KR" && symbolMarket.has(s.symbol)
          ? (symbolMarket.get(s.symbol) as Market)
          : fromDto;
        return {
          symbol: s.symbol,
          name: s.name,
          englishName: s.englishName,
          market,
          currency: s.currency,
        };
      });

    if (entries.length > 0) {
      await upsertStockEntries(entries);
    }

    // 4) 통계 — 캐시에 총 몇 개 있는지
    const total = (await getAllCachedEntries()).length;

    // 5) 응답에 빠진 symbol 목록 (Toss API가 거부/무시한 것) 포함
    const returnedSymbols = new Set(entries.map((e) => e.symbol));
    const missing = allSymbols.filter((s) => !returnedSymbols.has(s));

    return NextResponse.json({
      added: entries.length,
      total,
      market: marketFilter,
      missing,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof TossinvestError
            ? `Toss API 오류: ${error.message}`
            : error instanceof Error
              ? error.message
              : "마스터 새로고침에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}

type StockInfoDto = {
  symbol: string;
  name: string;
  englishName?: string;
  market?: string;
  currency?: string;
};
