"use client";

/**
 * components/CandlePanel.tsx — 차트 + 메타 통합 (v1.4)
 *
 * CandleChart + fetchCandles + 5분 polling.
 * 부모(Home)로부터 선택 종목 받음.
 */

import { useEffect, useState, useCallback } from "react";
import {
  fetchCandles,
  calcCandleStats,
  CANDLE_INTERVALS,
  DEFAULT_CANDLE_COUNT,
  type CandleInterval,
  type Candle,
} from "@/lib/candles";
import { CandleChart } from "./CandleChart";
import { formatKRW } from "@/lib/format";

interface CandlePanelProps {
  symbol: string;
  symbolName?: string;
  interval?: CandleInterval;
  pollSec?: number;
}

const POLL_INTERVAL_MS_DEFAULT = 5 * 60 * 1000; // 5분

export function CandlePanel({
  symbol,
  symbolName,
  interval = "1d",
  pollSec = 300,
}: CandlePanelProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [servedAt, setServedAt] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setStatus((s) => (s === "idle" ? "loading" : s));
      try {
        const r = await fetchCandles({
          symbol,
          interval,
          count: DEFAULT_CANDLE_COUNT,
          signal,
        });
        if (r.availability === "available") {
          setCandles(r.candles);
          setError(null);
          setStatus("success");
        } else {
          setError(r.message ?? "캔들 조회 실패");
          setStatus("error");
        }
        setServedAt(new Date().toISOString());
        setLastUpdate(new Date());
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    },
    [symbol, interval]
  );

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    // setTimeout 0 마이크로태스크 분리 (react-hooks/set-state-in-effect 우회)
    const t = setTimeout(() => {
      void fetchData(controller.signal);
    }, 0);
    const intervalId = setInterval(() => {
      void fetchData(controller.signal);
    }, pollSec * 1000 || POLL_INTERVAL_MS_DEFAULT);
    return () => {
      controller.abort();
      clearTimeout(t);
      clearInterval(intervalId);
    };
  }, [fetchData, pollSec, symbol]);

  const stats = calcCandleStats(candles);

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          📈 캔들 차트 {symbolName && <span className="font-normal">— {symbolName}</span>}
        </h3>
        <div className="flex gap-1">
          {CANDLE_INTERVALS.map((i) => (
            <span
              key={i.value}
              className={`text-xs px-2 py-0.5 rounded ${
                i.value === interval
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-zinc-400"
              }`}
            >
              {i.label}
            </span>
          ))}
        </div>
      </div>

      {/* 통계 + 차트 */}
      {stats && (
        <div className="mb-2 flex gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span>최신: <span className="font-mono font-semibold">{formatKRW(stats.latest)}</span></span>
          <span>
            변동:{" "}
            <span
              className={
                stats.change > 0
                  ? "text-red-600"
                  : stats.change < 0
                    ? "text-blue-600"
                    : "text-zinc-500"
              }
            >
              {stats.change > 0 ? "+" : ""}
              {formatKRW(stats.change)} ({stats.changePct > 0 ? "+" : ""}
              {stats.changePct.toFixed(2)}%)
            </span>
          </span>
          <span>범위: {formatKRW(stats.min)} ~ {formatKRW(stats.max)}</span>
        </div>
      )}

      {/* 차트 */}
      <div className="overflow-x-auto">
        <CandleChart candles={candles} stats={stats} width={600} height={300} />
      </div>

      {/* 에러 */}
      {status === "error" && error && (
        <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300">
          ⚠ {error}
        </div>
      )}

      {/* 메타 */}
      <div className="mt-2 text-xs text-zinc-500 flex justify-between">
        <span>
          {lastUpdate && `마지막 갱신: ${lastUpdate.toLocaleTimeString("ko-KR")}`}
          {servedAt && ` (served: ${new Date(servedAt).toLocaleTimeString("ko-KR")})`}
        </span>
        <span>{candles.length}개 캔들 / {pollSec}초마다 자동 갱신</span>
      </div>
    </div>
  );
}
