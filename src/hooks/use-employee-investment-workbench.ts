"use client";

import { useCallback, useEffect, useState } from "react";

export interface SocialAccount {
  id: string;
  platform: string;
  accountRef: string;
  webhookUrl: string | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
}

export interface Observation {
  id: string;
  category: string;
  title: string | null;
  content: string;
  source: string | null;
  observedAt: string;
}

export interface InvestmentBehavior {
  id: string;
  target: string;
  action: string;
  thesis: string | null;
  outcome: string | null;
  decidedAt: string;
}

export interface SkillSop {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  config: Record<string, unknown> | null;
}

export interface SkillScript {
  id: string;
  name: string;
  description: string | null;
  language: string;
  entryPoint: string | null;
  version: number;
  checksum: string | null;
  content: string;
}

export interface EmployeeSkill {
  id: string;
  name: string;
  description: string;
  category: string | null;
  mergeMode: string;
  metadata: Record<string, unknown> | null;
  sops: SkillSop[];
  scripts: SkillScript[];
}

export interface EmployeeProfileView {
  id: string;
  employeeCode: string;
  displayName: string;
  title: string;
  department: string;
  focusAreas: string[];
  tags: string[];
  preferences: Record<string, unknown> | null;
  socialAccounts: SocialAccount[];
  observations: Observation[];
  investmentBehaviors: InvestmentBehavior[];
  skills: EmployeeSkill[];
}

export interface WorkflowNodeView {
  node_id: string;
  node_type: string;
  title: string;
  depends_on: string[];
  enabled: boolean;
  skill_name?: string | null;
  sop_name?: string | null;
  params?: Record<string, unknown>;
}

export interface WorkflowDraftView {
  draft_id: string;
  employee_id: string;
  topic: string;
  status: string;
  selected_skills: string[];
  team_members: Array<{
    employee_id: string;
    name: string;
    title: string;
    department: string;
    focus_areas: string[];
    tags: string[];
    skills: Array<{ name: string; description: string }>;
  }>;
  nodes: WorkflowNodeView[];
}

export interface WorkflowResultView {
  draft_id: string;
  employee_id: string;
  topic: string;
  team_name: string;
  summary: string;
  consensus: string[];
  disagreements: string[];
  actions: string[];
  notification_targets: string[];
}

export interface DemoEmployeeView {
  id: string;
  employeeCode: string;
  displayName: string;
  title: string;
  department: string;
  focusAreas: string[];
  tags: string[];
  skills: EmployeeSkill[];
}

interface WorkbenchState {
  currentProfile: EmployeeProfileView | null;
  workflows: WorkflowDraftView[];
  demoEmployees: DemoEmployeeView[];
}

interface AddNodeInput {
  nodeType: string;
  title: string;
  dependsOn?: string[];
  skillName?: string | null;
  sopName?: string | null;
  params?: Record<string, unknown>;
}

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data as T;
}

