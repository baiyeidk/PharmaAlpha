"use client";

import { useState, useEffect } from "react";

export interface Agent {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  enabled: boolean;
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/agents")
      .then(async (r) => {
        if (!r.ok) {
          let detail = `HTTP ${r.status}`;
          try {
            const json = await r.json();
            if (json?.error) detail = `${detail}: ${json.error}`;
          } catch {
            // ignore json parse error
          }
          throw new Error(detail);
        }
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        setAgents(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setAgents([]);
        setError(err instanceof Error ? err.message : "Failed to load agents");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { agents, loading, error };
}
