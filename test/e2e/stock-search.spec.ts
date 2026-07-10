/**
 * test/e2e/stock-search.spec.ts — 종목 검색 자동완성 e2e (v1.2)
 */

import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./helpers/api-mock";

test.describe("StockSearch", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("초기값: 삼성전자 자동 입력", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#stock-search-input");
    await expect(searchInput).toHaveValue("삼성전자");
  });

  test("'NAVER' 입력 → 자동완성 dropdown → NAVER 선택", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#stock-search-input");

    // 입력
    await searchInput.click();
    await searchInput.fill("NAVER");

    // 자동완성 dropdown (role=listbox)
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 1_000 });

    // NAVER 옵션 클릭
    await listbox.getByRole("option").filter({ hasText: /NAVER/ }).first().click();

    // input 값 업데이트 확인
    await expect(searchInput).toHaveValue("NAVER");
  });

  test("검색 결과 없음 → 안내 메시지", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#stock-search-input");

    await searchInput.click();
    await searchInput.fill("XYZ없는종목");

    // 안내 메시지
    await expect(page.getByText(/XYZ없는종목.*해당하는 종목 없음/)).toBeVisible({ timeout: 1_000 });
  });
});
