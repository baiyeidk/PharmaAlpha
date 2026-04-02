"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Clock } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ViewportPanel } from "./viewport-panel";
import { WelcomeDashboard } from "./welcome-dashboard";
import { MacWindow } from "@/components/ui/mac-window";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useAgents } from "@/hooks/use-agents";
import { useViewportStore } from "@/stores/viewport-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useConversations } from "@/hooks/use-conversations";

const PHARMA_TICKERS = new Set([
  "600276","603259","300760","600436","600196","688235",
  "002007","300122","300347","000661","300015","002422",
  "300529","603392","688180","300558","002252","600216",
  "688658","300595","恒瑞医药","药明康德","迈瑞医疗","片仔癀",
  "复星医药","百济神州","华兰生物","智飞生物","泰格医药","长春高新",
]);

function extractTickers(text: string): string[] {
  const codePattern = /\b\d{6}\b/g;
  const namePattern = /(?:恒瑞医药|药明康德|迈瑞医疗|片仔癀|复星医药|百济神州|华兰生物|智飞生物|泰格医药|长春高新)/g;
  const codes = text.match(codePattern) || [];
  const names = text.match(namePattern) || [];
  return [...new Set([...codes, ...names].filter((w) => PHARMA_TICKERS.has(w)))];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

interface ChatViewProps {
  conversationId?: string;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const { agents, loading: agentsLoading } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const { pushItem } = useViewportStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCheckedRef = useRef<string>("");
  const { conversations } = useConversations();
  const [showCases, setShowCases] = useState(false);

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
        title: `${tickers.slice(0, 3).join("、")} 扫描`,
        metadata: { description: `检测到: ${tickers.join("、")}`, tickers },
      });
    }
  }, [messages, pushItem]);

  const noAgent = !agentsLoading && agents.length === 0;

  const chatTitleRight = (
    <div className="flex items-center gap-2">
      {agents.length > 0 && (
        <Select value={selectedAgentId} onValueChange={(v) => { if (v) setSelectedAgentId(v); }}>
          <SelectTrigger className="h-6 w-[140px] border-black/[0.06] bg-black/[0.03] text-[11px] rounded-md px-2 py-0 text-foreground/70">
            <SelectValue placeholder="选择智能体" />
          </SelectTrigger>
          <SelectContent className="rounded-lg bg-white/90 backdrop-blur-xl border-black/[0.08] shadow-lg">
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id} className="text-[11px] text-foreground rounded-md">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-3 w-3 text-scrub" />
                  {agent.displayName || agent.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <button
        onClick={() => setShowCases(!showCases)}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors text-[11px]",
          showCases ? "text-scrub bg-scrub/10" : "text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
        )}
      >
        <Clock className="h-3 w-3" />
        历史
      </button>
    </div>
  );

  return (
    <div className="flex h-full gap-3 p-3 pt-1">

      {/* 左侧：对话窗口 */}
      <MacWindow
        title="分析面板"
        titleRight={chatTitleRight}
        className="flex-1 min-w-0"
      >
        <div className="flex flex-col h-full">
          {/* 历史记录 */}
          {showCases && conversations.length > 0 && (
            <div className="border-b border-black/[0.04] bg-black/[0.015] max-h-28 overflow-y-auto">
              {conversations.slice(0, 10).map((c) => (
                <a
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-foreground/50 hover:text-foreground hover:bg-black/[0.02] transition-colors"
                >
                  <span className="opacity-60">{timeAgo(c.updatedAt)}</span>
                  <span className="truncate">{c.title}</span>
                </a>
              ))}
            </div>
          )}

          {/* 对话内容 */}
          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            {messages.length === 0 ? (
              <WelcomeDashboard onSendPrompt={sendMessage} disabled={!selectedAgentId || noAgent} />
            ) : (
              <div>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} content={msg.content} isStreaming={msg.isStreaming} />
                ))}
              </div>
            )}
          </div>

          {/* 输入栏 */}
          <div className="p-3 pt-0">
            <ChatInput
              onSend={sendMessage}
              onStop={stopGeneration}
              isLoading={isLoading}
              disabled={!selectedAgentId || noAgent}
            />
          </div>
        </div>
      </MacWindow>

      {/* 右侧：诊断视窗 */}
      <MacWindow
        title="诊断视窗"
        className="hidden w-[40%] shrink-0 lg:flex"
        variant="subtle"
      >
        <ViewportPanel />
      </MacWindow>
    </div>
  );
}
