/**
 * test/candles.test.ts — toss-trader 캔들 차트 TDD (v1.4)
 */

import { describe, it, expect, vi } from "vitest";
import {
  fetchCandles,
  calcCandleStats,
  CANDLE_INTERVALS,
  DEFAULT_CANDLE_COUNT,
  type Candle,
} from "@/lib/candles";

function mockFetchResponse(candles: Candle[], status = 200): Response {
  return new Response(
    JSON.stringify({
      data: { result: candles },
      servedAt: new Date().toISOString(),
      dryRun: true,
    }),
    { status, headers: { "content-type": "application/json" } }
  );
}

const SAMPLE_CANDLES: Candle[] = [
  { timestamp: 1700000000000, open: 70000, high: 71000, low: 69000, close: 70500, volume: 1000000 },
  { timestamp: 1700086400000, open: 70500, high: 72000, low: 70000, close: 71500, volume: 1200000 },
  { timestamp: 1700172800000, open: 71500, high: 72500, low: 71000, close: 71000, volume: 1100000 },
];

describe("CANDLE_INTERVALS", () => {
  it("2개 옵션 (1m/1d)", () => {
    expect(CANDLE_INTERVALS).toHaveLength(2);
    const values = CANDLE_INTERVALS.map((m) => m.value);
    expect(values).toEqual(["1d", "1m"]);
  });
});

describe("DEFAULT_CANDLE_COUNT", () => {
  it("기본값 30", () => {
    expect(DEFAULT_CANDLE_COUNT).toBe(30);
  });
});

describe("fetchCandles", () => {
  it("정상 응답 → candles 반환 + availability 'available'", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_CANDLES)) as unknown as typeof fetch;
    try {
      const r = await fetchCandles({ symbol: "005930", interval: "1d" });
      expect(r.availability).toBe("available");
      expect(r.candles).toHaveLength(3);
      expect(r.candles[0]?.open).toBe(70000);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("interval 기본값 '1d'", async () => {
    const originalFetch = global.fetch;
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      capturedUrl = String(url);
      return Promise.resolve(mockFetchResponse(SAMPLE_CANDLES));
    }) as unknown as typeof fetch;
    try {
      await fetchCandles({ symbol: "005930" });
      expect(capturedUrl).toContain("interval=1d");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("count 기본값 30", async () => {
    const originalFetch = global.fetch;
    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      capturedUrl = String(url);
      return Promise.resolve(mockFetchResponse(SAMPLE_CANDLES));
    }) as unknown as typeof fetch;
    try {
      await fetchCandles({ symbol: "005930" });
      expect(capturedUrl).toContain("count=30");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("429 응답 → availability 'readonly' + 메시지", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse([], 429)) as unknown as typeof fetch;
    try {
      const r = await fetchCandles({ symbol: "005930" });
      expect(r.availability).toBe("readonly");
      expect(r.message).toContain("Rate limit");
      expect(r.candles).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("symbol 없으면 'disabled' + 메시지", async () => {
    const r = await fetchCandles({ symbol: "" });
    expect(r.availability).toBe("disabled");
    expect(r.message).toContain("symbol 필요");
  });

  it("envelope 직접 배열 (raw array)", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_CANDLES), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ) as unknown as typeof fetch;
    try {
      const r = await fetchCandles({ symbol: "005930" });
      expect(r.candles).toHaveLength(3);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("calcCandleStats", () => {
  it("빈 배열 → null", () => {
    expect(calcCandleStats([])).toBeNull();
  });

  it("3개 캔들 → min/max/latest/change 계산", () => {
    const stats = calcCandleStats(SAMPLE_CANDLES);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(70500);
    expect(stats!.max).toBe(71500);
    expect(stats!.latest).toBe(71000);
    expect(stats!.change).toBe(500); // 71000 - 70500
    expect(stats!.changePct).toBeCloseTo(0.71, 1);
  });
});
