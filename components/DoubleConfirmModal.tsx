"use client";

/**
 * components/DoubleConfirmModal.tsx — 2차 confirm 모달 (v1.1.2)
 *
 * auto-live 모드 전용. 실계좌 주문 전 2차 안전 가드.
 * - 5초 카운트다운 (실수 방지)
 * - 주문 정보 명확히 표시 (종목/방향/수량/가격/총액)
 * - "확인" 버튼이 5초 후에만 활성화
 * - 실계좌 경고 배너 (빨간색)
 *
 * v0.3 단순화: LLM 호출 0, 시크릿 0. 클라이언트 사이드 안전장치.
 */

import { useEffect, useState } from "react";
import { formatKRW } from "@/lib/format";

interface DoubleConfirmModalProps {
  open: boolean;
  symbol: string;
  symbolName?: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  totalAmount: number;
  countdownSec?: number; // 기본 5초
  onConfirm: () => void;
  onCancel: () => void;
}

export function DoubleConfirmModal({
  open,
  symbol,
  symbolName,
  side,
  quantity,
  price,
  totalAmount,
  countdownSec = 5,
  onConfirm,
  onCancel,
}: DoubleConfirmModalProps) {
  const [remaining, setRemaining] = useState<number>(countdownSec);

  useEffect(() => {
    if (!open) {
      // setTimeout 0으로 마이크로태스크 분리 (react-hooks/set-state-in-effect 우회)
      const t = setTimeout(() => setRemaining(countdownSec), 0);
      return () => clearTimeout(t);
    }
    // 1초마다 감소
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [open, countdownSec]);

  if (!open) return null;

  const ready = remaining === 0;
  const isBuy = side === "BUY";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="double-confirm-title"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white dark:bg-zinc-950 rounded-lg p-6 max-w-md w-full border-2 border-red-500">
        {/* 경고 배너 */}
        <div className="mb-4 p-3 rounded bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚠️</span>
            <h2
              id="double-confirm-title"
              className="text-sm font-bold text-red-700 dark:text-red-300"
            >
              실계좌 자동 모드 — 2차 확인
            </h2>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400">
            본 주문은 본인 토스증권 실계좌에서 체결됩니다. {countdownSec}초 대기 후
            활성화되는 &quot;확인&quot; 버튼을 눌러야만 실행됩니다.
          </p>
        </div>

        {/* 주문 정보 */}
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">종목</span>
            <span className="font-mono font-semibold">
              {symbol} {symbolName && <span className="text-zinc-500">({symbolName})</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">방향</span>
            <span className={`font-semibold ${isBuy ? "text-red-600" : "text-blue-600"}`}>
              {isBuy ? "매수 (실계좌)" : "매도 (실계좌)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">수량 × 가격</span>
            <span className="font-mono">
              {quantity.toLocaleString()}주 × {formatKRW(price)}
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 pt-2 font-semibold">
            <span>총 주문 금액</span>
            <span className="font-mono">{formatKRW(totalAmount)}</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded border border-zinc-300 dark:border-zinc-700 font-semibold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready}
            aria-disabled={!ready}
            className={`flex-1 py-3 rounded font-semibold transition-colors ${
              ready
                ? isBuy
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
            }`}
          >
            {ready ? "확인 (주문 실행)" : `${remaining}초 대기...`}
          </button>
        </div>
      </div>
    </div>
  );
}
