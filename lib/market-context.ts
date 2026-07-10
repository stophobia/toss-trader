import { authenticate, tossFetchAuthed, TossinvestError } from "@/lib/tossinvest";
import { upsertStockEntries } from "@/lib/stocks-cache";
import type { SessionState } from "@/lib/types";

/**
 * Per-analysis market snapshot.
 *
 * Each field is either the raw API response (success) or absent (skipped/failed).
 * Failed endpoints are recorded in `errors` with a human-readable message so
 * the agent can decide what to trust.
 */
export type MarketContext = {
  collectedAt: string;
  symbol: string;
  market: "KR" | "US";
  account: { accountSeq: number; accountNo?: string } | null;
  // 시세
  price?: unknown;
  orderbook?: unknown;
  recentTrades?: unknown;
  priceLimits?: unknown;
  candles?: unknown;
  // 종목
  stockInfo?: unknown;
  warnings?: unknown;
  // 시장
  marketCalendarKR?: unknown;
  exchangeRate?: unknown;
  // 자산
  holdings?: unknown;
  buyingPower?: unknown;
  sellableQuantity?: unknown;
  // 진단
  errors: { endpoint: string; status: number | null; message: string }[];
};

type EndpointName =
  | "price"
  | "orderbook"
  | "recentTrades"
  | "priceLimits"
  | "candles"
  | "stockInfo"
  | "warnings"
  | "marketCalendarKR"
  | "exchangeRate"
  | "holdings"
  | "buyingPower"
  | "sellableQuantity";

type Settled = { name: EndpointName; value: unknown };

/**
 * Build a per-symbol, per-account market snapshot by hitting ~10 endpoints in
 * parallel. Failures don't abort the run; they land in `errors` so the agent
 * can still produce a judgment with whatever it has.
 *
 * Costs: 1 /oauth2/token (cached after first call) + ~10 account-scoped GETs
 * per analysis cycle. At a 30s interval this is ~1200 calls/hour — well below
 * the documented rate limit but worth keeping an eye on.
 */
