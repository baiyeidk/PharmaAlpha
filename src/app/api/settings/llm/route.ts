import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
    getUserLlmSetting,
    resolveLlmConfigForUser,
    saveUserLlmSetting,
} from "@/lib/llm-user-settings";

function maskKey(value: string | null): string | null {
    if (!value) return null;
    if (value.length <= 8) return "*".repeat(value.length);
    return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

export async function GET() {
    const session = await getSession();
    if (!session?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [stored, effective] = await Promise.all([
        getUserLlmSetting(session.id),
        resolveLlmConfigForUser(session.id),
    ]);

    return NextResponse.json({
        stored: {
            hasApiKey: !!stored.apiKey,
            apiKeyMasked: maskKey(stored.apiKey),
            model: stored.model,
            baseUrl: stored.baseUrl,
            updatedAt: stored.updatedAt,
        },
        effective: {
            hasApiKey: !!effective.apiKey,
            model: effective.model,
            baseUrl: effective.baseUrl,
            source: effective.source,
        },
    });
}

export async function PUT(req: Request) {
    const session = await getSession();
    if (!session?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const clearApiKey = !!body?.clearApiKey;

    const apiKeyInput = typeof body?.apiKey === "string" ? body.apiKey : undefined;
    const modelInput = typeof body?.model === "string" ? body.model : undefined;
    const baseUrlInput = typeof body?.baseUrl === "string" ? body.baseUrl : undefined;

    const apiKey = clearApiKey ? "" : apiKeyInput;

    await saveUserLlmSetting(session.id, {
        apiKey,
        model: modelInput,
        baseUrl: baseUrlInput,
    });

    const [stored, effective] = await Promise.all([
        getUserLlmSetting(session.id),
        resolveLlmConfigForUser(session.id),
    ]);

    return NextResponse.json({
        stored: {
            hasApiKey: !!stored.apiKey,
            apiKeyMasked: maskKey(stored.apiKey),
            model: stored.model,
            baseUrl: stored.baseUrl,
            updatedAt: stored.updatedAt,
        },
        effective: {
            hasApiKey: !!effective.apiKey,
            model: effective.model,
            baseUrl: effective.baseUrl,
            source: effective.source,
        },
    });
}
