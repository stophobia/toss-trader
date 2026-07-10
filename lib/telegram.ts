/**
 * lib/telegram.ts — 토스 주문 Telegram confirm 게이트 (4단계)
 *
 * 책임:
 * 1. sendOrderConfirm() — Toss 주문 요청 시 inline button 메시지 발송
 *    콜백 ID(order_xxx) 생성 + in-memory 저장 (TTL 5분)
 * 2. handleCallback() — Telegram webhook 콜백 수신 + ID 매칭 + 만료 체크
 * 3. cancelOrder() — 사용자 cancel 시 in-memory에서 제거
 *
 * v0.3 단순화: 콜백 매칭은 in-memory (Vercel serverless cold start 대응).
 * 같은 cold start 안에서만 매칭. 5분 TTL로 짧은 confirm window.
 *
 * 안전 가드 (3단계)와의 연동:
 * - 가드 5 (TELEGRAM_CONFIRM): live 모드 주문 = body.telegramConfirmed=true 필수
 * - flow: send → 봇 메시지 → user click → handleCallback → orderId 반환 →
 *   클라이언트가 같은 orderId로 body.telegramConfirmed=true 재요청
 *
 * dev fallback: TOSS_TELEGRAM_BOT_TOKEN 미설정 시 자동 confirm (즉시 orderId 반환)
 * → 토큰 없이도 UI/플로우 검증 가능.
 */

import { randomUUID } from "node:crypto";

// ─── 환경변수 ──────────────────────────────────────────────────────
function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

function getChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID ?? process.env.TOSS_TELEGRAM_CHAT_ID ?? null;
}

function getConfirmTtlSec(): number {
  const v = Number(process.env.TELEGRAM_CONFIRM_TTL_SEC ?? 300); // 기본 5분
  return Number.isFinite(v) && v >= 0 ? v : 300; // TTL=0도 허용 (테스트/즉시만료)
}

function isDevFallback(): boolean {
  return !getBotToken() || !getChatId();
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

// ─── 콜백 매칭 in-memory store ───────────────────────────────────
interface PendingOrder {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  totalAmount: number;
  accountSeq?: number;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
  status: "pending" | "confirmed" | "canceled" | "expired";
}

const pendingStore = new Map<string, PendingOrder>();

function generateOrderId(): string {
  // order_ + nanoid 12 (충돌 확률 극히 낮음)
  const random = randomUUID().replace(/-/g, "").slice(0, 12);
  return `order_${random}`;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [, p] of pendingStore.entries()) {
    if (p.expiresAt <= now && p.status === "pending") {
      p.status = "expired";
    }
  }
}

// ─── 발송 페이로드 타입 ─────────────────────────────────────────
export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  accountSeq?: number;
  doubleConfirmed?: boolean; // v1.1.2: auto-live 모드에서 2차 confirm 게이트
}

export interface SendResult {
  ok: boolean;
  orderId: string;
  devFallback: boolean;
  expiresAt: string;
  message: string;
  mode: "telegram" | "auto-paper" | "auto-live" | "off"; // v1.1.2
}

// ─── sendOrderConfirm ────────────────────────────────────────────
export async function sendOrderConfirm(
  req: OrderRequest,
  mode: "telegram" | "auto-paper" | "auto-live" | "off" = "telegram"
): Promise<SendResult> {
  const orderId = generateOrderId();
  const now = Date.now();
  const ttlSec = getConfirmTtlSec();
  const expiresAt = now + ttlSec * 1000;

  const pending: PendingOrder = {
    orderId,
    symbol: req.symbol,
    side: req.side,
    quantity: req.quantity,
    price: req.price,
    totalAmount: req.price * req.quantity,
    accountSeq: req.accountSeq,
    createdAt: now,
    expiresAt,
    status: "pending",
  };
  pendingStore.set(orderId, pending);
  cleanupExpired();

  // ── 모드별 분기 (v1.1.2) ──
  if (mode === "off") {
    // 비활성화 모드: confirm 자체 안 함 → store에서 제거
    pendingStore.delete(orderId);
    return {
      ok: false,
      orderId,
      devFallback: false,
      expiresAt: new Date(expiresAt).toISOString(),
      message: "TELEGRAM_CONFIRM_MODE=off 모드. confirm 비활성화. paper 거래만 가능.",
      mode: "off",
    };
  }

  if (mode === "auto-paper") {
    // paper 자동 confirm: 즉시 status=confirmed
    pending.status = "confirmed";
    return {
      ok: true,
      orderId,
      devFallback: false,
      expiresAt: new Date(expiresAt).toISOString(),
      message:
        "TELEGRAM_CONFIRM_MODE=auto-paper 모드. paper 거래 즉시 confirmed.",
      mode: "auto-paper",
    };
  }

  if (mode === "auto-live") {
    // 실계좌 자동 confirm: v1.1.2에서 doubleConfirmed=false로 pending 유지
    // → 호출자가 2차 confirm 모달 후 doubleConfirmed=true로 재호출 또는
    // → body에 doubleConfirmed 헤더/필드 포함 시 즉시 confirmed
    if (req.doubleConfirmed) {
      pending.status = "confirmed";
      return {
        ok: true,
        orderId,
        devFallback: false,
        expiresAt: new Date(expiresAt).toISOString(),
        message:
          "TELEGRAM_CONFIRM_MODE=auto-live 모드. UI 2차 confirm 완료. 실계좌 confirmed.",
        mode: "auto-live",
      };
    }
    // doubleConfirmed 없으면 pending 유지 (호출자가 2차 confirm 모달 띄움)
    return {
      ok: false,
      orderId,
      devFallback: false,
      expiresAt: new Date(expiresAt).toISOString(),
      message:
        "TELEGRAM_CONFIRM_MODE=auto-live 모드. UI 2차 confirm 필요 (doubleConfirmed=true).",
      mode: "auto-live",
    };
  }

  // mode === "telegram" (기본)
  // dev fallback: 봇 미설정 시 자동 confirm
  if (isDevFallback()) {
    return {
      ok: true,
      orderId,
      devFallback: true,
      expiresAt: new Date(expiresAt).toISOString(),
      message:
        "TOSS_TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정. dev fallback: 자동 confirm. 실사용 시 둘 다 설정 필요.",
      mode: "telegram",
    };
  }

  // 실제 Telegram 발송
  const text =
    `📊 토스 주문 confirm 요청\n\n` +
    `종목: ${req.symbol}\n` +
    `방향: ${req.side === "BUY" ? "매수" : "매도"}\n` +
    `수량: ${req.quantity.toLocaleString()}주\n` +
    `가격: ${req.price.toLocaleString()}원\n` +
    `총액: ${(req.price * req.quantity).toLocaleString()}원\n` +
    (req.accountSeq !== undefined ? `계좌 seq: ${req.accountSeq}\n` : "") +
    `\norderId: ${orderId}\n` +
    `만료: ${new Date(expiresAt).toISOString()} (${ttlSec}초)\n\n` +
    `[확인] 클릭 시 toss-trader가 토스 Open API에 주문을 전송합니다.`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ 확인 (주문 실행)", callback_data: `confirm:${orderId}` },
        { text: "❌ 취소", callback_data: `cancel:${orderId}` },
      ],
    ],
  };

  const botToken = getBotToken();
  const chatId = getChatId();
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: inlineKeyboard,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    // 발송 실패 시 pending 제거
    pendingStore.delete(orderId);
    const body = await res.text();
    throw new Error(`Telegram sendMessage 실패: ${res.status} ${body.slice(0, 200)}`);
  }

  return {
    ok: true,
    orderId,
    devFallback: false,
    expiresAt: new Date(expiresAt).toISOString(),
    message: "Telegram 메시지 발송됨. 사용자 confirm 대기 중.",
    mode: "telegram",
  };
}

