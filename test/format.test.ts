/**
 * test/format.test.ts — toss-trader 포맷 헬퍼 TDD (5단계)
 */

import { describe, it, expect } from "vitest";
import {
  formatKRW,
  formatQuantity,
  calcPnL,
  formatPnL,
  formatPnLPercent,
  pnlColorClass,
  calcEvalAmount,
  formatChange,
  formatKrwShort,
  findHoldingBySymbol,
  getSellableQuantity,
  type HoldingItem,
} from "@/lib/format";

describe("formatKRW", () => {
  it("70000 → '70,000원'", () => {
    expect(formatKRW(70000)).toBe("70,000원");
  });
  it("음수도 처리", () => {
    expect(formatKRW(-12345)).toBe("-12,345원");
  });
  it("null/undefined/NaN → '-'", () => {
    expect(formatKRW(null)).toBe("-");
    expect(formatKRW(undefined)).toBe("-");
    expect(formatKRW(NaN)).toBe("-");
  });
});

describe("formatQuantity", () => {
  it("10 → '10주'", () => {
    expect(formatQuantity(10)).toBe("10주");
  });
  it("1000 → '1,000주'", () => {
    expect(formatQuantity(1000)).toBe("1,000주");
  });
  it("null → '-'", () => {
    expect(formatQuantity(null)).toBe("-");
  });
});

describe("calcPnL", () => {
  it("수익: (75000 - 70000) * 10 = 50000원, +7.14%", () => {
    const r = calcPnL(75000, 70000, 10);
    expect(r.amount).toBe(50000);
    expect(r.rate).toBeCloseTo(7.142857, 4);
  });
  it("손실: (65000 - 70000) * 10 = -50000원, -7.14%", () => {
    const r = calcPnL(65000, 70000, 10);
    expect(r.amount).toBe(-50000);
    expect(r.rate).toBeCloseTo(-7.142857, 4);
  });
  it("avgPrice=0 → rate=0 (0 나누기 회피)", () => {
    const r = calcPnL(75000, 0, 10);
    expect(r.amount).toBe(750000);
    expect(r.rate).toBe(0);
  });
  it("NaN → amount/rate = 0", () => {
    const r = calcPnL(NaN, 70000, 10);
    expect(r.amount).toBe(0);
    expect(r.rate).toBe(0);
  });
});

describe("formatPnL", () => {
  it("양수: '+50,000원'", () => {
    expect(formatPnL(50000)).toBe("+50,000원");
  });
  it("음수: '-50,000원'", () => {
    expect(formatPnL(-50000)).toBe("-50,000원");
  });
  it("0: '0원'", () => {
    expect(formatPnL(0)).toBe("0원");
  });
  it("NaN: '-'", () => {
    expect(formatPnL(NaN)).toBe("-");
  });
});

describe("formatPnLPercent", () => {
  it("양수: '+7.14%'", () => {
    expect(formatPnLPercent(7.1428)).toBe("+7.14%");
  });
  it("음수: '-7.14%'", () => {
    expect(formatPnLPercent(-7.1428)).toBe("-7.14%");
  });
  it("0: '0.00%'", () => {
    expect(formatPnLPercent(0)).toBe("0.00%");
  });
});

describe("pnlColorClass", () => {
  it("양수 → text-emerald-600", () => {
    expect(pnlColorClass(100)).toBe("text-emerald-600");
  });
  it("음수 → text-red-600", () => {
    expect(pnlColorClass(-100)).toBe("text-red-600");
  });
  it("0 → text-zinc-500", () => {
    expect(pnlColorClass(0)).toBe("text-zinc-500");
  });
});

describe("calcEvalAmount", () => {
  it("75000 * 10 = 750000", () => {
    expect(calcEvalAmount(75000, 10)).toBe(750000);
  });
  it("NaN → 0", () => {
    expect(calcEvalAmount(NaN, 10)).toBe(0);
  });
});

describe("formatChange", () => {
  it("상승: +1500원 (+2.19%) / sign=up", () => {
    const r = formatChange(70000, 68500);
    expect(r.amount).toBe(1500);
    expect(r.rate).toBeCloseTo(2.1898, 3);
    expect(r.formatted).toBe("+1,500원 (+2.19%)");
    expect(r.sign).toBe("up");
  });
  it("하락: -500원 (-0.71%) / sign=down", () => {
    const r = formatChange(69500, 70000);
    expect(r.amount).toBe(-500);
    expect(r.formatted).toBe("-500원 (-0.71%)");
    expect(r.sign).toBe("down");
  });
  it("변동 없음: 0 / sign=flat", () => {
    const r = formatChange(70000, 70000);
    expect(r.amount).toBe(0);
    expect(r.formatted).toBe("0원 (0.00%)");
    expect(r.sign).toBe("flat");
  });
  it("prevClose=0 → '-'", () => {
    const r = formatChange(70000, 0);
    expect(r.formatted).toBe("-");
    expect(r.sign).toBe("flat");
  });
});

describe("formatKrwShort", () => {
  it("100,000,000 (1억) → '1.0억'", () => {
    expect(formatKrwShort(1_0000_0000)).toBe("1.0억");
  });
  it("100,000,000,000 (1000억) → '1000.0억'", () => {
    expect(formatKrwShort(100_000_000_000)).toBe("1000.0억");
  });
  it("1,000,000,000,000 (1조) → '1.0조'", () => {
    expect(formatKrwShort(1_0000_0000_0000)).toBe("1.0조");
  });
  it("50,000 → '5만'", () => {
    expect(formatKrwShort(5_0000)).toBe("5만");
  });
  it("7,500 → '7,500'", () => {
    expect(formatKrwShort(7500)).toBe("7,500");
  });
});

// ─── v1.1.5: 매도 helper ──────────────────────────────────
describe("findHoldingBySymbol", () => {
  const sampleHoldings: HoldingItem[] = [
    { symbol: "005930", symbolName: "삼성전자", quantity: 10, avgPrice: 70000 },
    { symbol: "000660", symbolName: "SK하이닉스", quantity: 5, avgPrice: 130000 },
    { symbol: "035720", symbolName: "카카오", quantity: 20, avgPrice: 50000 },
  ];

  it("매칭되는 symbol → 해당 holding 반환", () => {
    const r = findHoldingBySymbol(sampleHoldings, "005930");
    expect(r).toBeDefined();
    expect(r?.symbolName).toBe("삼성전자");
    expect(r?.quantity).toBe(10);
    expect(r?.avgPrice).toBe(70000);
  });

  it("없는 symbol → undefined", () => {
    expect(findHoldingBySymbol(sampleHoldings, "999999")).toBeUndefined();
  });

  it("빈 symbol → undefined", () => {
    expect(findHoldingBySymbol(sampleHoldings, "")).toBeUndefined();
  });

  it("빈 holdings 배열 → undefined", () => {
    expect(findHoldingBySymbol([], "005930")).toBeUndefined();
  });
});

describe("getSellableQuantity", () => {
  it("holding 있음 → quantity 그대로", () => {
    expect(getSellableQuantity({ symbol: "005930", quantity: 10, avgPrice: 70000 })).toBe(10);
  });

  it("holding undefined → 0", () => {
    expect(getSellableQuantity(undefined)).toBe(0);
  });

  it("quantity 0 → 0 (음수 방지)", () => {
    expect(getSellableQuantity({ symbol: "005930", quantity: -5, avgPrice: 70000 })).toBe(0);
  });

  it("quantity 소수 → 내림 (Math.floor)", () => {
    expect(getSellableQuantity({ symbol: "005930", quantity: 10.7, avgPrice: 70000 })).toBe(10);
  });
});
