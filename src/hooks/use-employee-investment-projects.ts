"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmployeeSkill } from "./use-employee-investment-workbench";

export interface ProjectMemberView {
  id: string;
  role: string;
  status: string;
  isInitiator: boolean;
  joinedAt: string;
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
    title: string;
    department: string;
    focusAreas: string[];
    tags: string[];
  };
}

export interface InvestmentProjectView {
  id: string;
  projectCode: string;
  title: string;
  topic: string;
  status: string;
  objective: string | null;
  priority: string | null;
  config: Record<string, unknown> | null;
  mainConversationId: string | null;
  members: ProjectMemberView[];
  artifactCount: number;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectArtifactView {
  id: string;
  investmentProjectId: string;
  artifactType: string;
  title: string;
  content: string;
  inputArtifactIds: string[] | null;
  metadata: Record<string, unknown> | null;
  workflowDraftId: string | null;
  workflowExecutionId: string | null;
  skillDefinitionId: string | null;
  skillSopId: string | null;
  createdByEmployee: {
    id: string;
    employeeCode: string;
    displayName: string;
    title: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSessionView {
  id: string;
  investmentProjectId: string;
  employeeProfileId: string;
  topic: string;
  status: string;
  sessionType: string;
  selectedSkills?: unknown;
  config: Record<string, unknown> | null;
  skill: { id: string; name: string; description: string } | null;
  sop: { id: string; name: string; description: string | null } | null;
  sourceConversationId: string | null;
  nodeCount: number;
  artifactCount: number;
  executions?: Array<{
    id: string;
    status: string;
    summary: string | null;
    createdAt: string;
    finishedAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSessionDetail {
  session: ProjectSessionView;
  nodes: Array<{
    id: string;
    nodeKey: string;
    nodeType: string;
    title: string;
    enabled: boolean;
    params: Record<string, unknown> | null;
  }>;
  artifacts: ProjectArtifactView[];
}

export interface EmployeeProfileForProject {
  id: string;
  employeeCode: string;
  displayName: string;
  title: string;
  department: string;
  focusAreas: string[];
  tags: string[];
  skills: EmployeeSkill[];
}

export interface DemoEmployeeForProject {
  id: string;
  employeeCode: string;
  displayName: string;
  title: string;
  department: string;
  focusAreas: string[];
  tags: string[];
  skills: EmployeeSkill[];
}

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  let data: { error?: string } | T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = { error: text.slice(0, 500) };
    }
  }
  if (!res.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data ? String(data.error) : "Request failed";
    throw new Error(errorMessage);
  }
  return data as T;
}

export function useEmployeeInvestmentProjects() {
  const [projects, setProjects] = useState<InvestmentProjectView[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [artifacts, setArtifacts] = useState<ProjectArtifactView[]>([]);
  const [sessions, setSessions] = useState<ProjectSessionView[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedSessionDetail, setSelectedSessionDetail] =
    useState<ProjectSessionDetail | null>(null);
  const [profile, setProfile] = useState<EmployeeProfileForProject | null>(null);
  const [demoEmployees, setDemoEmployees] = useState<DemoEmployeeForProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectPayload, mePayload, demoEmployeePayload] = await Promise.all([
        readJson<{ projects: InvestmentProjectView[] }>("/api/employee-investment/projects"),
        readJson<{ profile: EmployeeProfileForProject | null }>("/api/employee-investment/me"),
        readJson<{ employees: DemoEmployeeForProject[] }>(
          "/api/employee-investment/demo/employees"
        ),
      ]);
      setProjects(projectPayload.projects ?? []);
      setProfile(mePayload.profile);
      setDemoEmployees(demoEmployeePayload.employees ?? []);
      setSelectedProjectId((current) => {
        if (current && projectPayload.projects.some((project) => project.id === current)) {
          return current;
        }
        return projectPayload.projects[0]?.id ?? "";
      });
    } catch (err) {
      setError((err as Error).message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProjectDetails = useCallback(async (projectId: string, preferredSessionId?: string) => {
    if (!projectId) {
      setArtifacts([]);
      setSessions([]);
      setSelectedSessionId("");
      setSelectedSessionDetail(null);
      return;
    }

    const [artifactPayload, sessionPayload] = await Promise.all([
      readJson<{ artifacts: ProjectArtifactView[] }>(
        `/api/employee-investment/projects/${projectId}/artifacts`
      ),
      readJson<{ sessions: ProjectSessionView[] }>(
        `/api/employee-investment/projects/${projectId}/sessions`
      ),
    ]);
    setArtifacts(artifactPayload.artifacts ?? []);
    setSessions(sessionPayload.sessions ?? []);
    setSelectedSessionId((current) => {
      if (
        preferredSessionId &&
        sessionPayload.sessions.some((item) => item.id === preferredSessionId)
      ) {
        return preferredSessionId;
      }
      if (current && sessionPayload.sessions.some((item) => item.id === current)) return current;
      return sessionPayload.sessions[0]?.id ?? "";
    });
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    refreshProjectDetails(selectedProjectId).catch((err) => {
      setError((err as Error).message || "Failed to load project details");
    });
  }, [refreshProjectDetails, selectedProjectId]);

  const refreshSessionDetail = useCallback(async (sessionId: string) => {
    if (!sessionId) {
      setSelectedSessionDetail(null);
      return null;
    }
    const detail = await readJson<ProjectSessionDetail>(
      `/api/employee-investment/sessions/${sessionId}`
    );
    setSelectedSessionDetail(detail);
    return detail;
  }, []);

  useEffect(() => {
    refreshSessionDetail(selectedSessionId).catch((err) => {
      setError((err as Error).message || "Failed to load session detail");
    });
  }, [refreshSessionDetail, selectedSessionId]);

  const runAction = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setPending(true);
    setError("");
    try {
      return await action();
    } catch (err) {
      const message = (err as Error).message || "Request failed";
      setError(message);
      throw err;
    } finally {
      setPending(false);
    }
  }, []);

  const createProject = useCallback(
    (input: {
      title: string;
      topic: string;
      objective?: string;
      priority?: string;
      memberEmployeeCodes?: string[];
    }) =>
      runAction(async () => {
        const payload = await readJson<{ project: InvestmentProjectView }>(
          "/api/employee-investment/projects",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        );
        await refreshProjects();
        setSelectedProjectId(payload.project.id);
        return payload.project;
      }),
    [refreshProjects, runAction]
  );

  const addProjectMembers = useCallback(
    (projectId: string, memberEmployeeCodes: string[]) =>
      runAction(async () => {
        const payload = await readJson<{ project: InvestmentProjectView }>(
          `/api/employee-investment/projects/${projectId}/members`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberEmployeeCodes }),
          }
        );
        await refreshProjects();
        setSelectedProjectId(projectId);
        return payload.project;
      }),
    [refreshProjects, runAction]
  );

  const createArtifact = useCallback(
    (projectId: string, input: { title: string; content: string; artifactType?: string }) =>
      runAction(async () => {
        const payload = await readJson<{ artifact: ProjectArtifactView }>(
          `/api/employee-investment/projects/${projectId}/artifacts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        );
        await refreshProjectDetails(projectId);
        return payload.artifact;
      }),
    [refreshProjectDetails, runAction]
  );

  const updateArtifact = useCallback(
    (
      projectId: string,
      artifactId: string,
      input: { title?: string; content?: string; artifactType?: string }
    ) =>
      runAction(async () => {
        const payload = await readJson<{ artifact: ProjectArtifactView }>(
          `/api/employee-investment/projects/${projectId}/artifacts/${artifactId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        );
        await refreshProjectDetails(projectId);
        return payload.artifact;
      }),
    [refreshProjectDetails, runAction]
  );

  const deleteArtifact = useCallback(
    (projectId: string, artifactId: string) =>
      runAction(async () => {
        await readJson<{ ok: boolean }>(
          `/api/employee-investment/projects/${projectId}/artifacts/${artifactId}`,
          { method: "DELETE" }
        );
        await refreshProjectDetails(projectId);
      }),
    [refreshProjectDetails, runAction]
  );

  const createSession = useCallback(
    (
      projectId: string,
      input: {
        topic: string;
        assigneeEmployeeProfileId?: string;
        skillDefinitionId: string;
        skillSopId?: string | null;
        inputArtifactIds?: string[];
      }
    ) =>
      runAction(async () => {
        const payload = await readJson<{ session: ProjectSessionView }>(
          `/api/employee-investment/projects/${projectId}/sessions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        );
        setSelectedSessionId(payload.session.id);
        await refreshProjectDetails(projectId, payload.session.id);
        return payload.session;
      }),
    [refreshProjectDetails, runAction]
  );

  const executeSession = useCallback(
    (sessionId: string, projectId: string) =>
      runAction(async () => {
        const payload = await readJson<{ artifact: ProjectArtifactView; message: string }>(
          `/api/employee-investment/sessions/${sessionId}/execute`,
          { method: "POST" }
        );
        await refreshProjectDetails(projectId);
        await refreshSessionDetail(sessionId);
        return payload.artifact;
      }),
    [refreshProjectDetails, refreshSessionDetail, runAction]
  );

  const createAndExecuteSession = useCallback(
    (
      projectId: string,
      input: {
        topic: string;
        assigneeEmployeeProfileId?: string;
        skillDefinitionId: string;
        skillSopId?: string | null;
        inputArtifactIds?: string[];
      }
    ) =>
      runAction(async () => {
        const created = await readJson<{ session: ProjectSessionView }>(
          `/api/employee-investment/projects/${projectId}/sessions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        );
        const executed = await readJson<{ artifact: ProjectArtifactView; message: string }>(
          `/api/employee-investment/sessions/${created.session.id}/execute`,
          { method: "POST" }
        );
        setSelectedSessionId(created.session.id);
        await refreshProjectDetails(projectId, created.session.id);
        await refreshSessionDetail(created.session.id);
        return { session: created.session, artifact: executed.artifact };
      }),
    [refreshProjectDetails, refreshSessionDetail, runAction]
  );

  const addArtifactToCanvas = useCallback(
    (conversationId: string, artifact: ProjectArtifactView) =>
      runAction(async () => {
        await readJson<{ node: unknown }>(`/api/canvas/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "text",
            label: artifact.title,
            width: 420,
            height: 260,
            data: {
              label: artifact.title,
              nodeType: "text",
              content: artifact.content,
              artifactId: artifact.id,
              artifactType: artifact.artifactType,
              width: 420,
              height: 260,
            },
          }),
        });
        return artifact;
      }),
    [runAction]
  );

  return {
    projects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    selectedSessionId,
    setSelectedSessionId,
    selectedSessionDetail,
    artifacts,
    sessions,
    profile,
    demoEmployees,
    loading,
    pending,
    error,
    refreshProjects,
    refreshProjectDetails,
    createProject,
    addProjectMembers,
    createArtifact,
    updateArtifact,
    deleteArtifact,
    createSession,
    createAndExecuteSession,
    executeSession,
    refreshSessionDetail,
    addArtifactToCanvas,
  };
}
