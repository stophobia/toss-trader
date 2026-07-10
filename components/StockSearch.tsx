"use client";

/**
 * components/StockSearch.tsx — 종목 검색 + 자동완성 dropdown (v2 — 서버 검색)
 *
 * v1: 클라이언트 사이드 fuzzy 검색 (lib/stocks.ts 직접 import)
 * v2: GET /api/stocks/search?q=... — 시드(~3000) + 런타임 캐시 통합
 *     → 더 풍부한 데이터 + 자동 인덱싱 (사용자가 분석한 종목이 캐시에 추가됨)
 *
 * UX 동일: 200ms debounce, 키보드 네비, outside click, market filter.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Market, StockMaster } from "@/lib/stocks";

interface StockSearchProps {
  onSelect: (symbol: string, name: string, market: Market) => void;
  defaultSymbol?: string;
  defaultName?: string;
  marketFilter?: Market;
  /**
   * Optional: when provided, a "🔄 새로고침" button appears next to the
   * search input. Calls POST /api/stocks/refresh. Caller can use the
   * returned `added` count to decide whether to show a toast.
   */
  onRefresh?: () => Promise<{ added: number; total: number } | void> | void;
}

export function StockSearch({
  onSelect,
  defaultSymbol = "005930",
  defaultName = "삼성전자",
  marketFilter,
  onRefresh,
}: StockSearchProps) {
  const [query, setQuery] = useState<string>(defaultName);
  const [results, setResults] = useState<StockMaster[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [highlight, setHighlight] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Server-side search with 200ms debounce
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: "10" });
        if (marketFilter) params.set("market", marketFilter);
        const res = await fetch(`/api/stocks/search?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const body = (await res.json()) as { results: StockMaster[] };
        if (!cancelled) {
          setResults(body.results || []);
          setHighlight(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, marketFilter]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    (s: StockMaster) => {
      setQuery(s.name);
      setOpen(false);
      onSelect(s.symbol, s.name, s.market);
    },
    [onSelect],
  );

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await onRefresh();
      const added = res?.added ?? 0;
      const total = res?.total ?? 0;
      setRefreshMsg(
        added > 0
          ? `✓ ${added}개 종목 정보 갱신 (캐시 ${total}개)`
          : `✓ 캐시 ${total}개 — 새로 추가된 종목 없음`,
      );
      // Force search results to refresh by re-fetching once
      // (the cache has changed; server-side searchStocks reads from it).
      setQuery((q) => q + " ");
      // remove the trailing space on next tick to retrigger useEffect
      setTimeout(() => setQuery((q) => q.replace(/ $/, "")), 0);
    } catch (error) {
      setRefreshMsg(
        `✗ ${error instanceof Error ? error.message : "새로고침 실패"}`,
      );
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(null), 4000);
    }
  }, [onRefresh, refreshing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlight]) handleSelect(results[highlight]);
      else setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (!open) {
      setOpen(true);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="stock-search-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="종목명 또는 symbol 입력 (예: 삼성전자, NVDA, 005930)"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="인기 종목 ~200개의 메타(영문명/통화 등)를 토스 API에서 받아와 캐시를 갱신합니다."
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            마스터 새로고침
          </button>
        ) : null}
      </div>

      {refreshMsg ? (
        <p
          role="status"
          className="mt-1 text-xs text-muted-foreground"
        >
          {refreshMsg}
        </p>
      ) : null}

      {open && loading && results.length === 0 ? (
        <div
          role="status"
          className="absolute z-20 mt-1 w-full rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg"
        >
          검색 중…
        </div>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-card shadow-lg text-sm"
        >
          {results.map((s, i) => (
            <li
              key={s.symbol}
              role="option"
              aria-selected={i === highlight}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer border-b px-3 py-2 last:border-b-0 ${
                i === highlight
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{s.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {s.symbol}{" "}
                  <span className="ml-1 rounded border px-1 text-[10px]">
                    {s.market}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !loading && query.length > 0 && results.length === 0 ? (
        <div
          role="status"
          className="absolute z-20 mt-1 w-full rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg"
        >
          &quot;{query}&quot;에 해당하는 종목이 마스터에 없습니다. 직접 symbol을
          입력해 시작할 수 있습니다 (시드 갱신은 <code>lib/stocks-seed.json</code>).
        </div>
      ) : null}

      <span className="sr-only">
        종목 검색. 화살표 키로 결과 탐색, Enter로 선택, Escape로 닫기.
        {defaultSymbol ? ` 기본값: ${defaultName} (${defaultSymbol})` : ""}
      </span>
    </div>
  );
}
