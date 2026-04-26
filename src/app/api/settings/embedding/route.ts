import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
    getUserEmbeddingSetting,
    resolveEmbeddingConfigForUser,
    saveUserEmbeddingSetting,
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
        getUserEmbeddingSetting(session.id),
        resolveEmbeddingConfigForUser(session.id),
    ]);

    return NextResponse.json({
        stored: {
            hasApiKey: !!stored.apiKey,
            apiKeyMasked: maskKey(stored.apiKey),
            provider: stored.provider,
            model: stored.model,
            baseUrl: stored.baseUrl,
            dimensions: stored.dimensions,
            updatedAt: stored.updatedAt,
        },
        effective: {
            hasApiKey: !!effective.apiKey,
            provider: effective.provider,
            model: effective.model,
            baseUrl: effective.baseUrl,
            dimensions: effective.dimensions,
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
    const providerInput = typeof body?.provider === "string" ? body.provider : undefined;
    const modelInput = typeof body?.model === "string" ? body.model : undefined;
    const baseUrlInput = typeof body?.baseUrl === "string" ? body.baseUrl : undefined;
    const dimensionsInput = typeof body?.dimensions === "number"
        ? body.dimensions
        : typeof body?.dimensions === "string" && body.dimensions.trim()
            ? Number(body.dimensions)
            : undefined;

    const apiKey = clearApiKey ? "" : apiKeyInput;

    await saveUserEmbeddingSetting(session.id, {
        apiKey,
        provider: providerInput,
        model: modelInput,
        baseUrl: baseUrlInput,
        dimensions: Number.isFinite(dimensionsInput as number) ? (dimensionsInput as number) : null,
    });

    const [stored, effective] = await Promise.all([
        getUserEmbeddingSetting(session.id),
        resolveEmbeddingConfigForUser(session.id),
    ]);

    return NextResponse.json({
        stored: {
            hasApiKey: !!stored.apiKey,
            apiKeyMasked: maskKey(stored.apiKey),
            provider: stored.provider,
            model: stored.model,
            baseUrl: stored.baseUrl,
            dimensions: stored.dimensions,
            updatedAt: stored.updatedAt,
        },
        effective: {
            hasApiKey: !!effective.apiKey,
            provider: effective.provider,
            model: effective.model,
            baseUrl: effective.baseUrl,
            dimensions: effective.dimensions,
            source: effective.source,
        },
    });
}

