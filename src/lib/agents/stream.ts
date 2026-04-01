import type { AgentOutputChunk } from "./types";

/**
 * Encode AgentOutputChunks into SSE (Server-Sent Events) format.
 */
export function sseEncoder(): TransformStream<AgentOutputChunk, Uint8Array> {
  const encoder = new TextEncoder();

  return new TransformStream({
    transform(chunk, controller) {
      const data = JSON.stringify(chunk);
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    },
    flush(controller) {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    },
  });
}

/**
 * Create SSE Response headers.
 */
export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
