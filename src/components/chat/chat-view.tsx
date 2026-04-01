"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Activity, Scan, Clock } from "lucide-react";
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

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-1 overflow-hidden">

        {/* 左侧：分析对话 */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-neutral-200">
          {/* 头部 */}
          <div className="flex h-11 items-center justify-between border-b border-neutral-200 px-3 font-mono text-sm tracking-widest bg-white text-neutral-900">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-neutral-900">
                <Activity className="h-5 w-5" />
                分析面板
              </div>
              {selectedAgentId && (
                <span className="text-scrub flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-scrub animate-pulse" />
                  在线
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {agents.length > 0 && (
                <Select value={selectedAgentId} onValueChange={(v) => { if (v) setSelectedAgentId(v); }}>
                  <SelectTrigger className="h-8 w-[200px] border-neutral-200 bg-white text-sm font-mono tracking-wider rounded-sm px-1.5 py-0 text-neutral-900">
                    <SelectValue placeholder="选择智能体" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm bg-white border-neutral-200">
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id} className="font-mono text-sm text-neutral-900">
                        <div className="flex items-center gap-1.5">
                          <Bot className="h-5 w-5 text-scrub" />
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
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors text-sm text-neutral-900",
                  showCases ? "text-scrub bg-scrub/10" : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                <Clock className="h-5 w-5" />
                历史
              </button>
            </div>
          </div>

          {/* 历史记录抽屉 */}
          {showCases && conversations.length > 0 && (
            <div className="border-b border-neutral-200 bg-neutral-50 max-h-32 overflow-y-auto">
              {conversations.slice(0, 10).map((c) => (
                <a
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-white transition-colors border-b border-neutral-200/80 last:border-0"
                >
                  <span className="text-neutral-500">{timeAgo(c.updatedAt)}</span>
                  <span className="truncate text-neutral-800">{c.title}</span>
                </a>
              ))}
            </div>
          )}

          {/* 对话内容 */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            {messages.length === 0 ? (
              <WelcomeDashboard onSendPrompt={sendMessage} disabled={!selectedAgentId || noAgent} />
            ) : (
              <div>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} content={msg.content} isStreaming={msg.isStreaming} />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* 输入栏 */}
          <ChatInput
            onSend={sendMessage}
            onStop={stopGeneration}
            isLoading={isLoading}
            disabled={!selectedAgentId || noAgent}
          />
        </div>

        {/* 右侧：诊断视窗 */}
        <div className="hidden w-[42%] shrink-0 lg:flex flex-col">
          <div className="flex h-11 items-center gap-2 border-b border-neutral-200 px-3 font-mono text-sm tracking-widest bg-white text-neutral-900">
            <Scan className="h-5 w-5 text-plasma" />
            <span className="text-plasma">诊断视窗</span>
          </div>
          <div className="flex-1 overflow-hidden bg-white">
            <ViewportPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
