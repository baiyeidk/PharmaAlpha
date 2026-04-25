"use client";

import { useState, useRef, useEffect } from "react";
import { Square } from "lucide-react";

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
  placeholder = "Type a command...",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = !disabled && !isLoading && !!input.trim();

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    onSend(input);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center h-10 rounded-lg bg-term-bg-surface border border-border font-mono text-sm"
    >
      <span className="pl-3 pr-1 text-term-green select-none shrink-0 text-xs">
        user@pha:~$
      </span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 h-full bg-transparent px-1 text-sm text-[var(--nf-text-input)] caret-[var(--nf-accent)] placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-40 font-mono"
      />
      {!isLoading && !input && (
        <span className="text-term-green cursor-blink mr-2">█</span>
      )}
      {isLoading ? (
        <button
          type="button"
          onClick={onStop}
          className="flex h-7 w-7 items-center justify-center rounded-md text-term-red hover:bg-term-red/10 transition-colors shrink-0 mr-1"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      ) : (
        input.trim() && (
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-6 px-2 items-center justify-center rounded-md bg-term-green/15 text-term-green text-xs hover:bg-term-green/25 transition-colors disabled:opacity-20 shrink-0 mr-1 font-mono glow-subtle"
          >
            ↵
          </button>
        )
      )}
    </form>
  );
}
