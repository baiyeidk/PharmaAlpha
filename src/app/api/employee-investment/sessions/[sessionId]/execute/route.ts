import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertEmployeeProjectAccess,
  invokeEmployeeInvestmentAgent,
  isProjectAccessError,
} from "@/lib/employee-investment";
import { serializeArtifact } from "@/lib/employee-investment/serializers";
import { resolveLlmConfigForUser } from "@/lib/llm-user-settings";

export const runtime = "nodejs";

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildSessionPrompt(params: {
  projectTitle: string;
  projectTopic: string;
  sessionTopic: string;
  skillName?: string | null;
  skillDescription?: string | null;
  sopName?: string | null;
  sopDescription?: string | null;
  sopConfig?: unknown;
  inputArtifacts: Array<{ title: string; content: string }>;
}) {
  const artifactSection = params.inputArtifacts.length
    ? params.inputArtifacts
      .map((artifact, index) => {
        return `### Input ${index + 1}: ${artifact.title}\n${artifact.content.slice(0, 1200)}`;
      })
      .join("\n\n")
    : "No input artifacts were selected.";

  const sopConfigSection = params.sopConfig
    ? JSON.stringify(params.sopConfig, null, 2)
    : "No structured SOP config was provided.";

  return [
    "You are an investment research team member executing a project task.",
    "Follow the assigned skill and SOP strictly. Do not produce a generic demo answer.",
    "",
    `Project: ${params.projectTitle}`,
    `Project Topic: ${params.projectTopic}`,
    `Task: ${params.sessionTopic}`,
    `Skill: ${params.skillName ?? "Project analysis"}`,
    `Skill Description: ${params.skillDescription ?? "No skill description provided."}`,
    `SOP: ${params.sopName ?? "Default project analysis SOP"}`,
    `SOP Description: ${params.sopDescription ?? "No SOP description provided."}`,
    "",
    "Structured SOP config:",
    "```json",
    sopConfigSection,
    "```",
    "",
    "Use the project artifacts as evidence and apply the SOP workflow. If required data is missing, state the missing fields and proceed with explicit assumptions instead of inventing figures.",
    "Produce a professional markdown memo in Chinese unless the input requires another language.",
    "",
    "Inputs:",
    artifactSection,
  ].join("\n");
}

