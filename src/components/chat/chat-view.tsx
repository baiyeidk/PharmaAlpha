"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Clock, HeartPulse, ImageIcon, FileText, Type, Plus } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { WelcomeDashboard } from "./welcome-dashboard";
import { MacWindow } from "@/components/ui/mac-window";
import dynamic from "next/dynamic";

const InfiniteCanvas = dynamic(
  () => import("@/components/canvas/infinite-canvas").then((m) => m.InfiniteCanvas),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground/60 animate-spin" /></div> },
);
import { useChatStream } from "@/hooks/use-chat-stream";
import { useAgents } from "@/hooks/use-agents";
import { useCanvasStore } from "@/stores/canvas-store";
import type { CanvasNodeType } from "@/stores/canvas-store";
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
  const { agents, loading: agentsLoading, error: agentsError } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const addNodeAndSave = useCanvasStore((s) => s.addNodeAndSave);
  const loadFromServer = useCanvasStore((s) => s.loadFromServer);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCheckedRef = useRef<string>("");
  const { conversations } = useConversations();
  const [showCases, setShowCases] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(conversationId);
  const activeConvIdRef = useRef<string | undefined>(conversationId);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const handleToolCall = useCallback(
    (name: string, metadata: Record<string, unknown>) => {
      const convId = (metadata?.conversationId as string) || activeConvIdRef.current;
      if (name.startsWith("canvas.") && convId) {
        loadFromServer(convId);
      }
    },
    [loadFromServer],
  );

  const handleStreamEnd = useCallback(() => {
    const convId = activeConvIdRef.current;
    if (convId) {
      loadFromServer(convId);
    }
  }, [loadFromServer]);

  const { messages, isLoading, sendMessage, stopGeneration } = useChatStream({
    agentId: selectedAgentId,
    conversationId: activeConvId,
    onConversationCreated: (id) => {
      activeConvIdRef.current = id;
      setActiveConvId(id);
      window.history.replaceState(null, "", `/chat/${id}`);
    },
    onToolCall: handleToolCall,
    onStreamEnd: handleStreamEnd,
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
    if (tickers.length > 0 && activeConvId) {
      addNodeAndSave({
        type: "chart",
        label: `${tickers.slice(0, 3).join("、")} 扫描`,
        data: {
          description: `检测到: ${tickers.join("、")}`,
          tickers,
        },
      });
    }
  }, [messages, addNodeAndSave, activeConvId]);

  const noAgent = !agentsLoading && agents.length === 0;
  const inputDisabled = !selectedAgentId || noAgent;
  const inputPlaceholder = agentsLoading
    ? "Loading agents..."
    : agentsError
      ? `Agent load failed: ${agentsError}`
      : noAgent
        ? "No available agents. Please check login/session."
        : "Type a command...";
  const showCanvas = !!activeConvId;

  const chatTitleRight = (
    <div className="flex items-center gap-2">
      {agents.length > 0 && (
        <Select value={selectedAgentId} onValueChange={(v) => { if (v) setSelectedAgentId(v); }}>
          <SelectTrigger className="h-6 w-[140px] border-border bg-term-bg-surface text-[11px] rounded-md px-2 py-0 text-muted-foreground font-mono">
            <SelectValue placeholder="Select agent" />
          </SelectTrigger>
          <SelectContent className="rounded-lg bg-term-bg-raised/95 backdrop-blur-xl border-term-green/12 shadow-lg">
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id} className="text-[11px] text-term-green font-mono rounded-md">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-3 w-3 text-term-green" />
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
          "flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors text-[11px] font-mono",
          showCases ? "text-term-green bg-term-green/10" : "text-muted-foreground hover:text-foreground hover:bg-term-bg-surface"
        )}
      >
        <Clock className="h-3 w-3" />
        History
      </button>
    </div>
  );

  const [splitPercent, setSplitPercent] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = Math.min(80, Math.max(20, (x / rect.width) * 100));
      setSplitPercent(pct);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div ref={containerRef} className="flex h-full gap-0 p-3 pt-1">

      {/* 左侧：对话窗口 */}
      <MacWindow
        title="分析面板"
        titleRight={chatTitleRight}
        className={showCanvas ? "min-w-0 shrink-0" : "flex-1 min-w-0 max-w-4xl mx-auto"}
        style={showCanvas ? { width: `calc(${splitPercent}% - 6px)` } : undefined}
      >
        <div className="flex flex-col h-full">
          {showCases && conversations.length > 0 && (
            <div className="border-b border-term-green/8 bg-term-bg/50 max-h-28 overflow-y-auto font-mono">
              {conversations.slice(0, 10).map((c) => (
                <a
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-term-bg-surface transition-colors"
                >
                  <span className="opacity-60">{timeAgo(c.updatedAt)}</span>
                  <span className="truncate">{c.title}</span>
                </a>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            {messages.length === 0 ? (
              <WelcomeDashboard onSendPrompt={sendMessage} disabled={!selectedAgentId || noAgent} />
            ) : (
              <div>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} content={msg.content} isStreaming={msg.isStreaming} blocks={msg.blocks} />
                ))}
              </div>
            )}
          </div>

          <div className="p-3 pt-0">
            {agentsError && (
              <div className="mb-2 rounded-md border border-term-red/20 bg-term-red/5 px-3 py-2 text-xs font-mono text-term-red">
                Agent list failed to load: {agentsError}
              </div>
            )}
            <ChatInput
              onSend={sendMessage}
              onStop={stopGeneration}
              isLoading={isLoading}
              disabled={inputDisabled}
              placeholder={inputPlaceholder}
            />
          </div>
        </div>
      </MacWindow>

      {/* 可拖拽的分割条 */}
      {showCanvas && (
        <div
          onMouseDown={handleDividerMouseDown}
          className="w-3 shrink-0 flex items-center justify-center cursor-col-resize group z-10"
        >
          <div className="w-[3px] h-10 rounded-full bg-term-green/10 group-hover:bg-term-green/30 group-active:bg-term-green/50 transition-colors" />
        </div>
      )}

      {/* 右侧：无限画布 */}
      {showCanvas && (
        <MacWindow
          title="分析画布"
          titleRight={<CanvasToolbar />}
          className="hidden min-w-0 lg:flex"
          style={{ width: `calc(${100 - splitPercent}% - 6px)` }}
          variant="subtle"
        >
          <InfiniteCanvas conversationId={activeConvId!} />
        </MacWindow>
      )}
    </div>
  );
}

