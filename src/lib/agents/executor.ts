import { spawn, type ChildProcess } from "child_process";
import path from "path";
import type { AgentInput, AgentOutputChunk } from "./types";

const AGENTS_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), "agents");

export interface ExecuteOptions {
  timeout?: number;
  pythonPath?: string;
  extraEnv?: Record<string, string>;
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
        });
        safeClose();
      }, timeout);

      proc.stdin!.setDefaultEncoding("utf8");
      proc.stdin!.write(Buffer.from(`${JSON.stringify(input)}\n`, "utf8"));
      proc.stdin!.end();

      let buffer = "";
      let stderr = "";

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
            safeEnqueue(chunk);
          } catch {
            safeEnqueue({
              type: "chunk",
              content: line,
            });
          }
        }
      });

      proc.stderr!.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
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

        if (code !== 0 && code !== null) {
          safeEnqueue({
            type: "error",
            content: stderr || `Agent exited with code ${code}`,
            code: "EXIT_ERROR",
          });
        }

        safeClose();
      });

      proc.on("error", (err) => {
        if (timer) clearTimeout(timer);
        safeEnqueue({
          type: "error",
          content: `Failed to spawn agent: ${err.message}`,
          code: "SPAWN_ERROR",
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
