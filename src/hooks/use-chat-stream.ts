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
  llmCalls: Array<{
    phaseOwner: string;
    loop?: number;
    stream: boolean;
    elapsedMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
  }>;
  raw: TimingEntry[];
}

export interface TokenUsageEntry {
  phase: string;
  round?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  metadata?: Record<string, unknown>;
}

export interface TokenUsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  byPhaseOwner: Record<
    string,
    {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cachedTokens: number;
      callCount: number;
    }
  >;
  callCount: number;
  raw: TokenUsageEntry[];
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
  /** Error attached to this block (set when an `error` event occurs while
   * the block is streaming). Surfaced inline by `<PhaseBlock>` etc. */
  errorMessage?: string;
  errorCode?: string;
  elapsedMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type MessageErrorSeverity = "fatal" | "warning";

export interface MessageError {
  id: string;
  code: string;
  /** Human-readable error message (the `content` field of the protocol). */
  content: string;
  /** Which PEC stage this came from: plan / execute / check / synthesize /
   * bootstrap / transport / fatal. */
  phase?: string;
  traceback?: string;
  details?: Record<string, unknown>;
  /** Which block (by id) was active when the error happened. */
  blockId?: string;
  /** "fatal" terminates the turn; "warning" is non-blocking (e.g. memory
   * extraction failed but result still arrived). */
  severity: MessageErrorSeverity;
  /** When we received this event (ms epoch). */
  receivedAt: number;
  /** Source: agent (from Python), transport (executor / spawn), api (Next.js
   * route), client (fetch / abort). Used purely for display grouping. */
  source: "agent" | "transport" | "api" | "client";
}

export interface AgentLogLine {
  id: string;
  message: string;
  level: "info" | "warn" | "error";
  source: string;
  receivedAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  blocks?: MessageBlock[];
  timings?: TimingEntry[];
  timingSummary?: TimingSummary;
  tokens?: TokenUsageEntry[];
  tokenSummary?: TokenUsageSummary;
  /** Errors emitted during this assistant turn. Multiple errors are kept
   * (e.g. plan failed → recovered → synthesize failed). Empty / absent when
   * the turn finished cleanly. */
  errors?: MessageError[];
  /** stderr / informational logs forwarded by the executor. Bounded. */
  agentLogs?: AgentLogLine[];
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
      const timings: TimingEntry[] = [];
      const tokens: TokenUsageEntry[] = [];
      const messageErrors: MessageError[] = [];
      const agentLogs: AgentLogLine[] = [];
      const MAX_AGENT_LOGS = 200;

