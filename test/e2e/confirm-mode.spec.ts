/**
 * test/e2e/confirm-mode.spec.ts — Telegram confirm 모드 UI e2e (v1.2)
 *
 * v1.1.4 3-모드 (telegram/auto/off) + localStorage 저장.
 */

import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./helpers/api-mock";

test.describe("ConfirmModeToggle", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test("localStorage 비어있음 → 기본 'Telegram 메시지' 선택", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("radio", { name: /Telegram 메시지/ })).toBeChecked();
  });

  test("'자동 확인' 선택 → localStorage 저장", async ({ page }) => {
    await page.goto("/");

    // 클릭
    await page.getByRole("radio", { name: /자동 확인/ }).check();

    // localStorage 확인
    const stored = await page.evaluate(() => window.localStorage.getItem("toss-trader:confirm-mode"));
    expect(stored).toBe("auto");
  });

  test("localStorage 'off' → '비활성화' 자동 선택", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("toss-trader:confirm-mode", "off");
    });
    await page.goto("/");

    await expect(page.getByRole("radio", { name: /비활성화/ })).toBeChecked();
  });
});
