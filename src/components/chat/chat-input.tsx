"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
  placeholder = "Type your message...",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  function handleSubmit() {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-end gap-2">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="min-h-[48px] max-h-[200px] resize-none bg-card/50 border-border/40 text-base placeholder:text-muted-foreground/70 focus-visible:border-pa-cyan/40 focus-visible:ring-pa-cyan/10"
      />
      {isLoading ? (
        <Button
          size="icon"
          onClick={onStop}
          className="shrink-0 bg-pa-red/80 text-foreground hover:bg-pa-red"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="shrink-0 bg-pa-cyan text-background hover:bg-pa-cyan/90 disabled:opacity-20"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
