/**
 * app/page.tsx — toss-trader 메인 대시보드 (7.5단계)
 *
 * 7.5단계: Portfolio / History 탭 네비게이션 추가
 * 5단계: Portfolio (잔고 + 시세 + 손익)
 * 4단계: OrderButton (매수/매도 + Telegram confirm)
 */

"use client";

import { useState } from "react";
import { Portfolio } from "@/components/Portfolio";
import { OrderButton } from "@/components/OrderButton";
import { History } from "@/components/History";

type Tab = "dashboard" | "history";

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🤖 toss-trader</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            토스증권 Open API 기반 투자 어시스턴트 (v0.4 단순화)
          </p>
        </header>

        <section className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h2 className="text-sm font-semibold mb-2">📋 v0.4 동작 흐름</h2>
          <ol className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1 list-decimal list-inside">
            <li>
              <strong>Dashboard 탭</strong>: Portfolio (보유 종목 + 손익, 10초 갱신) + OrderButton (매수/매도)
            </li>
            <li>
              <strong>History 탭</strong>: 매수/매도/분석/스냅샷 이력 조회 (5초 갱신)
            </li>
            <li>매수/매도 → Confirm 모달 → &quot;발송&quot; → Telegram 메시지 (또는 dev fallback 자동 confirm)</li>
            <li>Telegram [확인] 클릭 → toss Open API 주문 → history 자동 기록</li>
            <li>6대 안전 가드 자동 적용 (paper 기본, 가드 5 telegramConfirmed 필요)</li>
          </ol>
        </section>

        {/* 탭 네비게이션 */}
        <nav className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800" role="tablist" aria-label="대시보드 탭">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "dashboard"}
            onClick={() => setTab("dashboard")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "dashboard"
                ? "border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            📊 Dashboard
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "history"
                ? "border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            📋 History
          </button>
        </nav>

        {/* 탭 컨텐츠 */}
        {tab === "dashboard" && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">📊 포트폴리오 + 주문 (데모: 삼성전자 005930)</h2>
            <div className="grid lg:grid-cols-2 gap-4">
              <Portfolio accountSeq={1} />
              <OrderButton symbol="005930" symbolName="삼성전자" currentPrice={70000} />
            </div>
          </section>
        )}

        {tab === "history" && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">📋 매수/매도/분석/스냅샷 이력</h2>
            <History symbolFilter="005930" />
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">🔧 8단계 이후 추가 예정</h2>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
            <li>e2e 테스트 (Playwright + Vercel preview URL 자동화)</li>
            <li>여러 종목 동시 모니터링 (배치)</li>
            <li>history 영구 저장 (외부 storage — S3/R2)</li>
            <li>WebSocket 실시간 시세 (선택)</li>
          </ul>
        </section>

        <footer className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          <p>🤖 toss-trader v0.4 | Next.js 16.2.10 + React 19.2.4 | Paper trading 기본</p>
          <p className="mt-1">
            📚 상세: <a href="https://github.com/sigco3111/toss-trader" className="underline">github.com/sigco3111/toss-trader</a>
            {' · '}
            🛡️ 안전 가드 6종 + kstost history 방식
          </p>
        </footer>
      </main>
    </div>
  );
}
