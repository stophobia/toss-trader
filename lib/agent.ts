/**
 * Compatibility shim.
 *
 * Earlier revisions imported `runCodexInvestmentAgent` from
 * `@/lib/codex-agent`. The runner was moved to `lib/agents/opencode/runner.ts`
 * (and routed via `lib/agents/index.ts`) when we switched the default agent
 * to OpenCode. This file keeps the old import path working so we don't have
 * to touch every call site at once.
 *
 * New code should import from `@/lib/agents` directly.
 */

export { runInvestmentAgent, getActiveAgentKind } from "@/lib/agents";
export type { AgentKind } from "@/lib/agents";

// Re-export the shared helpers for any legacy import sites that grabbed them
// off the old `codex-agent` module.
export {
  apiDocsPath,
  historyPath,
  buildPrompt,
  parseRecommendation,
  redact,
  trimForHistory,
} from "@/lib/agents/shared";
export type { AgentRunResult, AgentRunDiagnostics } from "@/lib/agents/shared";
