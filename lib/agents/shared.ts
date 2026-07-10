import path from "node:path";
import type { AgentRecommendation, SessionState } from "@/lib/types";

/**
 * Agent-agnostic helpers used by any CLI runner (codex, opencode, future).
 *
 * Responsibilities:
 *   - Build the investment-agent system prompt (shared across runners).
 *   - Parse + validate the model's final response.
 *   - Redact API keys before persisting diagnostics/history.
 *
 * Runner-specific concerns (binary path, CLI flags, stdout parsing) live in
 * the per-runner files (lib/agents/{codex,opencode}/runner.ts).
 */

export const apiDocsPath = path.join(process.cwd(), "tossinvest_apidocs.json");
export const outputSchemaPath = path.join(
  process.cwd(),
  "schemas",
  "investment-agent-output.schema.json",
);
export const historyPath = path.join(process.cwd(), "history");
export const runTimeoutMs = 10 * 60 * 1000;

export type AgentRunDiagnostics = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type AgentRunResult = {
  recommendation: AgentRecommendation;
  rawAssistantMessage: string;
  diagnostics: AgentRunDiagnostics;
};

export function buildPrompt(session: SessionState): string {
  return `
|[SYSTEM PROMPT]
너는 토스증권 Open API와 최신 공개 정보를 함께 확인하는 투자 상태 분석 에이전트다.
목표는 사용자가 미리 제공한 행동지침을 적용하여 현재 사야 하는지, 팔아야 하는지, 관망해야 하는지 하나의 JSON 판단으로 답하는 것이다.

중요한 안전 규칙:
- 너는 분석만 수행한다. 실제 주문 생성, 주문 정정, 주문 취소 endpoint는 절대 호출하지 마라.
- 매매 실행은 사용자가 화면에서 BUY 또는 SELL 버튼을 누른 뒤 백엔드가 별도로 처리한다.
- API key, secret key, access token, 계좌번호 원문은 출력하지 말고 파일에도 저장하지 마라.
- 확실한 근거가 부족하거나 API 데이터와 최신 뉴스가 충돌하면 HOLD를 우선한다.
- API 데이터만으로 단정하지 말고, 가능한 경우 최신 공개 뉴스/공시/리포트 성격의 자료도 확인한다.
- 반대로 뉴스 하나만으로 단정하지 말고, 현재가/호가/체결/차트/보유자산/주문가능 정보 등 객관적 상태와 함께 판단한다.
- 외부 자료를 찾지 못했거나 관련성이 낮으면 references는 []로 둔다.
- 결과는 반드시 JSON Schema와 일치하는 JSON 객체 하나만 출력한다.

응답 형식/타이밍 규칙:
- 도구 호출(API 조회, 웹 검색 등)은 합계 4회 이내로 제한한다. 같은 endpoint를 반복 호출하지 마라.
- 인증 실패(401/403)나 명백한 API 오류가 발생하면 즉시 멈추고 HOLD로 응답한다. 같은 호출을 재시도하지 마라.
- 시간이 부족하거나 정보를 충분히 모았으면 추가 조사 없이 지금까지의 데이터로 판단을 내려라.
- 응답은 최종 메시지에 JSON 객체 "하나만" 출력한다. \`\`\`json 펜스나 부가 설명 텍스트를 앞에 붙이지 마라.

토스증권 Open API 사용 정보:
- OpenAPI 문서 경로: ${apiDocsPath}
- API base URL: https://openapi.tossinvest.com
- API Key 환경변수: TOSSINVEST_API_KEY
- Secret Key 환경변수: TOSSINVEST_SECRET_KEY
- 계좌가 필요한 조회 API는 GET /api/v1/accounts의 accountSeq를 X-Tossinvest-Account 헤더에 넣는다.
- 조회에 필요한 endpoint만 사용한다. 특히 POST /api/v1/orders, /modify, /cancel은 호출 금지다.

history 폴더 정보:
- 경로: ${historyPath}
- 파일명은 기본적으로 조사/거래 시각의 epoch seconds를 사용한 JSON 파일이다. 같은 초에 여러 기록이 생기면 "-2" 같은 suffix가 붙을 수 있다.
- analysis 기록 형식: { "kind": "analysis", "epochSeconds": number, "createdAt": ISO string, "sessionId": string, "recommendation": AgentRecommendation, "rawAssistantMessage": string, "diagnostics": {...} }
- order 기록 형식: { "kind": "order", "epochSeconds": number, "createdAt": ISO string, "sessionId": string, "request": {...}, "response": {...} }
- 최근 history를 읽고 기존 판단, 체결 시도, 반복되는 리스크를 참고하되, 오래된 판단보다 최신 API/뉴스 데이터를 우선한다.

사용자 행동지침:
${session.instructions.trim() || "(사용자 행동지침이 비어 있다. 보수적으로 판단하고 명확한 근거가 없으면 HOLD한다.)"}

출력 규칙:
- symbol: 국내 주식은 종목코드, 미국 주식은 티커.
- market: KR 또는 US.
- decision.action: BUY, SELL, HOLD 중 하나.
- decision.confidence: 0.0 이상 1.0 이하.
- decision.reason: 핵심 근거를 한국어로 간결하게 설명.
- order: BUY 또는 SELL이면 권장 지정가 주문 정보를 넣고, HOLD면 null.
- references: 근거 자료가 있으면 title/url/reason을 넣고, 없으면 [].
`.trim();
}

