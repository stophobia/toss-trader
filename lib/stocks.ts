/**
 * lib/stocks.ts — toss-trader 종목 마스터 (v2 — 동적 캐시)
 *
 * 토스 Open API는 종목 검색 endpoint 없음. 대안:
 *   1. lib/stocks-seed.json (빌드 시 KRX 2,872종목 + US 57종목) — 정적 시드
 *   2. lib/stocks-cache.ts (런타임 캐시) — 사용자가 분석한 종목의 stockInfo 누적
 *
 * 두 소스를 합쳐서 메모리에서 검색. 캐시는 30일 TTL.
 *
 * 업데이트:
 *   - 시드 갱신: lib/stocks-seed.json 직접 편집 후 배포
 *   - 캐시 갱신: 사용자가 분석 시작 시 자동 (lib/market-context.ts에서 upsert)
 */

import { getAllCachedEntries, type StockEntry } from "@/lib/stocks-cache";

export type Market = "KR" | "US";

export interface StockMaster {
  symbol: string;
  name: string;
  market: Market;
}

// 시드 import — Next.js는 JSON import를 정적으로 처리
// (2,929 종목, ~190KB, 빌드 타임에 inline)
import seedData from "./stocks-seed.json";

const SEED: StockMaster[] = (seedData as StockEntry[]).map((e) => ({
  symbol: e.symbol,
  name: e.name,
  market: e.market,
}));

// ─── 캐시 인덱스 (lazy build) ─────────────────────────────────
let cacheIndex: Map<string, StockMaster> | null = null;
let cacheBuildPromise: Promise<Map<string, StockMaster>> | null = null;

async function buildCacheIndex(): Promise<Map<string, StockMaster>> {
  const index = new Map<string, StockMaster>();
  // 1) 시드를 먼저 채움
  for (const s of SEED) {
    index.set(s.symbol, s);
  }
  // 2) 런타임 캐시로 덮어쓰기 (이름/영문명이 더 정확할 수 있음)
  try {
    const cached = await getAllCachedEntries();
    for (const e of cached) {
      index.set(e.symbol, {
        symbol: e.symbol,
        name: e.name,
        market: e.market,
      });
    }
  } catch {
    // 캐시 로드 실패는 무시 (시드만으로 동작)
  }
  return index;
}

/**
 * 검색용 통합 인덱스. 시드 + 런타임 캐시. 한 번 빌드 후 메모리.
 */
async function getMasterIndex(): Promise<Map<string, StockMaster>> {
  if (cacheIndex) return cacheIndex;
  if (!cacheBuildPromise) {
    cacheBuildPromise = buildCacheIndex().then((idx) => {
      cacheIndex = idx;
      return idx;
    });
  }
  return cacheBuildPromise;
}

/**
 * 동기적 버전. 시드만으로 빠르게 (서버 초기 부팅 시 안전).
 * 런타임 캐시는 async 버전을 통해 lazy merge.
 */
export function getSeedMaster(): StockMaster[] {
  return SEED;
}

export function findBySymbol(symbol: string): StockMaster | undefined {
  // sync 버전은 시드만 (캐시 무시). 정확한 검색은 async searchStocks 사용.
  return SEED.find((s) => s.symbol === symbol);
}

// ─── 검색 함수 (fuzzy match) ──────────────────────────────────
/**
 * 비동기: 시드 + 런타임 캐시 통합 검색. UI에서 호출.
 * 4단계 매칭:
 *   1) symbol 정확
 *   2) symbol 부분 (티커 prefix)
 *   3) 이름 prefix
 *   4) 이름 contains
 */
export async function searchStocks(
  query: string,
  limit = 10,
  marketFilter?: Market,
): Promise<StockMaster[]> {
  const q = normalize(query);
  const index = await getMasterIndex();
  const candidates = marketFilter
    ? Array.from(index.values()).filter((s) => s.market === marketFilter)
    : Array.from(index.values());

  if (!q) return candidates.slice(0, limit);

  // 1) symbol 정확 매치
  const exactSymbol = candidates.filter((s) => s.symbol === q);
  if (exactSymbol.length > 0) return exactSymbol;

  // 2) symbol 부분 매치
  const symbolContains = candidates.filter((s) =>
    s.symbol.toLowerCase().includes(q),
  );
  if (symbolContains.length > 0) return symbolContains.slice(0, limit);

  // 3) 이름 prefix
  const prefixMatch = candidates.filter((s) => normalize(s.name).startsWith(q));
  if (prefixMatch.length > 0) return prefixMatch.slice(0, limit);

  // 4) 이름 contains
  const containsMatch = candidates.filter((s) => normalize(s.name).includes(q));
  return containsMatch.slice(0, limit);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFC");
}

// ─── 캐시 invalidate (테스트/개발용) ─────────────────────────
export function _invalidateCache() {
  cacheIndex = null;
  cacheBuildPromise = null;
}
