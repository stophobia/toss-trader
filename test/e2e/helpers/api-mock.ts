/**
 * test/e2e/helpers/api-mock.ts — 토스 API mock (v1.2 e2e)
 *
 * 실계좌 영향 없이 가짜 응답으로 e2e 테스트.
 * 자동 적용: 테스트 시작 전 /api/toss/* 요청 가로채기.
 */

import type { Page, Route } from "@playwright/test";

/**
 * 토스 holdings mock: 삼성전자 10주 + SK하이닉스 5주 + 카카오 20주
 */
const MOCK_HOLDINGS = {
  result: {
    totalPurchaseAmount: { krw: "1150000", usd: null },
    marketValue: {
      amount: { krw: "1200000", usd: null },
      amountAfterCost: { krw: "1200000", usd: null },
    },
    profitLoss: {
      amount: { krw: "50000", usd: null },
      amountAfterCost: { krw: "50000", usd: null },
      rate: "4.55",
      rateAfterCost: "4.55",
    },
    dailyProfitLoss: { amount: { krw: "5000" }, rate: "0.42" },
    items: [
      {
        symbol: "005930",
        symbolName: "삼성전자",
        quantity: 10,
        avgPrice: 70000,
        currentPrice: 75000,
        evalAmount: 750000,
        pnl: 50000,
        pnlRate: 7.14,
      },
      {
        symbol: "000660",
        symbolName: "SK하이닉스",
        quantity: 5,
        avgPrice: 130000,
        currentPrice: 135000,
        evalAmount: 675000,
        pnl: 25000,
        pnlRate: 3.85,
      },
      {
        symbol: "035720",
        symbolName: "카카오",
        quantity: 20,
        avgPrice: 50000,
        currentPrice: 48000,
        evalAmount: 960000,
        pnl: -40000,
        pnlRate: -4.0,
      },
    ],
  },
};

/**
 * 토스 prices mock: { symbol, lastPrice }
 */
const MOCK_PRICES: Record<string, number> = {
  "005930": 75000,
  "000660": 135000,
  "035720": 48000,
};

/**
 * 모든 토스 API + history + telegram mock
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // /api/toss/api/v1/holdings
  await page.route("**/api/toss/api/v1/holdings", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: MOCK_HOLDINGS,
        servedAt: new Date().toISOString(),
        dryRun: true,
        rateLimit: { limit: 5, remaining: 4, reset: 1 },
      }),
    });
  });

  // /api/toss/api/v1/prices?symbols=...
  await page.route("**/api/toss/api/v1/prices**", async (route: Route) => {
    const url = new URL(route.request().url());
    const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    const result = symbols.map((s) => ({
      symbol: s,
      timestamp: new Date().toISOString(),
      lastPrice: String(MOCK_PRICES[s] ?? 70000),
      currency: "KRW",
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { result },
        servedAt: new Date().toISOString(),
        dryRun: true,
        rateLimit: { limit: 10, remaining: 9, reset: 1 },
      }),
    });
  });

  // /api/toss/api/v1/accounts
  await page.route("**/api/toss/api/v1/accounts", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { result: [{ accountSeq: 1, accountName: "종합매매" }] },
        servedAt: new Date().toISOString(),
        dryRun: true,
      }),
    });
  });

  // /api/telegram/send (auto 모드: 즉시 confirmed)
  await page.route("**/api/telegram/send", async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const mode = body.confirmMode ?? "telegram";
    const orderId = `order_${Date.now().toString(36)}_test`;
    if (mode === "auto") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          orderId,
          devFallback: false,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          message: "auto 모드: 즉시 confirmed",
          mode: "auto",
        }),
      });
    } else if (mode === "off") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          orderId,
          devFallback: false,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          message: "off 모드: 차단",
          mode: "off",
        }),
      });
    } else {
      // telegram: dev fallback
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          orderId,
          devFallback: true,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          message: "dev fallback: 자동 confirm",
          mode: "telegram",
        }),
      });
    }
  });

  // /api/toss/api/v1/orders (실제 주문 — paper mock)
  await page.route("**/api/toss/api/v1/orders", async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          result: {
            orderId: `toss-${Date.now()}`,
            clientOrderId: body.clientOrderId,
            symbol: body.symbol,
            side: body.side,
            quantity: body.quantity,
            price: body.price,
            status: "FILLED", // paper mock: 즉시 체결
            executedAt: new Date().toISOString(),
          },
        },
        servedAt: new Date().toISOString(),
        dryRun: true,
      }),
    });
  });

  // /api/history (GET/POST 모두 mock)
  await page.route("**/api/history**", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          availability: "readonly", // Vercel readonly
          count: 0,
          records: [],
          servedAt: new Date().toISOString(),
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          availability: "readonly",
          saved: false,
          servedAt: new Date().toISOString(),
        }),
      });
    }
  });
}