export function trimForHistory(value: string): string {
  const maxLength = 40000;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n[truncated ${value.length - maxLength} chars]`;
}

export function redact(value: string, session: SessionState): string {
  // 너무 짧은 키(<8자)는 마스킹 시도 시 응답 본문의 무관한 글자까지 모두
  // "[REDACTED_*]"로 치환되어 JSON이 깨질 수 있다. 이 경우 마스킹을 스킵한다.
  // (8자 미만이면 식별력이 낮아 마스킹 실효성도 거의 없음)
  const apiKey = session.apiKey.length >= 8 ? session.apiKey : null;
  const secretKey = session.secretKey.length >= 8 ? session.secretKey : null;

  let result = value;
  if (apiKey) result = result.replaceAll(apiKey, "[REDACTED_TOSSINVEST_API_KEY]");
  if (secretKey)
    result = result.replaceAll(secretKey, "[REDACTED_TOSSINVEST_SECRET_KEY]");
  return result;
}

/**
 * Parse the agent's final text and validate it against our recommendation schema.
 *
 * Strategy:
 *   1. Strip a leading markdown fence if present.
 *   2. As a last resort, extract the first '{' through the last '}'.
 *   3. JSON.parse, then run structural validation.
 */
export function parseRecommendation(
  rawText: string,
): AgentRecommendation {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Agent returned empty response");
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // Last-resort: try to extract the outermost JSON object.
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first === -1 || last <= first) throw new Error("Agent output is not JSON");
    parsed = JSON.parse(candidate.slice(first, last + 1));
  }

  return assertRecommendation(parsed);
}

function assertRecommendation(value: unknown): AgentRecommendation {
  // 어떤 runner가 의도치 않게 배열로 감싸서 응답하는 경우 첫 원소를 사용한다.
  if (Array.isArray(value) && value.length > 0) {
    value = value[0];
  }

  if (!value || typeof value !== "object") {
    throw new Error("Agent output is not a JSON object");
  }

  const candidate = value as AgentRecommendation;
  if (!candidate.symbol || !candidate.market || !candidate.decision) {
    throw new Error("Agent output is missing required decision fields");
  }
  if (typeof candidate.symbol !== "string" || !candidate.symbol.trim()) {
    throw new Error("Agent output has invalid symbol");
  }
  if (!["KR", "US"].includes(candidate.market)) {
    throw new Error("Agent output has invalid market");
  }
  if (!["BUY", "SELL", "HOLD"].includes(candidate.decision.action)) {
    throw new Error("Agent output has invalid decision.action");
  }
  if (
    typeof candidate.decision.confidence !== "number" ||
    candidate.decision.confidence < 0 ||
    candidate.decision.confidence > 1
  ) {
    throw new Error("Agent output has invalid decision.confidence");
  }
  if (
    typeof candidate.decision.reason !== "string" ||
    !candidate.decision.reason.trim()
  ) {
    throw new Error("Agent output has invalid decision.reason");
  }
  if (candidate.order !== null && typeof candidate.order !== "object") {
    throw new Error("Agent output has invalid order");
  }
  if (candidate.decision.action === "HOLD" && candidate.order !== null) {
    throw new Error("Agent output must set order to null for HOLD");
  }
  if (
    (candidate.decision.action === "BUY" || candidate.decision.action === "SELL") &&
    candidate.order === null
  ) {
    throw new Error("Agent output must include order for BUY or SELL");
  }
  if (candidate.order) {
    if (
      typeof candidate.order.quantity !== "number" ||
      candidate.order.quantity <= 0 ||
      typeof candidate.order.limitPrice !== "number" ||
      candidate.order.limitPrice <= 0 ||
      !["KRW", "USD"].includes(candidate.order.currency)
    ) {
      throw new Error("Agent output has invalid order values");
    }
  }
  if (!Array.isArray(candidate.references)) {
    throw new Error("Agent output has invalid references");
  }
  for (const reference of candidate.references) {
    if (
      !reference ||
      typeof reference.title !== "string" ||
      !reference.title.trim() ||
      typeof reference.url !== "string" ||
      !/^https?:\/\//.test(reference.url) ||
      typeof reference.reason !== "string" ||
      !reference.reason.trim()
    ) {
      throw new Error("Agent output has invalid reference");
    }
  }

  return candidate;
}