const addItems: { type: CanvasNodeType; icon: typeof Plus; label: string }[] = [
  { type: "chart", icon: HeartPulse, label: "股票图表" },
  { type: "image", icon: ImageIcon, label: "图片" },
  { type: "pdf", icon: FileText, label: "PDF" },
  { type: "text", icon: Type, label: "文本" },
];

function CanvasToolbar() {
  const addNode = useCanvasStore((s) => s.addNode);
  const [open, setOpen] = useState(false);

  const handleAdd = useCallback(
    (type: CanvasNodeType) => {
      const defaults: Record<CanvasNodeType, { label: string; data: Record<string, unknown> }> = {
        chart: { label: "股票图表", data: { tickers: [] } },
        image: { label: "图片", data: {} },
        pdf: { label: "PDF 文件", data: {} },
        text: { label: "文本笔记", data: { content: "" } },
      };
      const d = defaults[type];
      const currentNodes = useCanvasStore.getState().nodes;
      const maxY = currentNodes.length > 0
        ? Math.max(...currentNodes.map((n) => n.position.y + (((n.data as Record<string, unknown>).height as number) ?? 240)))
        : 0;
      const w = 340;
      const h = type === "text" ? 180 : 280;
      addNode({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "canvasCard",
        dragHandle: ".drag-handle",
        position: { x: (currentNodes.length % 2) * 360 + 20, y: maxY + 30 },
        data: { label: d.label, nodeType: type, width: w, height: h, ...d.data },
        style: { width: w, height: h },
      });
      setOpen(false);
    },
    [addNode],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-term-bg-surface transition-colors font-mono"
      >
        <Plus className="h-3 w-3" />
        Add
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg bg-term-bg-raised/95 backdrop-blur-2xl border border-term-green/12 shadow-lg p-1 font-mono">
            {addItems.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => handleAdd(type)}
                className="flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-term-bg-surface transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-term-green" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
