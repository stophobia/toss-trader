import type { SessionState } from "@/lib/types";
import { runOpencodeInvestmentAgent } from "@/lib/agents/opencode/runner";
import type { AgentRunResult } from "@/lib/agents/shared";

/**
 * Agent selection.
 *
 *   - "opencode" (default): local `opencode run --format json` process.
 *   - "codex":              legacy `codex exec` process. Kept as an env-var
 *                           escape hatch for now; the codex runner is not
 *                           shipped in this folder. Use only if you have
 *                           your own `~/codex` shim wired up.
 *
 * Selection via env var `AGENT_KIND`. Per-session override is intentionally
 * not exposed in the UI yet — this is the simplest stable default.
 */
export type AgentKind = "opencode" | "codex";

const defaultKind: AgentKind =
  (process.env.AGENT_KIND as AgentKind | undefined) ?? "opencode";

export function getActiveAgentKind(): AgentKind {
  return defaultKind;
}

export async function runInvestmentAgent(
  session: SessionState,
  kind: AgentKind = defaultKind,
): Promise<AgentRunResult> {
  if (kind === "opencode") {
    return runOpencodeInvestmentAgent(session);
  }
  if (kind === "codex") {
    throw new Error(
      "Codex runner is not bundled in this build. Set AGENT_KIND=opencode " +
        "or wire your own runner in lib/agents/codex/runner.ts.",
    );
  }
  throw new Error(`Unknown agent kind: ${kind as string}`);
}