function buildFallbackSessionResult(params: {
  projectTitle: string;
  sessionTopic: string;
  skillName?: string | null;
  sopName?: string | null;
  inputArtifacts: Array<{ title: string; content: string }>;
  prompt: string;
}) {
  const evidence = params.inputArtifacts.length
    ? params.inputArtifacts
      .map((artifact) => `- ${artifact.title}: ${artifact.content.slice(0, 220).replace(/\s+/g, " ")}`)
      .join("\n")
    : "- No input artifacts selected. Treat this as a first-pass project analysis.";

  return [
    `# ${params.sessionTopic} - session result`,
    "",
    "## Executive conclusion",
    `This is a demo fallback result for **${params.projectTitle}**. The selected skill session was created and executed through the project/session/artifact pipeline, but the Python agent runtime did not return a usable result during this request.`,
    "",
    "## Assigned capability",
    `- Skill: ${params.skillName ?? "Project analysis"}`,
    `- SOP: ${params.sopName ?? "Default project analysis SOP"}`,
    "",
    "## Evidence from inputs",
    evidence,
    "",
    "## Recommended next actions",
    "- Review the generated artifact and edit it if needed.",
    "- Add the artifact back to the canvas if it should become part of the project board.",
    "- Re-run the session after the agent runtime is available for a full model-generated answer.",
    "",
    "## Execution prompt used",
    "```text",
    params.prompt,
    "```",
    "",
    "## Runtime note",
    "Agent runtime was unavailable for this request. Detailed diagnostics were recorded in the execution metadata and server log.",
  ].join("\n");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeRuntimeError(error: unknown) {
  const message = getErrorMessage(error);
  if (message.includes("No module named 'psycopg'")) {
    return "Python agent dependency is missing: psycopg. Run `pip install -r agents/requirements.txt` in the project environment.";
  }
  if (message.includes("Agent timed out")) {
    return "Python agent execution timed out.";
  }
  if (message.includes("Failed to spawn agent")) {
    return "Python agent process could not be started.";
  }
  return "Python agent runtime failed. See execution metadata or server logs for diagnostics.";
}

async function completeWithProjectLlm(prompt: string, userId: string) {
  const resolved = await resolveLlmConfigForUser(userId, {
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  });
  const apiKey = resolved.apiKey;
  if (!apiKey) {
    throw new Error("LLM API key is required. Set LLM_API_KEY or DEEPSEEK_API_KEY.");
  }

  const baseUrl = resolved.baseUrl.replace(/\/$/, "");
  const model = resolved.model;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是严谨的买方医药投资研究员。必须按用户提供的 skill 和 SOP 输出，不要输出 demo 或占位内容。",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${text.slice(0, 500)}`);
    }

    const data = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: unknown;
      id?: string;
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("LLM returned an empty response.");
    }

    return {
      text: content,
      metadata: {
        provider: "openai-compatible",
        baseUrl,
        model: data.model ?? model,
        responseId: data.id,
        usage: data.usage,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const draft = await prisma.workflowDraft.findUnique({
    where: { id: sessionId },
    include: {
      investmentProject: true,
      skillDefinition: true,
      skillSop: true,
    },
  });

  if (!draft?.investmentProjectId || !draft.investmentProject) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    await assertEmployeeProjectAccess(session, draft.investmentProjectId);
    await prisma.workflowDraft.update({
      where: { id: draft.id },
      data: { status: "running" },
    });

    const config =
      draft.config && !Array.isArray(draft.config)
        ? (draft.config as { inputArtifactIds?: unknown[] })
        : null;
    const inputArtifactIds = (config?.inputArtifactIds ?? []).filter(
      (id): id is string => typeof id === "string"
    );
    const inputArtifacts = inputArtifactIds.length
      ? await prisma.projectArtifact.findMany({
        where: {
          id: { in: inputArtifactIds.filter((id): id is string => typeof id === "string") },
          investmentProjectId: draft.investmentProjectId,
        },
        orderBy: { createdAt: "asc" },
      })
      : [];

    const execution = await prisma.workflowExecution.create({
      data: {
        workflowDraftId: draft.id,
        employeeProfileId: draft.employeeProfileId,
        status: "running",
        startedAt: new Date(),
        inputArtifactIds: toJsonInput(inputArtifactIds),
        executionContext: toJsonInput({
          project: {
            id: draft.investmentProject.id,
            title: draft.investmentProject.title,
            topic: draft.investmentProject.topic,
          },
          skill: draft.skillDefinition
            ? {
              id: draft.skillDefinition.id,
              name: draft.skillDefinition.name,
            }
            : null,
          sop: draft.skillSop
            ? {
              id: draft.skillSop.id,
              name: draft.skillSop.name,
            }
            : null,
        }),
      },
    });

    const prompt = buildSessionPrompt({
      projectTitle: draft.investmentProject.title,
      projectTopic: draft.investmentProject.topic,
      sessionTopic: draft.topic,
      skillName: draft.skillDefinition?.name,
      skillDescription: draft.skillDefinition?.description,
      sopName: draft.skillSop?.name,
      sopDescription: draft.skillSop?.description,
      sopConfig: draft.skillSop?.config,
      inputArtifacts,
    });

    let resultMetadata: Record<string, unknown> | null = null;
    let summary: string;
    try {
      const result = await completeWithProjectLlm(prompt, session.id);
      summary = result.text;
      resultMetadata = result.metadata;
    } catch (error) {
      try {
        const result = await invokeEmployeeInvestmentAgent(session, {
          action: "execute_workflow",
          messages: [{ role: "user", content: prompt }],
          params: {
            draft_id: draft.id,
            project_id: draft.investmentProjectId,
            input_artifact_ids: inputArtifactIds,
            execution_prompt: prompt,
          },
        });
        summary = result.text || "Skill session completed.";
        resultMetadata = {
          agentRuntime: true,
          directLlmError: getErrorMessage(error),
          ...((result.metadata as Record<string, unknown> | null) ?? {}),
        };
      } catch (agentError) {
        const detailedReason = getErrorMessage(agentError);
        const sanitizedReason = sanitizeRuntimeError(agentError);
        console.warn("[employee-investment] session agent fallback", {
          sessionId: draft.id,
          projectId: draft.investmentProjectId,
          directLlmReason: getErrorMessage(error),
          agentReason: detailedReason,
        });
        summary = buildFallbackSessionResult({
          projectTitle: draft.investmentProject.title,
          sessionTopic: draft.topic,
          skillName: draft.skillDefinition?.name,
          sopName: draft.skillSop?.name,
          inputArtifacts,
          prompt,
        });
        resultMetadata = {
          fallback: true,
          directLlmReason: getErrorMessage(error),
          reason: sanitizedReason,
          diagnostic: detailedReason,
        };
      }
    }

    const artifact = await prisma.projectArtifact.create({
      data: {
        investmentProjectId: draft.investmentProjectId,
        createdByEmployeeProfileId: draft.employeeProfileId,
        workflowDraftId: draft.id,
        workflowExecutionId: execution.id,
        skillDefinitionId: draft.skillDefinitionId,
        skillSopId: draft.skillSopId,
        artifactType: "markdown",
        title: `${draft.topic} - session result`,
        content: summary,
        inputArtifactIds: toJsonInput(inputArtifactIds),
        metadata: toJsonInput({
          agentMetadata: resultMetadata,
          executionPrompt: prompt,
        }),
      },
      include: {
        createdByEmployeeProfile: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            title: true,
          },
        },
        skillDefinition: {
          select: { id: true, name: true, description: true },
        },
        skillSop: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: "completed",
        summary,
        metadata: resultMetadata ? toJsonInput(resultMetadata) : undefined,
        finishedAt: new Date(),
      },
    });

    await prisma.workflowDraft.update({
      where: { id: draft.id },
      data: { status: "completed" },
    });

    return NextResponse.json({
      artifact: serializeArtifact(artifact),
      message: summary,
    });
  } catch (error) {
    if (isProjectAccessError(error)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    await prisma.workflowExecution.updateMany({
      where: {
        workflowDraftId: sessionId,
        status: "running",
      },
      data: {
        status: "failed",
        finishedAt: new Date(),
        summary: error instanceof Error ? error.message : "Session execution failed",
      },
    });
    await prisma.workflowDraft.update({
      where: { id: sessionId },
      data: { status: "failed" },
    });
    throw error;
  }
}