export async function collectMarketContext(
  session: SessionState,
  symbol: string,
  market: "KR" | "US",
): Promise<MarketContext> {
  const ctx: MarketContext = {
    collectedAt: new Date().toISOString(),
    symbol,
    market,
    account: null,
    errors: [],
  };

  // Auth + accountSeq first (token is cached so this is cheap on subsequent
  // calls). If auth fails outright, record it and return the partial context.
  let accountSeq: number;
  let accountNo: string | undefined;
  try {
    const { account } = await authenticate(session.apiKey, session.secretKey);
    accountSeq = account.accountSeq;
    accountNo = account.accountNo;
    ctx.account = { accountSeq, accountNo };
  } catch (error) {
    ctx.errors.push({
      endpoint: "auth",
      status: error instanceof TossinvestError ? error.status : null,
      message: error instanceof Error ? error.message : String(error),
    });
    return ctx;
  }

  // Public market endpoints (no accountSeq needed).
  const publicRequests: Promise<Settled>[] = [
    run("price", () =>
      tossFetchAuthed(
        `/api/v1/prices?symbols=${encodeURIComponent(symbol)}`,
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
    run("orderbook", () =>
      tossFetchAuthed(`/api/v1/orderbook?symbol=${encodeURIComponent(symbol)}`, {
        apiKey: session.apiKey,
        secretKey: session.secretKey,
        accountSeq,
      }),
    ),
    run("recentTrades", () =>
      tossFetchAuthed(`/api/v1/trades?symbol=${encodeURIComponent(symbol)}&count=20`, {
        apiKey: session.apiKey,
        secretKey: session.secretKey,
        accountSeq,
      }),
    ),
    run("priceLimits", () =>
      tossFetchAuthed(
        `/api/v1/price-limits?symbol=${encodeURIComponent(symbol)}`,
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
    run("candles", () =>
      tossFetchAuthed(
        // interval is enum: "1m" | "1d" (lowercase). Use 1d for daily candles
        // which is what the agent needs for swing decisions.
        `/api/v1/candles?symbol=${encodeURIComponent(symbol)}&interval=1d&count=20`,
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
    run("stockInfo", () =>
      tossFetchAuthed(
        `/api/v1/stocks?symbols=${encodeURIComponent(symbol)}`,
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
    run("warnings", () =>
      tossFetchAuthed(
        `/api/v1/stocks/${encodeURIComponent(symbol)}/warnings`,
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
    run("marketCalendarKR", () =>
      tossFetchAuthed("/api/v1/market-calendar/KR", {
        apiKey: session.apiKey,
        secretKey: session.secretKey,
        accountSeq,
      }),
    ),
    run("exchangeRate", () =>
      tossFetchAuthed(
        "/api/v1/exchange-rate?baseCurrency=USD&quoteCurrency=KRW",
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
  ];

  // Account-scoped endpoints (need accountSeq for X-Tossinvest-Account header).
  const accountRequests: Promise<Settled>[] = [
    run("holdings", () =>
      tossFetchAuthed("/api/v1/holdings", {
        apiKey: session.apiKey,
        secretKey: session.secretKey,
        accountSeq,
      }),
    ),
    run("buyingPower", () =>
      tossFetchAuthed(
        // currency=KRW for the domestic market. US market would need currency=USD.
        `/api/v1/buying-power?currency=${market === "US" ? "USD" : "KRW"}`,
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
    run("sellableQuantity", () =>
      tossFetchAuthed(
        `/api/v1/sellable-quantity?symbol=${encodeURIComponent(symbol)}`,
        { apiKey: session.apiKey, secretKey: session.secretKey, accountSeq },
      ),
    ),
  ];

  const all = await Promise.allSettled([...publicRequests, ...accountRequests]);
  for (const r of all) {
    if (r.status === "fulfilled") {
      const { name, value } = r.value;
      // Unwrap the {result: ...} envelope that every endpoint returns.
      const unwrapped =
        value && typeof value === "object" && "result" in (value as object)
          ? (value as { result: unknown }).result
          : value;
      if (unwrapped !== undefined) {
        (ctx as Record<string, unknown>)[name] = unwrapped;
      }
    } else {
      const reason = r.reason as { name: EndpointName; error: Error };
      const status =
        reason.error instanceof TossinvestError ? reason.error.status : null;
      ctx.errors.push({
        endpoint: reason.name,
        status,
        message: reason.error.message,
      });
    }
  }

  // Best-effort: feed stockInfo response into the dynamic stock cache so the
  // search dropdown gets richer over time. Failure here must not affect the
  // analysis outcome.
  try {
    const stockInfoRaw = ctx.stockInfo;
    const list = Array.isArray(stockInfoRaw)
      ? stockInfoRaw
      : stockInfoRaw &&
          typeof stockInfoRaw === "object" &&
          Array.isArray((stockInfoRaw as { result?: unknown }).result)
        ? (stockInfoRaw as { result: unknown[] }).result
        : [];
    if (list.length > 0) {
      const entries: Array<{
        symbol: string;
        name: string;
        englishName?: string;
        market: "KR" | "US";
        currency?: string;
      }> = [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const e = item as {
          symbol?: string;
          name?: string;
          englishName?: string;
          market?: string;
          currency?: string;
        };
        if (!e.symbol || !e.name) continue;
        const raw = (e.market || "").toUpperCase();
        const fromDto: "KR" | "US" =
          raw === "US" || raw.includes("NASDAQ") || raw.includes("NYSE") || raw.includes("AMEX")
            ? "US"
            : "KR";
        // If Toss API didn't tell us US explicitly, trust the caller's market
        // (which we received from the session). This handles "KRX" / "KOSDAQ"
        // strings that wouldn't otherwise flip to US.
        const m: "KR" | "US" = fromDto === "US" ? "US" : market;
        entries.push({
          symbol: e.symbol,
          name: e.name,
          englishName: e.englishName,
          market: m,
          currency: e.currency,
        });
      }
      if (entries.length > 0) {
        await upsertStockEntries(entries);
      }
    }
  } catch {
    // ignore — cache update is best-effort
  }

  return ctx;
}

async function run(
  name: EndpointName,
  fn: () => Promise<unknown>,
): Promise<Settled> {
  try {
    return { name, value: await fn() };
  } catch (error) {
    throw { name, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
