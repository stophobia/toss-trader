/**
 * lib/candles.ts — toss-trader 캔들 차트 helper (v1.4)
 *
 * 토스 Open API /api/v1/candles GET wrapper.
 * interval: '1m' (분) | '1d' (일)
 * count: integer (기본 100, 최대 ~200)
 *
 * v1.4: 단일 종목 (selected symbol) 일간 캔들.
 *       polling 5분 (일간이라 분 단위 의미 X)
 */

export type CandleInterval = "1m" | "1d";

export const CANDLE_INTERVALS: ReadonlyArray<{
  value: CandleInterval;
  label: string;
}> = [
  { value: "1d", label: "일봉" },
  { value: "1m", label: "분봉" },
] as const;

export const DEFAULT_CANDLE_COUNT = 30;

export interface Candle {
  /** timestamp (epoch ms or ISO) */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * 토스 candles API 응답 정규화.
 * 응답 형식 가정: { result: [...candles] } 또는 직접 배열.
 */
function normalizeCandles(raw: unknown): Candle[] {
  if (Array.isArray(raw)) return raw as Candle[];
  if (raw && typeof raw === "object" && "result" in raw) {
    const r = (raw as { result: unknown }).result;
    if (Array.isArray(r)) return r as Candle[];
  }
  return [];
}

export interface FetchCandlesOptions {
  symbol: string;
  interval?: CandleInterval;
  count?: number;
  signal?: AbortSignal;
}

export interface FetchCandlesResult {
  candles: Candle[];
  availability: "available" | "readonly" | "disabled";
  message?: string;
}

/**
 * GET /api/toss/api/v1/candles?interval=...&count=...&symbol=...
 * (v1.4: symbol은 query param으로 — 원본은 path param이지만
 *  catch-all relay는 path + query 모두 처리하므로 query로 통일)
 */
export async function fetchCandles(
  opts: FetchCandlesOptions
): Promise<FetchCandlesResult> {
  if (!opts.symbol) {
    return { candles: [], availability: "disabled", message: "symbol 필요" };
  }
  const interval = opts.interval ?? "1d";
  const count = opts.count ?? DEFAULT_CANDLE_COUNT;

  try {
    const params = new URLSearchParams({
      symbol: opts.symbol,
      interval,
      count: String(count),
    });
    const res = await fetch(`/api/toss/api/v1/candles?${params.toString()}`, {
      cache: "no-store",
      signal: opts.signal,
    });
    if (!res.ok) {
      if (res.status === 429) {
        return {
          candles: [],
          availability: "readonly",
          message: `Rate limit 초과 (${res.status}). 5분 후 재시도.`,
        };
      }
      return {
        candles: [],
        availability: "readonly",
        message: `캔들 조회 실패: ${res.status} ${res.statusText}`,
      };
    }
    const body = (await res.json()) as { data?: unknown; result?: unknown };
    // envelope: { data: { result: [...] } } 또는 { data: [...] }
    let raw: unknown = body;
    if (body && typeof body === "object" && "data" in body) {
      raw = (body as { data: unknown }).data;
    }
    const candles = normalizeCandles(raw);
    return { candles, availability: "available" };
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      return { candles: [], availability: "readonly", message: "취소됨" };
    }
    return {
      candles: [],
      availability: "readonly",
      message: `네트워크 오류: ${(e as Error).message}`,
    };
  }
}

/**
 * 캔들 데이터의 통계 계산 (차트 Y축 스케일용)
 */
export interface CandleStats {
  min: number;
  max: number;
  range: number;
  latest: number;
  change: number; // latest - first
  changePct: number; // (change / first) * 100
}

export function calcCandleStats(candles: ReadonlyArray<Candle>): CandleStats | null {
  if (candles.length === 0) return null;
  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const first = closes[0]!;
  const latest = closes[closes.length - 1]!;
  const change = latest - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  return {
    min,
    max,
    range: max - min,
    latest,
    change,
    changePct,
  };
}
