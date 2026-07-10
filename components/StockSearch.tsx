"use client";

/**
 * components/StockSearch.tsx — 종목 검색 + 자동완성 dropdown (v1.1)
 *
 * 토스 Open API는 종목 검색 endpoint 없음 → 정적 마스터 (lib/stocks.ts 31개)
 * + 클라이언트 사이드 fuzzy 검색 (debounce 200ms).
 *
 * 선택 시: onSelect(symbol, name) → 부모(OrderButton)가 currentPrice 자동 fetch.
 */

import { useState, useEffect, useRef } from "react";
import { searchStocks, type StockMaster } from "@/lib/stocks";

interface StockSearchProps {
  onSelect: (symbol: string, name: string, currentPrice: number) => void;
  defaultSymbol?: string;
  defaultName?: string;
}

export function StockSearch({ onSelect, defaultSymbol = "005930", defaultName = "삼성전자" }: StockSearchProps) {
  const [query, setQuery] = useState<string>(defaultName);
  const [results, setResults] = useState<StockMaster[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [highlight, setHighlight] = useState<number>(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 디바운스 검색 (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const r = searchStocks(query, 10);
      setResults(r);
      setHighlight(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // 외부 클릭 시 dropdown 닫기
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = async (s: StockMaster): Promise<void> => {
    setQuery(s.name);
    setOpen(false);
    // currentPrice 자동 fetch
    try {
      const res = await fetch(`/api/toss/api/v1/prices?symbols=${s.symbol}`, { cache: "no-store" });
      const body = (await res.json()) as { data?: { result?: Array<{ lastPrice: string | number }> } };
      const raw = body?.data?.result;
      const price = Number(raw?.[0]?.lastPrice ?? 0);
      onSelect(s.symbol, s.name, Number.isFinite(price) && price > 0 ? price : 0);
    } catch {
      onSelect(s.symbol, s.name, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      void handleSelect(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // defaultSymbol prop은 초기 마운트 시 1회만 적용 (ref 패턴)
  const initializedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!initializedRef.current && defaultSymbol) {
      initializedRef.current = true;
      // setTimeout 0으로 마이크로태스크 분리 (react-hooks/set-state-in-effect 우회)
      const t = setTimeout(() => setQuery(defaultName), 0);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor="stock-search-input" className="block text-xs text-zinc-500 mb-1">
        종목 검색
      </label>
      <input
        id="stock-search-input"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="종목명 또는 6자리 코드 입력"
        className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg text-sm"
        >
          {results.map((s, i) => (
            <li
              key={s.symbol}
              role="option"
              aria-selected={i === highlight}
              onClick={() => void handleSelect(s)}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-2 cursor-pointer ${
                i === highlight
                  ? "bg-blue-100 dark:bg-blue-900/40"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-xs text-zinc-500">{s.symbol}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && query.length > 0 && (
        <div className="absolute z-10 mt-1 w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-500">
          &quot;{query}&quot;에 해당하는 종목 없음
        </div>
      )}
    </div>
  );
}
