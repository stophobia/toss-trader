/**
 * test/settings.test.ts — toss-trader 클라이언트 설정 TDD (v1.1.2)
 *
 * @vitest-environment: node (localStorage mock 사용)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadConfirmMode,
  saveConfirmMode,
  getDefaultMode,
  isValidMode,
  TELEGRAM_CONFIRM_MODES,
  type TelegramConfirmMode,
} from "@/lib/settings";

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string): string | null => storage[k] ?? null,
  setItem: (k: string, v: string): void => {
    storage[k] = v;
  },
  removeItem: (k: string): void => {
    delete storage[k];
  },
  clear: (): void => {
    for (const k of Object.keys(storage)) delete storage[k];
  },
  key: (i: number): string | null => Object.keys(storage)[i] ?? null,
  get length(): number {
    return Object.keys(storage).length;
  },
};

describe("TELEGRAM_CONFIRM_MODES", () => {
  it("4개 옵션 (telegram/auto-paper/auto-live/off)", () => {
    expect(TELEGRAM_CONFIRM_MODES).toHaveLength(4);
    const values = TELEGRAM_CONFIRM_MODES.map((m) => m.value);
    expect(values).toEqual(["telegram", "auto-paper", "auto-live", "off"]);
  });

  it("auto-live에 warning 존재 (실계좌 경고)", () => {
    const autoLive = TELEGRAM_CONFIRM_MODES.find((m) => m.value === "auto-live");
    expect(autoLive?.warning).toBeDefined();
    expect(autoLive?.warning).toContain("실계좌");
  });

  it("각 옵션에 label + description 존재", () => {
    for (const m of TELEGRAM_CONFIRM_MODES) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});

describe("isValidMode", () => {
  it("유효한 모드 → true", () => {
    expect(isValidMode("telegram")).toBe(true);
    expect(isValidMode("auto-paper")).toBe(true);
    expect(isValidMode("auto-live")).toBe(true);
    expect(isValidMode("off")).toBe(true);
  });

  it("잘못된 모드 → false", () => {
    expect(isValidMode("invalid")).toBe(false);
    expect(isValidMode("auto")).toBe(false); // v1.1.1 였던 단일 auto는 이제 무효
    expect(isValidMode(null)).toBe(false);
    expect(isValidMode(undefined)).toBe(false);
    expect(isValidMode(123)).toBe(false);
  });
});

describe("loadConfirmMode", () => {
  beforeEach(() => {
    localStorageMock.clear();
    delete process.env.TELEGRAM_CONFIRM_MODE;
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.unstubAllGlobals();
  });

  it("localStorage 비어있음 + env 없음 → 'telegram' 기본", () => {
    expect(loadConfirmMode()).toBe("telegram");
  });

  it("localStorage 'auto-paper' → 'auto-paper'", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "auto-paper");
    expect(loadConfirmMode()).toBe("auto-paper");
  });

  it("localStorage 'auto-live' → 'auto-live'", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "auto-live");
    expect(loadConfirmMode()).toBe("auto-live");
  });

  it("localStorage 잘못된 값 → 'telegram' fallback", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "invalid");
    expect(loadConfirmMode()).toBe("telegram");
  });

  it("localStorage 'auto' (v1.1.1 단일) → 'telegram' fallback (v1.1.2 무효)", () => {
    localStorageMock.setItem("toss-trader:confirm-mode", "auto");
    expect(loadConfirmMode()).toBe("telegram");
  });

  it("env TELEGRAM_CONFIRM_MODE=auto-live + localStorage 비어있음 → 'auto-live'", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto-live";
    expect(loadConfirmMode()).toBe("auto-live");
  });

  it("env 'off' + localStorage 'telegram' → localStorage 우선 ('telegram')", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "off";
    localStorageMock.setItem("toss-trader:confirm-mode", "telegram");
    expect(loadConfirmMode()).toBe("telegram");
  });
});

describe("saveConfirmMode", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("window", { localStorage: localStorageMock });
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.unstubAllGlobals();
  });

  it("4개 모드 save → load로 읽기", () => {
    const modes: TelegramConfirmMode[] = ["telegram", "auto-paper", "auto-live", "off"];
    for (const m of modes) {
      saveConfirmMode(m);
      expect(loadConfirmMode()).toBe(m);
    }
  });
});

describe("getDefaultMode", () => {
  beforeEach(() => {
    delete process.env.TELEGRAM_CONFIRM_MODE;
  });

  it("env 없음 → 'telegram'", () => {
    expect(getDefaultMode()).toBe("telegram");
  });

  it("env 'auto-paper' → 'auto-paper'", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto-paper";
    expect(getDefaultMode()).toBe("auto-paper");
  });

  it("env 'auto-live' → 'auto-live'", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto-live";
    expect(getDefaultMode()).toBe("auto-live");
  });

  it("env 'auto' (v1.1.1 단일) → 'telegram' fallback", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "auto";
    expect(getDefaultMode()).toBe("telegram");
  });

  it("env 잘못된 값 → 'telegram' fallback", () => {
    process.env.TELEGRAM_CONFIRM_MODE = "invalid";
    expect(getDefaultMode()).toBe("telegram");
  });
});
