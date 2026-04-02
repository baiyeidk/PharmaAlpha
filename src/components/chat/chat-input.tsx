"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";

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
    <div className="flex items-center h-10 rounded-xl bg-black/[0.03] border border-black/[0.06] px-1">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 h-full bg-transparent px-3 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none disabled:opacity-40"
      />
      {isLoading ? (
        <button
          onClick={onStop}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-vitals-red hover:bg-vitals-red/10 transition-colors shrink-0"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-scrub text-white hover:bg-scrub/90 transition-colors disabled:opacity-20 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
