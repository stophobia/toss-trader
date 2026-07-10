/**
 * lib/stocks-cache.ts — 동적 종목 메타 캐시
 *
 * 흐름:
 *   1. 초기에는 lib/stocks-seed.json (~3,000개) 만으로 검색
 *   2. 사용자가 분석 시작할 때마다 토스 API의 /api/v1/stocks 결과를 받아서
 *      캐시에 자동 추가 (symbol, name, englishName, market, currency 등)
 *   3. 시간이 지나며 사용자가 자주 안 본 종목도 자동 인덱싱됨
 *
 * 저장:
 *   - 메모리: Map<symbol, StockEntry> (빠른 lookup)
 *   - 디스크: ./stocks-cache.json (서버 재시작 후에도 유지)
 *
 * 만료:
 *   - 30일. 자동 갱신은 analyze 시점의 stockInfo fetch로.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { Market } from "@/lib/stocks";

export type StockEntry = {
  symbol: string;
  name: string;
  /** 영문명 (Toss API 응답에서 옴) — 영문 검색 강화용 */
  englishName?: string;
  market: Market;
  /** Toss API가 알려주는 부가 정보 */
  currency?: string;
  /** 캐시된 시각 (epoch ms) */
  cachedAt: number;
};

const CACHE_FILE = path.join(process.cwd(), "stocks-cache.json");
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

// In-memory cache, lazily loaded.
let memCache: Map<string, StockEntry> | null = null;
let loadPromise: Promise<Map<string, StockEntry>> | null = null;

async function loadFromDisk(): Promise<Map<string, StockEntry>> {
  try {
    const text = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(text) as StockEntry[];
    const m = new Map<string, StockEntry>();
    const now = Date.now();
    for (const e of parsed) {
      // 만료된 항목은 무시
      if (now - e.cachedAt < TTL_MS) m.set(e.symbol, e);
    }
    return m;
  } catch {
    // 파일 없음 또는 손상 → 빈 캐시
    return new Map();
  }
}

async function getCache(): Promise<Map<string, StockEntry>> {
  if (memCache) return memCache;
  if (!loadPromise) {
    loadPromise = loadFromDisk().then((m) => {
      memCache = m;
      return m;
    });
  }
  return loadPromise;
}

async function saveToDisk() {
  if (!memCache) return;
  const arr = Array.from(memCache.values());
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(arr, null, 0), "utf8");
  } catch (error) {
    // 디스크 저장 실패는 메모리 캐시로만 동작 (다음 분석은 메모리 사용)
    console.warn(
      "[stocks-cache] failed to persist:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Add or update a single entry (called from lib/market-context after /stocks fetch).
 * If `entry` lacks name, we look up the seed for the symbol to fill it in.
 */
export async function upsertStockEntry(input: {
  symbol: string;
  name?: string;
  englishName?: string;
  market: Market;
  currency?: string;
}): Promise<void> {
  const cache = await getCache();
  const existing = cache.get(input.symbol);
  // If caller didn't provide a name (e.g. only market was inferred), keep the
  // existing one — never blank out a name we already have.
  const name = input.name || existing?.name || input.symbol;
  const entry: StockEntry = {
    symbol: input.symbol,
    name,
    englishName: input.englishName || existing?.englishName,
    market: input.market,
    currency: input.currency || existing?.currency,
    cachedAt: Date.now(),
  };
  cache.set(input.symbol, entry);
  await saveToDisk();
}

/**
 * Bulk upsert. Used when a user starts an analysis: we already called
 * /api/v1/stocks?symbols=... and want to cache all returned entries in one go.
 */
export async function upsertStockEntries(
  entries: Array<{
    symbol: string;
    name?: string;
    englishName?: string;
    market: Market;
    currency?: string;
  }>,
): Promise<void> {
  const cache = await getCache();
  for (const input of entries) {
    const existing = cache.get(input.symbol);
    const name = input.name || existing?.name || input.symbol;
    cache.set(input.symbol, {
      symbol: input.symbol,
      name,
      englishName: input.englishName || existing?.englishName,
      market: input.market,
      currency: input.currency || existing?.currency,
      cachedAt: Date.now(),
    });
  }
  await saveToDisk();
}

export async function getCachedEntry(symbol: string): Promise<StockEntry | undefined> {
  const cache = await getCache();
  return cache.get(symbol);
}

export async function getAllCachedEntries(): Promise<StockEntry[]> {
  const cache = await getCache();
  return Array.from(cache.values());
}

/**
 * Reset (for tests). Not exposed via UI.
 */
export function _resetCache() {
  memCache = null;
  loadPromise = null;
}
