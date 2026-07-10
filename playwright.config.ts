import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e 설정 (v1.2)
 *
 * - chromium: 메인 (Vercel preview URL 자동 검증)
 * - webkit: macOS Safari 호환
 * - baseURL: localhost:3000 (dev) 또는 Vercel preview URL (CI)
 * - mock: 토스 API 응답 가짜 데이터 (실계좌 영향 X)
 */

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // CI에서 .only() 사용 시 fail
  retries: process.env.CI ? 2 : 0, // CI에서만 2회 재시도
  workers: process.env.CI ? 1 : undefined, // CI는 직렬 (리소스 절약)
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000, // 각 테스트 30초
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: process.env.CI
    ? undefined // CI: Vercel preview URL 사용 (PLAYWRIGHT_BASE_URL)
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
