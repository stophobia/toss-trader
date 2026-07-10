/**
 * lib/format.ts — toss-trader 표시용 포맷 헬퍼 (5단계)
 *
 * 순수 함수 모음. TDD 친화적. 클라이언트/서버 양쪽 호환.
 */

import type { ReactNode } from "react";

// ─── KRW 금액 포맷 ───────────────────────────────────────────────
export function formatKRW(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "-";
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

// ─── 수량 포맷 (천 단위 콤마) ─────────────────────────────────
export function formatQuantity(qty: number | null | undefined): string {
  if (qty === null || qty === undefined || !Number.isFinite(qty)) return "-";
  return `${Math.round(qty).toLocaleString("ko-KR")}주`;
}

// ─── 손익 계산 + 포맷 ─────────────────────────────────────────
export function calcPnL(
  currentPrice: number,
  avgPrice: number,
  quantity: number
): { amount: number; rate: number } {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(avgPrice) || !Number.isFinite(quantity)) {
    return { amount: 0, rate: 0 };
  }
  const amount = (currentPrice - avgPrice) * quantity;
  const rate = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  return { amount, rate };
}

export function formatPnL(amount: number): string {
  if (!Number.isFinite(amount)) return "-";
  const sign = amount > 0 ? "+" : amount < 0 ? "" : "";
  return `${sign}${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export function formatPnLPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "-";
  const sign = rate > 0 ? "+" : rate < 0 ? "" : "";
  return `${sign}${rate.toFixed(2)}%`;
}

// ─── 손익 색상 (Tailwind class) ────────────────────────────────
export type PnLColorClass = "text-emerald-600" | "text-red-600" | "text-zinc-500";

export function pnlColorClass(amount: number): PnLColorClass {
  if (amount > 0) return "text-emerald-600";
  if (amount < 0) return "text-red-600";
  return "text-zinc-500";
}

// ─── 평가금액 (현재가 × 수량) ─────────────────────────────────
export function calcEvalAmount(currentPrice: number, quantity: number): number {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(quantity)) return 0;
  return currentPrice * quantity;
}

// ─── v1.1.5: 매도 시 보유 종목 helper ─────────────────────
/**
 * Portfolio에서 받은 holdings 배열에서 symbol 매칭.
 * OrderButton 매도 시 quantity/avgPrice 자동 채움용.
 */
export interface HoldingItem {
  symbol: string;
  symbolName?: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number; // Portfolio에서 자동 fetch한 현재가
}

export function findHoldingBySymbol(
  holdings: ReadonlyArray<HoldingItem>,
  symbol: string
): HoldingItem | undefined {
  if (!symbol) return undefined;
  return holdings.find((h) => h.symbol === symbol);
}

/**
 * 매도 가능 수량 (보유 수량 그대로, 미래 확장 시 빔/수량 제한 가능)
 */
export function getSellableQuantity(holding: HoldingItem | undefined): number {
  if (!holding) return 0;
  return Math.max(0, Math.floor(holding.quantity));
}

// ─── 시세 변화 포맷 ───────────────────────────────────────────
export function formatChange(currentPrice: number, prevClose: number): {
  amount: number;
  rate: number;
  formatted: string;
  sign: "up" | "down" | "flat";
} {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(prevClose) || prevClose === 0) {
    return { amount: 0, rate: 0, formatted: "-", sign: "flat" };
  }
  const amount = currentPrice - prevClose;
  const rate = (amount / prevClose) * 100;
  const sign: "up" | "down" | "flat" = amount > 0 ? "up" : amount < 0 ? "down" : "flat";
  const signChar = sign === "up" ? "+" : sign === "down" ? "" : "";
  const formatted = `${signChar}${Math.round(amount).toLocaleString("ko-KR")}원 (${signChar}${rate.toFixed(2)}%)`;
  return { amount, rate, formatted, sign };
}

// ─── 통화 (KRW 표시) ───────────────────────────────────────────
export function formatKrwShort(amount: number): string {
  if (!Number.isFinite(amount)) return "-";
  const abs = Math.abs(amount);
  if (abs >= 1_0000_0000_0000) return `${(amount / 1_0000_0000_0000).toFixed(1)}조`;
  if (abs >= 1_0000_0000) return `${(amount / 1_0000_0000).toFixed(1)}억`;
  if (abs >= 1_0000) return `${(amount / 1_0000).toFixed(0)}만`;
  return Math.round(amount).toLocaleString("ko-KR");
}

// ─── ReactNode re-export (호환성) ──────────────────────────────
export type { ReactNode };
