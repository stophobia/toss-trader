"use client";

/**
 * components/OrderButton.tsx — 매수/매도 UI (v1.1.2)
 *
 * 플로우:
 * 1. 사용자가 BUY/SELL 클릭
 * 2. confirm 모달 띄움 (가격/수량/총액)
 * 3. "발송" 클릭 → POST /api/telegram/send
 *    - telegram: 메시지 발송 → 사용자 [확인]
 *    - auto-paper: 즉시 confirmed
 *    - auto-live: 2차 confirm 모달 (5초 카운트다운) → doubleConfirmed=true 재요청
 *    - off: 423 차단
 * 4. (real 봇) Telegram [확인] 클릭 → executeOrder
 * 5. (dev fallback) 3초 후 자동 confirm → executeOrder
 * 6. (auto-paper/auto-live) 즉시 executeOrder
 * 7. → /api/toss/api/v1/orders + history 기록
 *
 * v0.3 단순화: LLM 호출 0. Telegram confirm만.
 */

import { useState } from "react";
import type { OrderHistoryRecord } from "@/lib/types";
import { StockSearch } from "@/components/StockSearch";
import { DoubleConfirmModal } from "@/components/DoubleConfirmModal";
import type { TelegramConfirmMode } from "@/lib/settings";

type Side = "BUY" | "SELL";

interface OrderButtonProps {
  symbol: string;
  symbolName?: string;
  currentPrice: number;
  onSymbolChange?: (symbol: string, name: string, price: number) => void;
  confirmMode: TelegramConfirmMode;
}

export interface PendingOrder {
  orderId: string;
  devFallback: boolean;
  expiresAt: string;
  message: string;
  mode?: TelegramConfirmMode;
}

interface OrderResult {
  ok: boolean;
  data?: unknown;
  code?: string;
  message?: string;
}