export function useEmployeeInvestmentWorkbench() {
  const [state, setState] = useState<WorkbenchState>({
    currentProfile: null,
    workflows: [],
    demoEmployees: [],
  });
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [latestResult, setLatestResult] = useState<WorkflowResultView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [me, workflows, demo] = await Promise.all([
        readJson<{ profile: EmployeeProfileView | null }>("/api/employee-investment/me"),
        readJson<{ workflows: WorkflowDraftView[] }>("/api/employee-investment/workflows"),
        readJson<{ employees: DemoEmployeeView[] }>("/api/employee-investment/demo/employees"),
      ]);

      setState({
        currentProfile: me.profile,
        workflows: workflows.workflows ?? [],
        demoEmployees: demo.employees ?? [],
      });

      setSelectedWorkflowId((current) => {
        if (current && workflows.workflows?.some((item) => item.draft_id === current)) {
          return current;
        }
        return workflows.workflows?.[0]?.draft_id ?? "";
      });
    } catch (err) {
      setError((err as Error).message || "Failed to load workbench");
    } finally {
      setLoading(false);
    }
  }, []);

  const replaceWorkflow = useCallback((workflow: WorkflowDraftView) => {
    setState((current) => ({
      ...current,
      workflows: current.workflows.some((item) => item.draft_id === workflow.draft_id)
        ? current.workflows.map((item) => (item.draft_id === workflow.draft_id ? workflow : item))
        : [workflow, ...current.workflows],
    }));
    setSelectedWorkflowId(workflow.draft_id);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createWorkflow = useCallback(
    async (topic: string, selectedSkills: string[], selectedTeamMembers: string[]) => {
      const payload = await readJson<{ workflow: WorkflowDraftView }>("/api/employee-investment/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, selectedSkills, selectedTeamMembers }),
      });
      await refresh();
      setSelectedWorkflowId(payload.workflow.draft_id);
      return payload.workflow;
    },
    [refresh]
  );

  const markReady = useCallback(
    async (draftId: string) => {
      await readJson(`/api/employee-investment/workflows/${draftId}/ready`, {
        method: "POST",
      });
      await refresh();
    },
    [refresh]
  );

  const confirmWorkflow = useCallback(
    async (draftId: string) => {
      await readJson(`/api/employee-investment/workflows/${draftId}/confirm`, {
        method: "POST",
      });
      await refresh();
    },
    [refresh]
  );

  const executeWorkflow = useCallback(
    async (draftId: string) => {
      const payload = await readJson<{ result: WorkflowResultView }>(
        `/api/employee-investment/workflows/${draftId}/execute`,
        {
          method: "POST",
        }
      );
      setLatestResult(payload.result);
      await refresh();
      return payload.result;
    },
    [refresh]
  );

  const addNode = useCallback(
    async (draftId: string, input: AddNodeInput) => {
      const payload = await readJson<{ workflow: WorkflowDraftView }>(
        `/api/employee-investment/workflows/${draftId}/nodes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      replaceWorkflow(payload.workflow);
      return payload.workflow;
    },
    [replaceWorkflow]
  );

  const updateNode = useCallback(
    async (draftId: string, nodeId: string, updates: Record<string, unknown>) => {
      const payload = await readJson<{ workflow: WorkflowDraftView }>(
        `/api/employee-investment/workflows/${draftId}/nodes/${nodeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      replaceWorkflow(payload.workflow);
      return payload.workflow;
    },
    [replaceWorkflow]
  );

  const deleteNode = useCallback(
    async (draftId: string, nodeId: string) => {
      const payload = await readJson<{ workflow: WorkflowDraftView }>(
        `/api/employee-investment/workflows/${draftId}/nodes/${nodeId}`,
        {
          method: "DELETE",
        }
      );
      replaceWorkflow(payload.workflow);
      return payload.workflow;
    },
    [replaceWorkflow]
  );

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

  const selectedWorkflow =
    state.workflows.find((item) => item.draft_id === selectedWorkflowId) ?? null;

  return {
    ...state,
    selectedWorkflow,
    selectedWorkflowId,
    setSelectedWorkflowId,
    latestResult,
    loading,
    pending,
    error,
    refresh,
    createWorkflow: (topic: string, selectedSkills: string[], selectedTeamMembers: string[]) =>
      runAction(() => createWorkflow(topic, selectedSkills, selectedTeamMembers)),
    addNode: (draftId: string, input: AddNodeInput) => runAction(() => addNode(draftId, input)),
    updateNode: (draftId: string, nodeId: string, updates: Record<string, unknown>) =>
      runAction(() => updateNode(draftId, nodeId, updates)),
    deleteNode: (draftId: string, nodeId: string) => runAction(() => deleteNode(draftId, nodeId)),
    markReady: (draftId: string) => runAction(() => markReady(draftId)),
    confirmWorkflow: (draftId: string) => runAction(() => confirmWorkflow(draftId)),
    executeWorkflow: (draftId: string) => runAction(() => executeWorkflow(draftId)),
  };
}
