/**
 * test/e2e/dashboard.spec.ts — 대시보드 e2e (v1.2)
 *
 * v1.1.4/v1.1.5 통합 검증:
 * - 페이지 로드 (3-컬럼: Portfolio + OrderButton + ConfirmModeToggle)
 * - 탭 전환 (Dashboard ↔ History)
 * - 매수 시뮬레이션 (auto 모드)
 * - confirm 모드 토글 (localStorage)
 */

import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./helpers/api-mock";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("페이지 로드 시 Dashboard 탭에 Portfolio/OrderButton/ConfirmModeToggle 표시", async ({ page }) => {
    await page.goto("/");

    // 대시보드 헤더
    await expect(page.getByRole("heading", { name: /toss-trader/ })).toBeVisible();
    await expect(page.getByText(/v0\.4 단순화/)).toBeVisible();

    // 3-컬럼: Portfolio + OrderButton + ConfirmModeToggle
    await expect(page.getByText(/Portfolio \(계좌 #1\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: "매수" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "매도" }).first()).toBeVisible();
    await expect(page.getByText(/Telegram confirm 모드/)).toBeVisible();
  });

  test("매수 진행 → confirm 모달 → 발송 → 결과 표시 (auto 모드)", async ({ page }) => {
    // 1. localStorage를 auto로 설정 (auto 모드 시작)
    await page.addInitScript(() => {
      window.localStorage.setItem("toss-trader:confirm-mode", "auto");
    });

    await page.goto("/");

    // 2. "매수 진행" 버튼 클릭
    await page.getByRole("button", { name: "매수 진행" }).click();

    // 3. confirm 모달 표시
    await expect(page.getByRole("heading", { name: "주문 confirm" })).toBeVisible();
    // 모달 안에 종목 코드 + 매수 텍스트
    const modal = page.getByRole("heading", { name: "주문 confirm" }).locator("..");
    await expect(modal.getByText(/005930/)).toBeVisible();
    await expect(modal.getByText(/매수/)).toBeVisible();

    // 4. "발송" 클릭
    await page.getByRole("button", { name: "발송" }).click();

    // 5. auto 모드: 즉시 confirmed → 주문 실행 → 결과 표시
    await expect(page.getByText(/주문 성공/)).toBeVisible({ timeout: 10_000 });
  });

  test("History 탭 클릭 시 이력 화면 표시", async ({ page }) => {
    await page.goto("/");

    // History 탭 클릭
    await page.getByRole("tab", { name: /History/ }).click();

    // History 헤더
    await expect(page.getByRole("heading", { name: /History \(이력\)/ })).toBeVisible();
    // 선택 종목 헤더
    await expect(page.getByRole("heading", { name: /삼성전자.*005930.*이력/ })).toBeVisible();
    // 빈 이력 메시지
    await expect(page.getByText("이력이 없습니다.")).toBeVisible();
  });

  test("ConfirmModeToggle 3 옵션 표시 (telegram/auto/off)", async ({ page }) => {
    await page.goto("/");

    // ConfirmModeToggle 라디오
    await expect(page.getByRole("radio", { name: /Telegram 메시지/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /자동 확인/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /비활성화/ })).toBeVisible();
  });

  test("매도 클릭 → 수량 자동 채움 (v1.1.5: holdings 매칭)", async ({ page }) => {
    await page.goto("/");

    // 매도 클릭 (삼성전자 holdings 10주 매칭)
    await page.getByRole("button", { name: "매도" }).first().click();

    // 수량 input이 10으로 자동 채움 (v1.1.5)
    const qtyInput = page.locator("#quantity");
    await expect(qtyInput).toHaveValue("10");
  });
});
