"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, PanelRightOpen, PanelRightClose } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ViewportPanel } from "./viewport-panel";
import { WelcomeDashboard } from "./welcome-dashboard";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useAgents } from "@/hooks/use-agents";
import { useViewportStore } from "@/stores/viewport-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PHARMA_TICKERS = new Set([
  "PFE","JNJ","MRK","ABBV","LLY","BMY","AMGN","GILD","AZN","NVO",
  "SNY","GSK","REGN","VRTX","BIIB","MRNA","BNTX","ZTS","BAX","BDX",
  "MDT","ABT","TMO","DHR","SYK","ISRG","BSX","EW","HCA","UNH",
]);

function extractTickers(text: string): string[] {
  const words = text.match(/\b[A-Z]{2,5}\b/g) || [];
  return [...new Set(words.filter((w) => PHARMA_TICKERS.has(w)))];
}

function AgentSelect({
  agents,
  value,
  onChange,
}: {
  agents: { id: string; name: string; displayName: string | null }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => { if (v) onChange(v); }}>
      <SelectTrigger className="w-[200px] h-9 bg-card/50 border-border/40 text-sm font-mono">
        <SelectValue placeholder="Select agent" />
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id} className="text-sm font-mono">
            <div className="flex items-center gap-2">
              <Bot className="h-3 w-3 text-pa-cyan" />
              {agent.displayName || agent.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ChatViewProps {
  conversationId?: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const { agents, loading: agentsLoading } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const { isOpen: viewportOpen, togglePanel, pushItem } = useViewportStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCheckedRef = useRef<string>("");

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const { messages, isLoading, sendMessage, stopGeneration } = useChatStream({
    agentId: selectedAgentId,
    conversationId,
    onConversationCreated: (id) => {
      window.history.replaceState(null, "", `/chat/${id}`);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && !m.isStreaming && m.content);

    if (!lastAssistant || lastAssistant.id === lastCheckedRef.current) return;
    lastCheckedRef.current = lastAssistant.id;

    const tickers = extractTickers(lastAssistant.content);
    if (tickers.length > 0) {
      pushItem({
        type: "chart",
        title: `${tickers.slice(0, 3).join(", ")} Analysis`,
        metadata: {
          description: `Mentioned tickers: ${tickers.join(", ")}`,
          tickers,
        },
      });
    }
  }, [messages, pushItem]);

  const noAgent = !agentsLoading && agents.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b border-border/40 px-4">
        <div className="flex items-center gap-3">
          {agents.length > 0 && (
            <AgentSelect
              agents={agents}
              value={selectedAgentId}
              onChange={setSelectedAgentId}
            />
          )}
          {selectedAgentId && (
            <div className="flex items-center gap-1.5 font-mono text-xs text-pa-green">
              <div className="h-1.5 w-1.5 rounded-full bg-pa-green animate-pulse" />
              READY
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePanel}
          className={cn(
            "h-8 gap-1.5 px-2.5 font-mono text-xs uppercase tracking-wider",
            viewportOpen
              ? "text-pa-amber"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {viewportOpen ? (
            <PanelRightClose className="h-3.5 w-3.5" />
          ) : (
            <PanelRightOpen className="h-3.5 w-3.5" />
          )}
          Viewport
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            "flex min-w-0 flex-col",
            viewportOpen ? "w-[55%]" : "flex-1"
          )}
        >
          <ScrollArea className="flex-1" ref={scrollRef}>
            {messages.length === 0 ? (
              <WelcomeDashboard
                onSendPrompt={sendMessage}
                disabled={!selectedAgentId || noAgent}
              />
            ) : (
              <div
                className={cn(
                  "py-4",
                  viewportOpen ? "px-2" : "mx-auto max-w-3xl"
                )}
              >
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    isStreaming={msg.isStreaming}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <div
            className={cn(
              "border-t border-border/40 p-4",
              !viewportOpen && "mx-auto w-full max-w-3xl"
            )}
          >
            <ChatInput
              onSend={sendMessage}
              onStop={stopGeneration}
              isLoading={isLoading}
              disabled={!selectedAgentId || noAgent}
            />
          </div>
        </div>

        {viewportOpen && (
          <div className="w-[45%] border-l border-border/40">
            <ViewportPanel />
          </div>
        )}
      </div>
    </div>
  );
}