// ─── handleCallback (Telegram webhook → toss-trader) ─────────────
export type CallbackAction = "confirm" | "cancel" | "unknown";

export interface CallbackResult {
  action: CallbackAction;
  orderId: string;
  order?: PendingOrder; // 매칭된 경우
  reason?: string; // 실패/만료/취소 사유
  callbackQueryId?: string; // Telegram answerCallbackQuery용
}

export async function handleCallback(callbackData: string, callbackQueryId?: string): Promise<CallbackResult> {
  cleanupExpired();

  // 콜백 데이터 파싱: "confirm:order_xxx" 또는 "cancel:order_xxx"
  const [actionRaw, orderId] = callbackData.split(":", 2);
  const action: CallbackAction =
    actionRaw === "confirm" ? "confirm" : actionRaw === "cancel" ? "cancel" : "unknown";

  if (!orderId) {
    return { action: "unknown", orderId: "", reason: "callback_data 형식 오류 (action:orderId)", callbackQueryId };
  }

  const pending = pendingStore.get(orderId);
  if (!pending) {
    return {
      action,
      orderId,
      reason: "orderId not found (만료되었거나 다른 cold start)",
      callbackQueryId,
    };
  }

  if (pending.status === "expired" || pending.expiresAt <= Date.now()) {
    pending.status = "expired";
    return { action, orderId, order: pending, reason: "만료됨 (5분 초과)", callbackQueryId };
  }

  if (pending.status === "canceled") {
    return { action, orderId, order: pending, reason: "이미 취소됨", callbackQueryId };
  }

  if (pending.status === "confirmed") {
    return { action, orderId, order: pending, reason: "이미 confirm됨 (멱등)", callbackQueryId };
  }

  // status 갱신
  pending.status = action === "confirm" ? "confirmed" : "canceled";

  return {
    action,
    orderId,
    order: pending,
    callbackQueryId,
  };
}

// ─── cancelOrder (UI에서 직접 cancel) ──────────────────────────
export function cancelOrder(orderId: string): { ok: boolean; reason?: string } {
  const pending = pendingStore.get(orderId);
  if (!pending) return { ok: false, reason: "orderId not found" };
  if (pending.status !== "pending") return { ok: false, reason: `이미 ${pending.status} 상태` };
  pending.status = "canceled";
  return { ok: true };
}

// ─── 조회 (테스트 + UI 상태 확인용) ─────────────────────────────
export function getOrder(orderId: string): PendingOrder | undefined {
  cleanupExpired();
  const p = pendingStore.get(orderId);
  if (p && p.status === "pending" && p.expiresAt <= Date.now()) {
    p.status = "expired";
  }
  return p;
}

export function listPendingOrders(): PendingOrder[] {
  cleanupExpired();
  return Array.from(pendingStore.values()).filter((p) => p.status === "pending");
}

// ─── store reset (테스트 격리용) ────────────────────────────────
export function _resetPendingStore(): void {
  pendingStore.clear();
}

// ─── Telegram answerCallbackQuery (봇이 사용자에게 토스트) ──────
export async function answerCallback(callbackQueryId: string, text: string, showAlert = false): Promise<void> {
  if (isDevFallback() || !callbackQueryId) return;
  const botToken = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert }),
    cache: "no-store",
  });
}
