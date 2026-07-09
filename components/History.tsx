"use client";

/**
 * components/History.tsx — 매수/매도 이력 표시 (7.5단계)
 *
 * /api/history에서 이력 조회 + 표시.
 * 3종 필터: kind (analysis/order/snapshot), symbol, limit.
 * availability 표시 (Vercel readonly 안내).
 *
 * v0.3 단순화: LLM 호출 0. toss-trader 코드 안 history GET만.
 */

import { useEffect, useState, useCallback } from "react";
import { formatKRW } from "@/lib/format";
import type { HistoryRecord } from "@/lib/types";

interface ApiHistoryEnvelope {
  availability: "available" | "readonly" | "disabled";
  count: number;
  records: Array<{ file: string; record: HistoryRecord }>;
  servedAt: string;
}

interface ApiError {
  code: string;
  message: string;
}

type FilterKind = "all" | HistoryRecord["kind"];

const POLL_INTERVAL_MS = 5_000; // 5초 (OrderButton 결과 빠르게 반영)

export function History({ symbolFilter }: { symbolFilter?: string }) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [availability, setAvailability] = useState<string>("unknown");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [limit, setLimit] = useState<number>(50);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [servedAt, setServedAt] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (filter !== "all") params.set("kind", filter);
      if (symbolFilter) params.set("symbol", symbolFilter);
      const res = await fetch(`/api/history?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as ApiHistoryEnvelope | ApiError;
      if ("code" in data) {
        setError(data);
        setStatus("error");
        return;
      }
      setAvailability(data.availability);
      setRecords(data.records.map((r) => r.record));
      setServedAt(data.servedAt);
      setError(null);
      setStatus("success");
      setLastUpdate(new Date());
    } catch (e) {
      setError({ code: "network-error", message: (e as Error).message });
      setStatus("error");
    }
  }, [filter, limit, symbolFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchData();
    }, 0);
    const interval = setInterval(() => {
      void fetchData();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [fetchData]);

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          📋 History (이력)
          {symbolFilter && <span className="ml-2 text-xs text-zinc-500">— {symbolFilter}</span>}
        </h3>
        <button
          type="button"
          onClick={() => void fetchData()}
          disabled={status === "loading"}
          className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          {status === "loading" ? "..." : "🔄 새로고침"}
        </button>
      </div>

      {/* availability 경고 */}
      {availability === "readonly" && (
        <div className="mb-3 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          ℹ️ Vercel readonly filesystem: 이력 저장 비활성화. dev/local 또는 외부 storage 필요.
        </div>
      )}
      {availability === "disabled" && (
        <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs">
          ❌ 이력 기능 사용 불가 (filesystem 오류)
        </div>
      )}

      {/* 필터 */}
      <div className="mb-3 flex gap-2 text-xs flex-wrap">
        <select
          aria-label="kind 필터"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKind)}
          className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
        >
          <option value="all">전체</option>
          <option value="order">주문</option>
          <option value="analysis">분석</option>
          <option value="snapshot">스냅샷</option>
        </select>
        <select
          aria-label="limit"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
        >
          <option value={20}>최근 20개</option>
          <option value={50}>최근 50개</option>
          <option value={100}>최근 100개</option>
        </select>
      </div>

      {/* 에러 */}
      {status === "error" && error && (
        <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm">
          <div className="font-semibold text-red-700 dark:text-red-300">❌ {error.code}</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">{error.message}</div>
        </div>
      )}

      {/* 빈 상태 */}
      {status === "success" && records.length === 0 && (
        <div className="p-4 text-center text-zinc-500 text-sm">이력이 없습니다.</div>
      )}

      {/* 이력 리스트 */}
      {records.length > 0 && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-950">
              <tr>
                <th className="text-left py-2">시각</th>
                <th className="text-left py-2">종류</th>
                <th className="text-left py-2">종목</th>
                <th className="text-right py-2">상세</th>
                <th className="text-right py-2">결과</th>
              </tr>
            </thead>
            <tbody>
              {records
                .slice()
                .reverse()
                .map((r, i) => {
                  const time = new Date(r.epochSeconds * 1000).toLocaleString("ko-KR");
                  if (r.kind === "order") {
                    const ok = r.response.ok;
                    return (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-2 text-xs text-zinc-500">{time}</td>
                        <td className="py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {r.request.side}
                          </span>
                        </td>
                        <td className="py-2 font-mono text-xs">{r.request.symbol}</td>
                        <td className="py-2 text-right font-mono text-xs">
                          {r.request.quantity.toLocaleString()}주 × {formatKRW(r.request.price)}
                        </td>
                        <td className={`py-2 text-right text-xs ${ok ? "text-emerald-600" : "text-red-600"}`}>
                          {ok ? `✅ ${r.response.httpStatus}` : `❌ ${r.response.httpStatus}`}
                        </td>
                      </tr>
                    );
                  }
                  if (r.kind === "analysis") {
                    return (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-2 text-xs text-zinc-500">{time}</td>
                        <td className="py-2">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">분석</span>
                        </td>
                        <td className="py-2 font-mono text-xs">{r.symbol}</td>
                        <td className="py-2 text-right text-xs">
                          {r.recommendation.decision.action} ({(r.recommendation.decision.confidence * 100).toFixed(0)}%)
                        </td>
                        <td className="py-2 text-right text-xs text-zinc-500">—</td>
                      </tr>
                    );
                  }
                  // snapshot
                  return (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-2 text-xs text-zinc-500">{time}</td>
                      <td className="py-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">스냅샷</span>
                      </td>
                      <td className="py-2 text-xs text-zinc-500">—</td>
                      <td className="py-2 text-right font-mono text-xs">
                        {formatKRW(r.totalEval)} ({r.holdings.length}개)
                      </td>
                      <td className="py-2 text-right text-xs text-zinc-500">—</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* 메타 */}
      <div className="mt-3 text-xs text-zinc-500 flex justify-between">
        <span>
          {lastUpdate && `마지막 갱신: ${lastUpdate.toLocaleTimeString("ko-KR")}`}
          {servedAt && ` (served: ${new Date(servedAt).toLocaleTimeString("ko-KR")})`}
        </span>
        <span>{records.length}개 / 5초마다 자동 갱신</span>
      </div>
    </div>
  );
}
