"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createId } from "@/lib/utils";

export interface ToolEvent {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: "running" | "success" | "error";
  result?: string;
  elapsedMs?: number;
}

export interface TimingEntry {
  phase: string;
  round?: number;
  elapsedMs: number;
  metadata?: Record<string, unknown>;
  receivedAt: number;
}

export interface TimingSummary {
  totalMs: number;
  byPhase: Record<string, number>;
  perRoundExecuteMs: number[];
  toolCalls: Array<{ name: string; elapsedMs: number; phaseOwner?: string; success?: boolean }>;
  llmCalls: Array<{ phaseOwner: string; loop?: number; stream: boolean; elapsedMs: number }>;
  raw: TimingEntry[];
}

export interface MessageBlock {
  id: string;
  type: "supervisor" | "sub_agent" | "phase";
  agentName?: string;
  task?: string;
  phase?: string;
  round?: number;
  content: string;
  toolEvents: ToolEvent[];
  planSteps?: Array<Record<string, unknown>>;
  checkResult?: { passed: boolean; summary: string; gaps?: string[] };
  status: "streaming" | "done" | "error";
  elapsedMs?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  blocks?: MessageBlock[];
  timings?: TimingEntry[];
  timingSummary?: TimingSummary;
}

interface UseChatStreamOptions {
  agentId: string;
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
  onToolCall?: (name: string, metadata: Record<string, unknown>) => void;
  onStreamEnd?: () => void;
}

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  pharma_analyst: "医药分析师",
  stock_analyst: "股票分析师",
  investment_advisor: "投资策略顾问",
  supervisor_agent: "协调者",
};

const PHASE_DISPLAY_NAMES: Record<string, string> = {
  plan: "规划中",
  execute: "执行中",
  check: "审查中",
  synthesize: "合成报告",
};

export function getPhaseDisplayName(phase: string, round?: number): string {
  const name = PHASE_DISPLAY_NAMES[phase] || phase;
  return round && round > 1 ? `第 ${round} 轮 · ${name}` : name;
}

export function getAgentDisplayName(name: string): string {
  return AGENT_DISPLAY_NAMES[name] || name;
}

