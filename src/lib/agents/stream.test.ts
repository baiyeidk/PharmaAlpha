import { describe, expect, it } from "vitest";
import { sseEncoder, sseHeaders } from "./stream";
import type { AgentOutputChunk } from "./types";

async function collectSse(chunks: AgentOutputChunk[]): Promise<string> {
  const readable = new ReadableStream<AgentOutputChunk>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });

  const encoded = readable.pipeThrough(sseEncoder());
  const reader = encoded.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

describe("sseEncoder", () => {
  it("emits one `data: …\\n\\n` frame per chunk", async () => {
    const sse = await collectSse([
      { type: "chunk", content: "hello" },
      { type: "chunk", content: "world" },
    ]);
    const frames = sse.split("\n\n").filter(Boolean);
    expect(frames.length).toBe(3); // 2 chunks + [DONE]
    expect(frames[0]).toBe(`data: ${JSON.stringify({ type: "chunk", content: "hello" })}`);
    expect(frames[1]).toBe(`data: ${JSON.stringify({ type: "chunk", content: "world" })}`);
  });

  it("appends `data: [DONE]\\n\\n` on flush", async () => {
    const sse = await collectSse([{ type: "result", content: "ok" }]);
    expect(sse.endsWith("data: [DONE]\n\n")).toBe(true);
  });

  it("handles an empty stream by emitting only [DONE]", async () => {
    const sse = await collectSse([]);
    expect(sse).toBe("data: [DONE]\n\n");
  });

  it("preserves complex payloads exactly", async () => {
    const chunk: AgentOutputChunk = {
      type: "tool_call",
      name: "canvas_add_chart",
      args: { ticker: "600276", interval: "1d" },
    };
    const sse = await collectSse([chunk]);
    expect(sse.startsWith(`data: ${JSON.stringify(chunk)}\n\n`)).toBe(true);
  });
});

describe("sseHeaders", () => {
  it("disables intermediate buffering and caching", () => {
    const h = sseHeaders() as Record<string, string>;
    expect(h["Content-Type"]).toBe("text/event-stream");
    expect(h["Cache-Control"]).toContain("no-cache");
    expect(h["Cache-Control"]).toContain("no-transform");
    expect(h["X-Accel-Buffering"]).toBe("no");
    expect(h["Connection"]).toBe("keep-alive");
  });
});
