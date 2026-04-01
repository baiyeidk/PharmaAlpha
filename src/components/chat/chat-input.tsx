"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isLoading = false,
  disabled = false,
  placeholder = "输入您想分析的公司或问题…",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  function handleSubmit() {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-center h-14 border-t border-neutral-200 bg-white">
      <div className="flex items-center gap-1.5 px-3 text-scrub shrink-0">
        <ChevronRight className="h-5 w-5" />
        <span className="text-sm tracking-widest text-neutral-900 font-mono">输入</span>
      </div>
      <div className="h-full w-px bg-neutral-200" />
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 h-full bg-transparent px-3 text-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:opacity-40"
      />
      <div className="h-full w-px bg-neutral-200" />
      {isLoading ? (
        <Button
          size="icon"
          variant="ghost"
          onClick={onStop}
          className="h-14 w-14 rounded-none text-vitals-red hover:bg-vitals-red/10 hover:text-vitals-red"
        >
          <Square className="h-6 w-6" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="h-14 w-14 rounded-none text-scrub hover:bg-scrub/10 hover:text-scrub disabled:opacity-20"
        >
          <Send className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
