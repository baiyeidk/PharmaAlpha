"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

interface UseChatStreamOptions {
  agentId: string;
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
  onToolCall?: (name: string, metadata: Record<string, unknown>) => void;
  onStreamEnd?: () => void;
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

  useEffect(() => {
    if (!conversationId || conversationId === loadedConvRef.current) return;
    loadedConvRef.current = conversationId;

    fetch(`/api/chat/history?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
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
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      abortRef.current = new AbortController();

      try {
        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, messages: allMessages, conversationId }),
          signal: abortRef.current.signal,
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
                if (chunk.metadata?.tool && onToolCall) {
                  onToolCall(chunk.name || chunk.metadata.tool as string, chunk.metadata);
                }
                if (chunk.content) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: m.content + chunk.content }
                        : m
                    )
                  );
                }
              } else if (chunk.type === "chunk" || chunk.type === "result") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: m.content + (chunk.content || "") }
                      : m
                  )
                );
              } else if (chunk.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: `Error: ${chunk.content}`, isStreaming: false }
                      : m
                  )
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: "Failed to get response. Please try again.", isStreaming: false }
                : m
            )
          );
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
          )
        );
        setIsLoading(false);
        abortRef.current = null;
        onStreamEnd?.();
      }
    },
    [agentId, conversationId, messages, isLoading, onConversationCreated, onToolCall, onStreamEnd]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, stopGeneration, clearMessages, setMessages };
}
