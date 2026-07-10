import { spawn } from "node:child_process";
import type { SessionState } from "@/lib/types";
import {
  apiDocsPath,
  buildPrompt,
  historyPath,
  parseRecommendation,
  redact,
  runTimeoutMs,
  trimForHistory,
  type AgentRunResult,
} from "@/lib/agents/shared";

/**
 * OpenCode runner.
 *
 * Why OpenCode:
 *   - First-class non-interactive mode: `opencode run --format json`.
 *   - Default session isolation: no flags needed to start a new session per call.
 *   - Safer default permissions: `--auto` only auto-approves non-denied actions,
 *     unlike codex's --dangerously-bypass-approvals-and-sandbox.
 *   - stdout is structured JSONL; the final assistant text is the `text` event.
 *
 * Binary path:
 *   - Defaults to `/opt/homebrew/bin/opencode` (macOS Homebrew default).
 *   - Override with env var `OPENCODE_BIN` or `AGENT_BIN`.
 *
 * Expected env vars passed to the child:
 *   - TOSSINVEST_API_KEY, TOSSINVEST_SECRET_KEY: user-provided credentials
 *   - TOSSINVEST_APIDOCS_PATH, TOSSINVEST_HISTORY_DIR, TOSSINVEST_BASE_URL
 */

const opencodeBin = process.env.OPENCODE_BIN || process.env.AGENT_BIN || "/opt/homebrew/bin/opencode";

type OpencodeTextEvent = {
  type: "text";
  part: { text: string };
};

function isTextEvent(value: unknown): value is OpencodeTextEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; part?: { text?: unknown } };
  return v.type === "text" && typeof v.part?.text === "string";
}

export async function runOpencodeInvestmentAgent(
  session: SessionState,
): Promise<AgentRunResult> {
  const prompt = buildPrompt(session);

  // --format json: emit one JSON event per line. We only need the last `text` event.
  // --auto:        auto-approve tools not explicitly denied.
  // --dir:         working directory for the child (where it reads the apidocs).
  // -:             read the prompt from stdin.
  const args = ["run", "--format", "json", "--auto", "--dir", process.cwd(), "-"];

  const child = spawn(opencodeBin, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TOSSINVEST_API_KEY: session.apiKey,
      TOSSINVEST_SECRET_KEY: session.secretKey,
      TOSSINVEST_APIDOCS_PATH: apiDocsPath,
      TOSSINVEST_HISTORY_DIR: historyPath,
      TOSSINVEST_BASE_URL: "https://openapi.tossinvest.com",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.stdin.write(prompt);
  child.stdin.end();

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      reject(new Error("OpenCode run timed out"));
    }, runTimeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  const safeStdout = trimForHistory(redact(stdout, session));
  const safeStderr = trimForHistory(redact(stderr, session));

  // Extract the final assistant text from the JSONL event stream.
  let rawAssistantMessage = "";
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const ev: unknown = JSON.parse(trimmed);
      if (isTextEvent(ev)) rawAssistantMessage = ev.part.text;
    } catch {
      // Ignore non-JSON lines (rare, but possible if opencode ever writes plain logs).
    }
  }

  const safeRawAssistantMessage = redact(rawAssistantMessage, session);

  if (exitCode !== 0) {
    throw new Error(
      `OpenCode run failed with exit code ${exitCode}\n${safeStderr || safeStdout}`,
    );
  }

  let recommendation;
  try {
    recommendation = parseRecommendation(safeRawAssistantMessage);
  } catch (validationError) {
    const detail = `raw text length: ${safeRawAssistantMessage.length}`;
    const preview = safeRawAssistantMessage.slice(0, 500);
    throw new Error(
      `${validationError instanceof Error ? validationError.message : "validation failed"} | ${detail} | raw preview: ${preview}`,
    );
  }

  return {
    recommendation,
    rawAssistantMessage: safeRawAssistantMessage,
    diagnostics: {
      exitCode,
      stdout: safeStdout,
      stderr: safeStderr,
    },
  };
}