export function OrderButton({
  symbol: initialSymbol,
  symbolName: initialName,
  currentPrice: initialPrice,
  onSymbolChange,
  confirmMode,
}: OrderButtonProps) {
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [symbolName, setSymbolName] = useState<string>(initialName ?? "");
  const [side, setSide] = useState<Side>("BUY");
  const [price, setPrice] = useState<number>(initialPrice);
  const [quantity, setQuantity] = useState<number>(10);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showDoubleConfirm, setShowDoubleConfirm] = useState<boolean>(false);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [polling, setPolling] = useState<boolean>(false);
  const [autoLiveOrderId, setAutoLiveOrderId] = useState<string | null>(null);

  // 종목 선택 시 currentPrice 업데이트 + 부모(Home)에 알림
  const handleStockSelect = (newSymbol: string, newName: string, newPrice: number): void => {
    setSymbol(newSymbol);
    setSymbolName(newName);
    if (newPrice > 0) setPrice(newPrice);
    onSymbolChange?.(newSymbol, newName, newPrice);
  };

  const totalAmount = price * quantity;

  // ── 1. 발송 (Telegram confirm 요청) ──
  const handleSend = async (): Promise<void> => {
    setSending(true);
    setResult(null);
    try {
      // v1.1.2: auto-live는 doubleConfirmed=false (1차) → 2차 모달 띄움
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          quantity,
          price,
          confirmMode,
          doubleConfirmed: confirmMode !== "auto-live",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPending(data as PendingOrder);
        setShowModal(false);
        // v1.1.2: auto-paper/auto-live(doubleConfirmed=true)는 confirm 폴링 불필요
        if (data.mode === "auto-paper" || data.mode === "auto-live" || data.devFallback) {
          startPolling(data.orderId);
        }
      } else if (data.mode === "auto-live") {
        // v1.1.2: auto-live 1차 호출 → ok:false (2차 confirm 필요)
        setShowModal(false);
        setAutoLiveOrderId(data.orderId);
        setShowDoubleConfirm(true);
      } else {
        setResult({ ok: false, code: data.code, message: data.message });
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  // ── 2. Polling (실제 봇 confirm 대기) ──
  const startPolling = async (orderId: string): Promise<void> => {
    setPolling(true);
    // eslint-disable-next-line react-hooks/purity -- 이벤트 핸들러 안, render 아님
    const startTime = Date.now();
    const pollInterval = 1000; // 1초
    const poll = async (): Promise<void> => {
      try {
        // dev fallback: orderId가 confirmed로 자동 갱신됨. 3초 후 자동 confirm 시도
        if (Date.now() - startTime > 3000) {
          await executeOrder(orderId);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        await poll();
      } catch (e) {
        setResult({ ok: false, message: (e as Error).message });
        setPolling(false);
      }
    };
    void poll();
  };

  // ── 2-2. v1.1.2 auto-live 2차 confirm → 재요청 ──
  const handleDoubleConfirm = async (): Promise<void> => {
    if (!autoLiveOrderId) return;
    setSending(true);
    setResult(null);
    try {
      // 2차 호출: doubleConfirmed=true → 즉시 confirmed
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          quantity,
          price,
          confirmMode: "auto-live",
          doubleConfirmed: true,
        }),
      });
      const data = await res.json();
      setShowDoubleConfirm(false);
      if (data.ok) {
        setPending(data as PendingOrder);
        // auto-live는 confirmed → 바로 주문 실행
        void startPolling(data.orderId);
      } else {
        setResult({ ok: false, code: data.code, message: data.message });
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  // ── 3. 주문 실행 (toss relay) + history write ──
  const executeOrder = async (orderId: string): Promise<void> => {
    const epochSeconds = Math.floor(Date.now() / 1000);
    try {
      const res = await fetch("/api/toss/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          quantity,
          price,
          orderType: "LIMIT",
          telegramConfirmed: true, // 가드 5 통과
          clientOrderId: orderId, // 멱등성
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, data });
        setPending(null);
        setShowDoubleConfirm(false);

        // 6단계: history 기록 (kstost 방식 — 로컬 JSON, Vercel에서 readonly 시 silent fail)
        try {
          const record: OrderHistoryRecord = {
            kind: "order",
            epochSeconds,
            createdAt: new Date(epochSeconds * 1000).toISOString(),
            orderId,
            request: { symbol, side, quantity, price, orderType: "LIMIT", telegramConfirmed: true },
            response: { ok: true, httpStatus: res.status, body: data },
          };
          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ record }),
          }).catch(() => undefined);
        } catch {
          // ignore
        }
      } else {
        setResult({ ok: false, code: data.code, message: data.message, data });

        // 실패도 기록
        try {
          const record: OrderHistoryRecord = {
            kind: "order",
            epochSeconds,
            createdAt: new Date(epochSeconds * 1000).toISOString(),
            orderId,
            request: { symbol, side, quantity, price, orderType: "LIMIT", telegramConfirmed: true },
            response: { ok: false, httpStatus: res.status, body: data },
          };
          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ record }),
          }).catch(() => undefined);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-white dark:bg-zinc-950">
      {/* 종목 선택 */}
      <div className="mb-3">
        <StockSearch
          onSelect={handleStockSelect}
          defaultSymbol={symbol}
          defaultName={symbolName}
        />
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setSide("BUY")}
          className={`flex-1 py-2 rounded font-semibold transition-colors ${
            side === "BUY"
              ? "bg-red-500 text-white"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          매수
        </button>
        <button
          type="button"
          onClick={() => setSide("SELL")}
          className={`flex-1 py-2 rounded font-semibold transition-colors ${
            side === "SELL"
              ? "bg-blue-500 text-white"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          매도
        </button>
      </div>

      <div className="text-sm space-y-2 mb-3">
        <div className="flex justify-between">
          <span className="text-zinc-500">현재가 (자동)</span>
          <span className="font-mono font-semibold text-lg">{price.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <label htmlFor="price" className="text-zinc-500">주문가 (수정 가능)</label>
          <input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-32 text-right border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-transparent"
          />
        </div>
        <div className="flex justify-between">
          <label htmlFor="quantity" className="text-zinc-500">수량</label>
          <input
            id="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min={1}
            className="w-32 text-right border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 bg-transparent"
          />
        </div>
        <div className="flex justify-between font-semibold border-t border-zinc-200 dark:border-zinc-800 pt-2">
          <span>총액</span>
          <span className="font-mono">{totalAmount.toLocaleString()}원</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={price <= 0 || quantity <= 0}
        className="w-full py-3 rounded bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {side === "BUY" ? "매수" : "매도"} 진행
      </button>

      {/* pending 상태 표시 */}
      {pending && (
        <div className="mt-3 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm">
          <div className="font-semibold mb-1">
            {polling ? "⏳ Telegram confirm 대기 중..." : "📨 Telegram confirm 요청 발송됨"}
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            orderId: <span className="font-mono">{pending.orderId}</span>
            <br />
            만료: {new Date(pending.expiresAt).toLocaleString()}
            {pending.devFallback && <span className="ml-2 text-amber-600">(dev fallback)</span>}
          </div>
          {pending.devFallback && (
            <button
              type="button"
              onClick={() => executeOrder(pending.orderId)}
              className="mt-2 w-full py-2 rounded bg-amber-500 text-white text-sm font-semibold"
            >
              자동 confirm (dev) → 주문 실행
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setPolling(false);
            }}
            className="mt-1 w-full py-1 text-xs text-zinc-500 underline"
          >
            취소
          </button>
        </div>
      )}

      {/* 결과 표시 */}
      {result && (
        <div
          className={`mt-3 p-3 rounded text-sm ${
            result.ok
              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          }`}
        >
          <div className="font-semibold mb-1">
            {result.ok ? "✅ 주문 성공" : `❌ ${result.code ?? "실패"}`}
          </div>
          {result.message && <div className="text-xs">{result.message}</div>}
          {result.data !== undefined && result.data !== null && (
            <pre className="text-xs mt-2 overflow-auto bg-zinc-100 dark:bg-zinc-900 p-2 rounded">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* confirm 모달 (1차) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">주문 confirm</h2>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span>종목</span>
                <span className="font-mono">{symbol}</span>
              </div>
              <div className="flex justify-between">
                <span>방향</span>
                <span className="font-semibold">{side === "BUY" ? "매수" : "매도"}</span>
              </div>
              <div className="flex justify-between">
                <span>수량 × 가격</span>
                <span className="font-mono">
                  {quantity.toLocaleString()}주 × {price.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t border-zinc-200 dark:border-zinc-800 pt-2">
                <span>총 주문 금액</span>
                <span className="font-mono">{totalAmount.toLocaleString()}원</span>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs text-amber-900 dark:text-amber-200 mb-4">
              ⚠️ &quot;발송&quot; 클릭 시 Telegram 메시지로 confirm 요청이 전송됩니다. 실계좌는 Telegram의 [확인] 버튼을 눌러야만 주문이 실행됩니다.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={sending}
                className="flex-1 py-2 rounded border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending}
                className="flex-1 py-2 rounded bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-semibold disabled:opacity-50"
              >
                {sending ? "발송 중..." : "발송"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v1.1.2: 실계좌 2차 confirm 모달 (auto-live 모드) */}
      <DoubleConfirmModal
        open={showDoubleConfirm}
        symbol={symbol}
        symbolName={symbolName}
        side={side}
        quantity={quantity}
        price={price}
        totalAmount={totalAmount}
        onConfirm={() => void handleDoubleConfirm()}
        onCancel={() => {
          setShowDoubleConfirm(false);
          setAutoLiveOrderId(null);
        }}
      />
    </div>
  );
}
