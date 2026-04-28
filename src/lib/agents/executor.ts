import { spawn, type ChildProcess } from "child_process";
import path from "path";
import type { AgentInput, AgentOutputChunk } from "./types";

const AGENTS_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), "agents");

export interface ExecuteOptions {
  timeout?: number;
  pythonPath?: string;
  extraEnv?: Record<string, string>;
}

// stderr lines that look like the agent's own [HH:MM:SS] info logger output;
// they are forwarded to the UI as `agent_log` (level=info), not treated as
// errors, and not accumulated as part of any traceback.
const INFO_LOG_LINE_RE = /^\[\d{2}:\d{2}:\d{2}\]\s/;

const TRACEBACK_TAIL_LIMIT = 8000; // chars of stderr we keep in EXIT_ERROR.traceback
const STDERR_LOG_FORWARD_LIMIT = 2000; // chars per forwarded agent_log message

function classifyStderrLine(line: string): "info" | "warn" | "error" {
  if (INFO_LOG_LINE_RE.test(line)) return "info";
  const lower = line.toLowerCase();
  if (lower.includes("traceback") || lower.includes("error") || lower.includes("exception")) {
    return "error";
  }
  if (lower.includes("warn")) return "warn";
  return "info";
}

export function executeAgent(
  entryPoint: string,
  input: AgentInput,
  options: ExecuteOptions = {}
): ReadableStream<AgentOutputChunk> {
  const defaultPythonPath =
    process.env.PYTHON_PATH ||
    (process.platform === "win32" ? "python" : "python3");
  const { timeout = 600_000, pythonPath = defaultPythonPath, extraEnv = {} } = options;

  const agentPath = path.isAbsolute(entryPoint)
    ? entryPoint
    : path.join(AGENTS_DIR, entryPoint);

  let proc: ChildProcess | null = null;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function killProc() {
    if (proc && !proc.killed) {
      proc.kill("SIGTERM");
    }
  }

  return new ReadableStream<AgentOutputChunk>({
    start(controller) {
      function safeClose() {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed by consumer */ }
      }
      function safeEnqueue(chunk: AgentOutputChunk) {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
          killProc();
        }
      }

      const port = process.env.PORT || "3000";
      const apiKey = process.env.AGENT_API_KEY || "pharma-agent-internal-key";

      proc = spawn(pythonPath, ["-u", agentPath], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: AGENTS_DIR,
        env: {
          ...process.env,
          PYTHONPATH: AGENTS_DIR,
          CANVAS_API_BASE: `http://localhost:${port}/api/canvas`,
          CANVAS_API_KEY: apiKey,
          PLATFORM_API_BASE: `http://localhost:${port}/api`,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          ...extraEnv,
        },
      });

      timer = setTimeout(() => {
        killProc();
        safeEnqueue({
          type: "error",
          content: `Agent timed out after ${timeout}ms`,
          code: "TIMEOUT",
          phase: "transport",
          details: { timeoutMs: timeout, entryPoint },
        });
        safeClose();
      }, timeout);

      proc.stdin!.setDefaultEncoding("utf8");
      proc.stdin!.write(Buffer.from(`${JSON.stringify(input)}\n`, "utf8"));
      proc.stdin!.end();

      let buffer = "";
      // We keep the full stderr (capped) so EXIT_ERROR can carry it as
      // `traceback`, but also stream non-trivial lines as agent_log events
      // so the UI can show them live without waiting for process exit.
      let stderr = "";
      let lastLineWasError = false;
      let stderrBuffer = "";
      // Track whether the agent already emitted a structured error event so
      // we don't pile a duplicate EXIT_ERROR on top.
      let agentEmittedError = false;

      proc.stdout!.on("data", (data: Buffer) => {
        if (closed) return;
        buffer += data.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (closed) break;
          if (!line.trim()) continue;
          try {
            const chunk: AgentOutputChunk = JSON.parse(line);
            if (chunk.type === "error") {
              agentEmittedError = true;
            }
            safeEnqueue(chunk);
          } catch {
            // Non-JSON line on stdout — wrap as a plain chunk so it isn't
            // silently lost.
            safeEnqueue({
              type: "chunk",
              content: line,
            });
          }
        }
      });

      proc.stderr!.on("data", (data: Buffer) => {
        const text = data.toString("utf8");
        if (stderr.length < TRACEBACK_TAIL_LIMIT * 2) {
          stderr += text;
        }
        if (closed) return;

        stderrBuffer += text;
        const lines = stderrBuffer.split("\n");
        stderrBuffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.replace(/\r$/, "");
          if (!line.trim()) {
            // Blank lines may end a multiline traceback group.
            lastLineWasError = false;
            continue;
          }

          const level = classifyStderrLine(line);
          // Heuristic: indented lines following an error line are part of a
          // traceback — keep marking them as "error" for the UI to group.
          if (lastLineWasError && /^\s/.test(rawLine)) {
            lastLineWasError = true;
            safeEnqueue({
              type: "agent_log",
              message: line.slice(0, STDERR_LOG_FORWARD_LIMIT),
              level: "error",
              source: "stderr",
            });
            continue;
          }

          lastLineWasError = level === "error";
          safeEnqueue({
            type: "agent_log",
            message: line.slice(0, STDERR_LOG_FORWARD_LIMIT),
            level,
            source: "stderr",
          });
        }
      });

      proc.on("close", (code) => {
        if (timer) clearTimeout(timer);

        if (buffer.trim()) {
          try {
            safeEnqueue(JSON.parse(buffer));
          } catch {
            safeEnqueue({ type: "chunk", content: buffer });
          }
        }

        // Flush any unterminated stderr line.
        if (stderrBuffer.trim()) {
          safeEnqueue({
            type: "agent_log",
            message: stderrBuffer.slice(0, STDERR_LOG_FORWARD_LIMIT),
            level: classifyStderrLine(stderrBuffer),
            source: "stderr",
          });
          stderrBuffer = "";
        }

        if (code !== 0 && code !== null) {
          if (agentEmittedError) {
            // The agent already surfaced its own structured error — adding
            // EXIT_ERROR on top is duplicative noise. Skip.
          } else {
            // Strip the chatty [HH:MM:SS] info-log prefix when surfacing the
            // failure so the message stays readable; keep the full stream as
            // `traceback` for diagnostics.
            const errorOnly = stderr
              .split("\n")
              .filter((l) => l.trim() && !INFO_LOG_LINE_RE.test(l))
              .join("\n");
            const summary = (errorOnly || stderr).trim().split("\n").slice(-3).join(" | ")
              || `Agent exited with code ${code}`;

            safeEnqueue({
              type: "error",
              content: `Agent exited (code ${code}): ${summary.slice(0, 500)}`,
              code: "EXIT_ERROR",
              phase: "transport",
              traceback: stderr.slice(-TRACEBACK_TAIL_LIMIT),
              details: {
                exitCode: code,
                entryPoint,
                stderrChars: stderr.length,
              },
            });
          }
        }

        safeClose();
      });

      proc.on("error", (err) => {
        if (timer) clearTimeout(timer);
        const errno = (err as NodeJS.ErrnoException).code;
        safeEnqueue({
          type: "error",
          content: `Failed to spawn agent: ${err.message}`,
          code: "SPAWN_ERROR",
          phase: "transport",
          details: { errno, entryPoint, pythonPath },
        });
        safeClose();
      });
    },

    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
      killProc();
    },
  });
}
