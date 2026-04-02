import { spawn } from "child_process";
import path from "path";
import type { AgentInput, AgentOutputChunk } from "./types";

const AGENTS_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), "agents");

export interface ExecuteOptions {
  timeout?: number;
  pythonPath?: string;
}

export function executeAgent(
  entryPoint: string,
  input: AgentInput,
  options: ExecuteOptions = {}
): ReadableStream<AgentOutputChunk> {
  const { timeout = 120_000, pythonPath = "python3" } = options;

  const agentPath = path.isAbsolute(entryPoint)
    ? entryPoint
    : path.join(AGENTS_DIR, entryPoint);

  return new ReadableStream<AgentOutputChunk>({
    start(controller) {
      const port = process.env.PORT || "3000";
      const apiKey = process.env.AGENT_API_KEY || "pharma-agent-internal-key";

      const proc = spawn(pythonPath, ["-u", agentPath], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: AGENTS_DIR,
        env: {
          ...process.env,
          PYTHONPATH: AGENTS_DIR,
          CANVAS_API_BASE: `http://localhost:${port}/api/canvas`,
          CANVAS_API_KEY: apiKey,
        },
      });

      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        controller.enqueue({
          type: "error",
          content: `Agent timed out after ${timeout}ms`,
          code: "TIMEOUT",
        });
        controller.close();
      }, timeout);

      proc.stdin.write(JSON.stringify(input) + "\n");
      proc.stdin.end();

      let buffer = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk: AgentOutputChunk = JSON.parse(line);
            controller.enqueue(chunk);
          } catch {
            controller.enqueue({
              type: "chunk",
              content: line,
            });
          }
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);

        if (buffer.trim()) {
          try {
            controller.enqueue(JSON.parse(buffer));
          } catch {
            controller.enqueue({ type: "chunk", content: buffer });
          }
        }

        if (code !== 0 && code !== null) {
          controller.enqueue({
            type: "error",
            content: stderr || `Agent exited with code ${code}`,
            code: "EXIT_ERROR",
          });
        }

        controller.close();
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        controller.enqueue({
          type: "error",
          content: `Failed to spawn agent: ${err.message}`,
          code: "SPAWN_ERROR",
        });
        controller.close();
      });
    },
  });
}
