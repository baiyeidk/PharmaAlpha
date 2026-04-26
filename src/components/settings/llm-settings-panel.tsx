"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCcw, Save } from "lucide-react";

type LlmSettingsPayload = {
    stored: {
        hasApiKey: boolean;
        apiKeyMasked: string | null;
        model: string | null;
        baseUrl: string | null;
        updatedAt: string | null;
    };
    effective: {
        hasApiKey: boolean;
        model: string;
        baseUrl: string;
        source: {
            apiKey: "user" | "env" | "none";
            model: "user" | "env" | "none";
            baseUrl: "user" | "env" | "none";
        };
    };
};

export function LlmSettingsPanel() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [payload, setPayload] = useState<LlmSettingsPayload | null>(null);
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [clearApiKey, setClearApiKey] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/settings/llm", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as LlmSettingsPayload;
            setPayload(data);
            setModel(data.stored.model ?? "");
            setBaseUrl(data.stored.baseUrl ?? "");
            setApiKey("");
            setClearApiKey(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load settings");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function onSave() {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/settings/llm", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKey: apiKey.trim(),
                    model: model.trim(),
                    baseUrl: baseUrl.trim(),
                    clearApiKey,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as LlmSettingsPayload;
            setPayload(data);
            setApiKey("");
            setClearApiKey(false);
            setSuccess("LLM settings saved");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save settings");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="nf-card p-5 md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 nf-text-accent" />
                    <h2 className="nf-h2">LLM Config</h2>
                </div>
                <span className="nf-nano">04</span>
            </div>

            <p className="nf-sub mb-4 max-w-3xl">
                Web settings take priority over environment variables. If a field is empty, runtime falls back to env.
            </p>

            {error && (
                <div className="mb-3 rounded-[4px] border border-[rgba(217,106,94,0.3)] bg-[rgba(217,106,94,0.06)] px-3 py-2 text-[11px] nf-mono tracking-[0.03em] text-[var(--nf-danger)]">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-3 rounded-[4px] border border-[rgba(84,180,111,0.3)] bg-[rgba(84,180,111,0.08)] px-3 py-2 text-[11px] nf-mono tracking-[0.03em] text-[var(--nf-success)]">
                    {success}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <label className="nf-label" htmlFor="llm-api-key">LLM API Key</label>
                    <input
                        id="llm-api-key"
                        type="password"
                        className="nf-input nf-mono"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={payload?.stored.apiKeyMasked || "Enter a new API key"}
                        disabled={loading || saving}
                    />
                    <label className="inline-flex items-center gap-2 text-[12px] nf-text-tertiary">
                        <input
                            type="checkbox"
                            checked={clearApiKey}
                            onChange={(e) => setClearApiKey(e.target.checked)}
                            disabled={loading || saving}
                        />
                        Clear saved key
                    </label>
                </div>

                <div className="space-y-2">
                    <label className="nf-label" htmlFor="llm-model">Model</label>
                    <input
                        id="llm-model"
                        type="text"
                        className="nf-input nf-mono"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="deepseek-chat"
                        disabled={loading || saving}
                    />
                </div>

                <div className="space-y-2">
                    <label className="nf-label" htmlFor="llm-base-url">Base URL</label>
                    <input
                        id="llm-base-url"
                        type="text"
                        className="nf-input nf-mono"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.deepseek.com"
                        disabled={loading || saving}
                    />
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--nf-border-invisible)] pt-4">
                <div className="nf-nano nf-text-tertiary">
                    Effective: API Key={payload?.effective.source.apiKey ?? "-"} · Model={payload?.effective.source.model ?? "-"} · BaseURL={payload?.effective.source.baseUrl ?? "-"}
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" className="nf-btn" onClick={() => void load()} disabled={loading || saving}>
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                    <button type="button" className="nf-btn nf-btn-primary" onClick={() => void onSave()} disabled={loading || saving}>
                        <Save className="h-3.5 w-3.5" />
                        Save
                    </button>
                </div>
            </div>
        </section>
    );
}
