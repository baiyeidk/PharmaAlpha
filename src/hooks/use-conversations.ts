"use client";

import { useState, useEffect, useCallback } from "react";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch("/api/chat/history")
      .then((r) => r.json())
      .then((data) => {
        setConversations(Array.isArray(data) ? data : []);
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { conversations, loading, refresh };
}