      function buildTokenSummary(entries: TokenUsageEntry[]): TokenUsageSummary {
        const summary: TokenUsageSummary = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cachedTokens: 0,
          byPhaseOwner: {},
          callCount: 0,
          raw: entries,
        };
        for (const t of entries) {
          if (t.phase !== "llm_call") continue;
          summary.promptTokens += t.promptTokens;
          summary.completionTokens += t.completionTokens;
          summary.totalTokens += t.totalTokens || t.promptTokens + t.completionTokens;
          summary.cachedTokens += t.cachedTokens;
          summary.callCount += 1;
          const owner = (t.metadata?.phase_owner as string) || "?";
          const slot =
            summary.byPhaseOwner[owner] ||
            (summary.byPhaseOwner[owner] = {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cachedTokens: 0,
              callCount: 0,
            });
          slot.promptTokens += t.promptTokens;
          slot.completionTokens += t.completionTokens;
          slot.totalTokens += t.totalTokens || t.promptTokens + t.completionTokens;
          slot.cachedTokens += t.cachedTokens;
          slot.callCount += 1;
        }
        return summary;
      }

      function applyTokenToBlocks(t: TokenUsageEntry) {
        if (t.phase !== "llm_call") return;
        const owner = t.metadata?.phase_owner as string | undefined;
        if (!owner) return;
        const totalTokens = t.totalTokens || t.promptTokens + t.completionTokens;
        for (let i = currentBlocks.length - 1; i >= 0; i--) {
          const b = currentBlocks[i];
          const matchPhase =
            b.type === "phase" && b.phase === owner && (t.round ? b.round === t.round : true);
          const matchSynthesize = owner === "synthesize" && b.type === "supervisor";
          if (matchPhase || matchSynthesize) {
            b.promptTokens = (b.promptTokens || 0) + t.promptTokens;
            b.completionTokens = (b.completionTokens || 0) + t.completionTokens;
            b.totalTokens = (b.totalTokens || 0) + totalTokens;
            return;
          }
        }
      }

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
        const tSummary = timings.length > 0 ? buildTimingSummary(timings) : undefined;
        const tokSummary = tokens.length > 0 ? buildTokenSummary(tokens) : undefined;

        // Cross-link: enrich each timing.llm_call with its matching token usage,
        // so TimingPanel can show `Plan stream 5.2s · 3.1k tok` in one row.
        if (tSummary && tokSummary && tokSummary.callCount > 0) {
          const tokenIter = [...tokens].filter((t) => t.phase === "llm_call");
          tSummary.llmCalls.forEach((call) => {
            const idx = tokenIter.findIndex(
              (t) =>
                (t.metadata?.phase_owner as string | undefined) === call.phaseOwner &&
                (t.metadata?.loop as number | undefined) === call.loop &&
                !!t.metadata?.stream === call.stream,
            );
            if (idx >= 0) {
              const tok = tokenIter.splice(idx, 1)[0];
              call.promptTokens = tok.promptTokens;
              call.completionTokens = tok.completionTokens;
              call.totalTokens = tok.totalTokens || tok.promptTokens + tok.completionTokens;
              call.cachedTokens = tok.cachedTokens;
            }
          });
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: fullContent,
                  blocks: [...currentBlocks],
                  timings: timings.length > 0 ? [...timings] : undefined,
                  timingSummary: tSummary,
                  tokens: tokens.length > 0 ? [...tokens] : undefined,
                  tokenSummary: tokSummary,
                  errors: messageErrors.length > 0 ? [...messageErrors] : undefined,
                  agentLogs: agentLogs.length > 0 ? [...agentLogs] : undefined,
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
          // Try to extract a structured error message from the API response
          // body so the UI can show something meaningful instead of "HTTP 500".
          let serverMessage = "";
          let serverDetails: Record<string, unknown> | undefined;
          try {
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              const j = (await res.json()) as Record<string, unknown>;
              serverMessage = (j.error as string) || (j.message as string) || "";
              serverDetails = j;
            } else {
              serverMessage = (await res.text()).slice(0, 500);
            }
          } catch {
            // best-effort
          }
          messageErrors.push({
            id: createId("err"),
            code: `HTTP_${res.status}`,
            content: serverMessage || `HTTP ${res.status} ${res.statusText}`,
            details: serverDetails,
            severity: "fatal",
            receivedAt: Date.now(),
            source: "api",
          });
          // Make sure the error is rendered, then bail out cleanly.
          updateAssistant();
          return;
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
              } else if (chunk.type === "token_usage") {
                receivedAnyChunk = true;
                const entry: TokenUsageEntry = {
                  phase: chunk.phase || "unknown",
                  round: typeof chunk.round === "number" ? chunk.round : 0,
                  promptTokens: typeof chunk.prompt_tokens === "number" ? chunk.prompt_tokens : 0,
                  completionTokens:
                    typeof chunk.completion_tokens === "number" ? chunk.completion_tokens : 0,
                  totalTokens: typeof chunk.total_tokens === "number" ? chunk.total_tokens : 0,
                  cachedTokens: typeof chunk.cached_tokens === "number" ? chunk.cached_tokens : 0,
                  metadata: chunk.metadata,
                };
                tokens.push(entry);
                applyTokenToBlocks(entry);
                updateAssistant();
              } else if (chunk.type === "error") {
                receivedAnyChunk = true;
                const code = (chunk.code as string) || "AGENT_ERROR";
                const phase = (chunk.phase as string) || undefined;
                const transportCodes = new Set([
                  "TIMEOUT",
                  "EXIT_ERROR",
                  "SPAWN_ERROR",
                ]);
                const sourceForCode: MessageError["source"] = transportCodes.has(code)
                  ? "transport"
                  : "agent";
                const activeBlock = getActivePhaseBlock();
                const err: MessageError = {
                  id: createId("err"),
                  code,
                  content: chunk.content || "Agent returned an unknown error.",
                  phase,
                  traceback: typeof chunk.traceback === "string" ? chunk.traceback : undefined,
                  details:
                    chunk.details && typeof chunk.details === "object"
                      ? (chunk.details as Record<string, unknown>)
                      : undefined,
                  blockId: activeBlock?.id,
                  severity: "fatal",
                  receivedAt: Date.now(),
                  source: sourceForCode,
                };
                messageErrors.push(err);

                // Mark the active block as failed so the user can see
                // exactly which phase blew up — but DO NOT clear blocks or
                // content, the previous reasoning stays visible.
                if (activeBlock && activeBlock.status === "streaming") {
                  activeBlock.status = "error";
                  activeBlock.errorMessage = err.content;
                  activeBlock.errorCode = code;
                }
                updateAssistant();
              } else if (chunk.type === "agent_log") {
                // stderr line forwarded by the executor — informational, but
                // surface error-level lines into the panel by default.
                const lvl =
                  chunk.level === "error" || chunk.level === "warn" || chunk.level === "info"
                    ? chunk.level
                    : "info";
                agentLogs.push({
                  id: createId("log"),
                  message: typeof chunk.message === "string" ? chunk.message : "",
                  level: lvl,
                  source: typeof chunk.source === "string" ? chunk.source : "stderr",
                  receivedAt: Date.now(),
                });
                if (agentLogs.length > MAX_AGENT_LOGS) {
                  agentLogs.splice(0, agentLogs.length - MAX_AGENT_LOGS);
                }
                updateAssistant();
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Agent stream ended without explicit result/error content: surface a
        // visible fallback. We treat this as a non-fatal warning since the
        // request technically succeeded at the HTTP layer.
        if (messageErrors.length === 0 && (!receivedAnyChunk || !receivedVisibleContent)) {
          messageErrors.push({
            id: createId("err"),
            code: "EMPTY_STREAM",
            content: "Agent 未返回任何可见内容，可能已中断或失败，请重试。",
            severity: "fatal",
            receivedAt: Date.now(),
            source: "client",
          });
          updateAssistant();
        }
      } catch (err) {
        const isAbort = (err as Error).name === "AbortError";
        const message = err instanceof Error ? err.message : String(err);
        console.error("[chat-stream] fetch failed", {
          debugId,
          error: message,
          aborted: isAbort,
        });
        if (isAbort) {
          // User-initiated stop — note it on the message but keep blocks.
          messageErrors.push({
            id: createId("err"),
            code: "USER_ABORT",
            content: "已停止生成。",
            severity: "warning",
            receivedAt: Date.now(),
            source: "client",
          });
        } else {
          messageErrors.push({
            id: createId("err"),
            code: "NETWORK_ERROR",
            content: `请求失败：${message}`,
            details: { error: message },
            severity: "fatal",
            receivedAt: Date.now(),
            source: "client",
          });
        }
        updateAssistant();
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