export function useChatStream({
  agentId,
  conversationId,
  onConversationCreated,
  onToolCall,
  onStreamEnd,
}: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadedConvRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (!conversationId || conversationId === loadedConvRef.current) return;
    if (isLoadingRef.current) {
      loadedConvRef.current = conversationId;
      return;
    }
    loadedConvRef.current = conversationId;

    fetch(`/api/chat/history?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (isLoadingRef.current) return;
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as ChatMessage["role"],
              content: m.content,
              isStreaming: false,
            }))
          );
        }
      })
      .catch(() => {});
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      const debugId = createId("debug");
      if (!text || isLoading) {
        console.info("[chat-stream] blocked send", {
          debugId,
          hasText: !!text,
          isLoading,
        });
        return;
      }
      if (!agentId) {
        console.warn("[chat-stream] blocked send: missing agentId", {
          debugId,
          conversationId: conversationId || "new",
        });
        setMessages((prev) => [
          ...prev,
          {
            id: createId("msg"),
            role: "assistant",
            content: "Cannot send message: no agent selected.",
            isStreaming: false,
          },
        ]);
        return;
      }

      const userMessage: ChatMessage = {
        id: createId("msg"),
        role: "user",
        content: text,
      };

      const assistantId = createId("msg");
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
        blocks: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      abortRef.current = new AbortController();

      const currentBlocks: MessageBlock[] = [];
      let activePhaseBlock: string | null = null;
      let receivedAnyChunk = false;
      let receivedVisibleContent = false;
      let streamErrorMessage: string | null = null;
      const timings: TimingEntry[] = [];

      function buildTimingSummary(entries: TimingEntry[]): TimingSummary {
        const byPhase: Record<string, number> = {};
        const perRoundExecuteMs: number[] = [];
        const toolCalls: TimingSummary["toolCalls"] = [];
        const llmCalls: TimingSummary["llmCalls"] = [];
        let totalMs = 0;

        for (const t of entries) {
          if (t.phase === "total") {
            totalMs = Math.max(totalMs, t.elapsedMs);
            continue;
          }
          if (t.phase === "execute" && typeof t.round === "number" && t.round > 0) {
            perRoundExecuteMs[t.round - 1] = t.elapsedMs;
          }
          if (t.phase === "tool_call") {
            toolCalls.push({
              name: (t.metadata?.tool_name as string) || "tool",
              elapsedMs: t.elapsedMs,
              phaseOwner: t.metadata?.phase_owner as string | undefined,
              success: t.metadata?.success as boolean | undefined,
            });
            continue;
          }
          if (t.phase === "llm_call") {
            llmCalls.push({
              phaseOwner: (t.metadata?.phase_owner as string) || "?",
              loop: t.metadata?.loop as number | undefined,
              stream: !!t.metadata?.stream,
              elapsedMs: t.elapsedMs,
            });
            continue;
          }
          byPhase[t.phase] = (byPhase[t.phase] || 0) + t.elapsedMs;
        }

        if (totalMs === 0) {
          totalMs = Object.values(byPhase).reduce((a, b) => a + b, 0);
        }
        return { totalMs, byPhase, perRoundExecuteMs, toolCalls, llmCalls, raw: entries };
      }

      function applyTimingToBlocks(t: TimingEntry) {
        const topLevelPhases = new Set([
          "plan", "execute", "check", "synthesize", "memory_recall", "rag_search",
        ]);
        if (topLevelPhases.has(t.phase)) {
          for (let i = currentBlocks.length - 1; i >= 0; i--) {
            const b = currentBlocks[i];
            if (b.type === "phase" && b.phase === t.phase && (t.round ? b.round === t.round : true)) {
              b.elapsedMs = t.elapsedMs;
              return;
            }
            if (t.phase === "synthesize" && b.type === "supervisor" && b.elapsedMs === undefined) {
              b.elapsedMs = t.elapsedMs;
              return;
            }
          }
          return;
        }
        if (t.phase === "tool_call") {
          const targetBlock = getActivePhaseBlock() || currentBlocks[currentBlocks.length - 1];
          if (!targetBlock) return;
          const toolName = t.metadata?.tool_name as string | undefined;
          const ev = [...targetBlock.toolEvents].reverse().find(
            (e) => e.name === toolName && e.elapsedMs === undefined
          );
          if (ev) ev.elapsedMs = t.elapsedMs;
        }
      }

      function getActivePhaseBlock(): MessageBlock | null {
        if (activePhaseBlock) {
          return currentBlocks.find((b) => b.id === activePhaseBlock) || null;
        }
        return null;
      }

      function getOrCreateSupervisorBlock(): string {
        const last = currentBlocks[currentBlocks.length - 1];
        if (last && last.type === "supervisor" && last.status === "streaming") {
          return last.id;
        }
        const block: MessageBlock = {
          id: createId("block"),
          type: "supervisor",
          content: "",
          toolEvents: [],
          status: "streaming",
        };
        currentBlocks.push(block);
        return block.id;
      }

      function updateAssistant() {
        const fullContent = currentBlocks
          .map((b) => b.content)
          .filter(Boolean)
          .join("");
        const summary = timings.length > 0 ? buildTimingSummary(timings) : undefined;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: fullContent,
                  blocks: [...currentBlocks],
                  timings: timings.length > 0 ? [...timings] : undefined,
                  timingSummary: summary,
                }
              : m
          )
        );
      }

      try {
        console.info("[chat-stream] fetch start", {
          debugId,
          agentId,
          conversationId: conversationId || "new",
          length: text.length,
        });
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-chat-debug-id": debugId,
          },
          body: JSON.stringify({
            agentId,
            conversationId,
            newMessage: text,
            debugId,
          }),
          signal: abortRef.current.signal,
        });
        console.info("[chat-stream] fetch response", {
          debugId,
          ok: res.ok,
          status: res.status,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let convIdNotified = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const chunk = JSON.parse(data);

              if (
                chunk.metadata?.conversationId &&
                !conversationId &&
                !convIdNotified &&
                onConversationCreated
              ) {
                convIdNotified = true;
                onConversationCreated(chunk.metadata.conversationId);
              }

              if (chunk.type === "tool_call") {
                receivedAnyChunk = true;
                if (chunk.metadata?.tool && onToolCall) {
                  onToolCall(chunk.name || chunk.metadata.tool as string, chunk.metadata);
                }
              } else if (chunk.type === "phase_start") {
                receivedAnyChunk = true;
                const phase = chunk.phase || "unknown";
                const round = chunk.round || 1;
                if (phase === "synthesize") {
                  const block: MessageBlock = {
                    id: createId("block"),
                    type: "supervisor",
                    content: "",
                    toolEvents: [],
                    status: "streaming",
                  };
                  currentBlocks.push(block);
                  activePhaseBlock = block.id;
                } else {
                  const block: MessageBlock = {
                    id: createId("block"),
                    type: "phase",
                    phase,
                    round,
                    content: "",
                    toolEvents: [],
                    status: "streaming",
                  };
                  currentBlocks.push(block);
                  activePhaseBlock = block.id;
                }
                updateAssistant();
              } else if (chunk.type === "phase_end") {
                receivedAnyChunk = true;
                const block = getActivePhaseBlock();
                if (block && block.status === "streaming") {
                  block.status = "done";
                }
                activePhaseBlock = null;
                updateAssistant();
              } else if (chunk.type === "plan") {
                receivedAnyChunk = true;
                const block = getActivePhaseBlock();
                if (block) {
                  block.planSteps = chunk.steps;
                }
                updateAssistant();
              } else if (chunk.type === "check") {
                receivedAnyChunk = true;
                const block = getActivePhaseBlock();
                if (block) {
                  block.checkResult = {
                    passed: chunk.passed ?? true,
                    summary: chunk.summary || "",
                    gaps: chunk.gaps,
                  };
                }
                updateAssistant();
              } else if (chunk.type === "chunk") {
                receivedAnyChunk = true;
                if ((chunk.content || "").trim()) receivedVisibleContent = true;
                const phaseBlock = getActivePhaseBlock();
                if (phaseBlock) {
                  phaseBlock.content += chunk.content || "";
                } else {
                  const blockId = getOrCreateSupervisorBlock();
                  const block = currentBlocks.find((b) => b.id === blockId);
                  if (block) block.content += chunk.content || "";
                }
                updateAssistant();
              } else if (chunk.type === "agent_delegate") {
                receivedAnyChunk = true;
                const prevBlock = currentBlocks[currentBlocks.length - 1];
                if (prevBlock && prevBlock.status === "streaming") {
                  prevBlock.status = "done";
                }
                const block: MessageBlock = {
                  id: createId("block"),
                  type: "sub_agent",
                  agentName: chunk.agent_name,
                  task: chunk.task,
                  content: "",
                  toolEvents: [],
                  status: "streaming",
                };
                currentBlocks.push(block);
                activePhaseBlock = block.id;
                updateAssistant();
              } else if (chunk.type === "agent_chunk") {
                receivedAnyChunk = true;
                if ((chunk.content || "").trim()) receivedVisibleContent = true;
                const block = getActivePhaseBlock()
                  || currentBlocks.find((b) => b.agentName === chunk.agent_name && b.status === "streaming");
                if (block) {
                  block.content += chunk.content || "";
                }
                updateAssistant();
              } else if (chunk.type === "tool_start") {
                receivedAnyChunk = true;
                const targetBlock = getActivePhaseBlock() || currentBlocks[currentBlocks.length - 1];
                if (targetBlock) {
                  targetBlock.toolEvents.push({
                    id: createId("tool"),
                    name: chunk.name,
                    args: chunk.args,
                    status: "running",
                  });
                }
                updateAssistant();
              } else if (chunk.type === "tool_result") {
                receivedAnyChunk = true;
                const targetBlock = getActivePhaseBlock() || currentBlocks[currentBlocks.length - 1];
                if (targetBlock) {
                  const ev = [...targetBlock.toolEvents].reverse().find((e) => e.name === chunk.name && e.status === "running");
                  if (ev) {
                    ev.status = chunk.success ? "success" : "error";
                    ev.result = chunk.result;
                  }
                }
                updateAssistant();
              } else if (chunk.type === "agent_result") {
                receivedAnyChunk = true;
                const block = currentBlocks.find(
                  (b) => b.agentName === chunk.agent_name && b.status === "streaming"
                );
                if (block) {
                  block.status = chunk.success ? "done" : "error";
                }
                activePhaseBlock = null;
                updateAssistant();
              } else if (chunk.type === "result") {
                receivedAnyChunk = true;
                if ((chunk.content || "").trim()) receivedVisibleContent = true;
                const phaseBlock = getActivePhaseBlock();
                if (phaseBlock && phaseBlock.type === "supervisor") {
                  phaseBlock.content += chunk.content || "";
                  phaseBlock.status = "done";
                } else if (chunk.content) {
                  const blockId = getOrCreateSupervisorBlock();
                  const block = currentBlocks.find((b) => b.id === blockId);
                  if (block) {
                    block.content += chunk.content;
                    block.status = "done";
                  }
                }
                currentBlocks.forEach((b) => {
                  if (b.status === "streaming") b.status = "done";
                });
                updateAssistant();
              } else if (chunk.type === "timing") {
                receivedAnyChunk = true;
                const entry: TimingEntry = {
                  phase: chunk.phase || "unknown",
                  round: typeof chunk.round === "number" ? chunk.round : 0,
                  elapsedMs: typeof chunk.elapsed_ms === "number" ? chunk.elapsed_ms : 0,
                  metadata: chunk.metadata,
                  receivedAt: Date.now(),
                };
                timings.push(entry);
                applyTimingToBlocks(entry);
                updateAssistant();
              } else if (chunk.type === "error") {
                receivedAnyChunk = true;
                streamErrorMessage = chunk.content || "Agent returned an unknown error.";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `Error: ${streamErrorMessage}`, isStreaming: false }
                      : m
                  )
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Agent stream ended without explicit result/error content:
        // provide a visible fallback so the user can perceive completion failure.
        if (!streamErrorMessage && (!receivedAnyChunk || !receivedVisibleContent)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Agent未返回有效内容，可能已中断或失败，请重试。",
                    isStreaming: false,
                  }
                : m
            )
          );
        }
      } catch (err) {
        console.error("[chat-stream] fetch failed", {
          debugId,
          error: err instanceof Error ? err.message : String(err),
        });
        if ((err as Error).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "已停止生成。", isStreaming: false }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Failed to get response. Please try again.", isStreaming: false }
                : m
            )
          );
        }
      } finally {
        console.info("[chat-stream] request finished", { debugId });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
        setIsLoading(false);
        abortRef.current = null;
        onStreamEnd?.();
      }
    },
    [agentId, conversationId, isLoading, onConversationCreated, onToolCall, onStreamEnd]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, stopGeneration, clearMessages, setMessages };
}
