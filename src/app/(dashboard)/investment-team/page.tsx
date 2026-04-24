"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Database,
  GitBranch,
  GripVertical,
  Play,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus2,
  Users,
} from "lucide-react";
import {
  useEmployeeInvestmentWorkbench,
  type EmployeeSkill,
  type WorkflowNodeView,
} from "@/hooks/use-employee-investment-workbench";
import { cn } from "@/lib/utils";

type Pos = { x: number; y: number };
type DragState = { nodeId: string; dx: number; dy: number } | null;
type ConnectState = { sourceId: string; x: number; y: number } | null;

const NODE_W = 260;
const NODE_H = 118;
const NODE_TYPES = [
  "data_analysis",
  "competitive_tracking",
  "policy_monitoring",
  "financial_analysis",
  "risk_control",
  "team_collaboration",
  "synthesize",
  "notify",
];

const safeText = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  return value.includes("\uFFFD") || value.includes("???") || /^\?{3,}$/.test(value)
    ? fallback
    : value;
};

const titleFromType = (nodeType: string) =>
  nodeType
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const statusToneClass = (status: string) => {
  if (status === "completed") return "nf-tag";
  if (status === "confirmed" || status === "ready") return "nf-tag nf-tag-cyan";
  if (status === "running") return "nf-tag nf-tag-amber";
  return "nf-tag nf-tag-muted";
};

function autoLayout(nodes: WorkflowNodeView[]) {
  const levels = new Map<string, number>();
  const byId = new Map(nodes.map((node) => [node.node_id, node]));
  const resolve = (node: WorkflowNodeView): number => {
    if (levels.has(node.node_id)) return levels.get(node.node_id)!;
    if (!node.depends_on.length) return levels.set(node.node_id, 0).get(node.node_id)!;
    const level =
      Math.max(...node.depends_on.map((dep) => (byId.get(dep) ? resolve(byId.get(dep)!) : 0))) + 1;
    levels.set(node.node_id, level);
    return level;
  };
  nodes.forEach(resolve);
  const grouped = new Map<number, WorkflowNodeView[]>();
  nodes.forEach((node) =>
    grouped.set(levels.get(node.node_id) ?? 0, [
      ...(grouped.get(levels.get(node.node_id) ?? 0) ?? []),
      node,
    ])
  );
  const positions: Record<string, Pos> = {};
  Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([level, group]) => {
      const total = group.length * NODE_W + (group.length - 1) * 80;
      const startX = Math.max(60, 560 - total / 2);
      group.forEach((node, index) => {
        positions[node.node_id] = { x: startX + index * (NODE_W + 80), y: 72 + level * 190 };
      });
    });
  return positions;
}

export default function InvestmentTeamPage() {
  const {
    currentProfile,
    demoEmployees,
    workflows,
    selectedWorkflow,
    selectedWorkflowId,
    setSelectedWorkflowId,
    latestResult,
    loading,
    pending,
    error,
    refresh,
    createWorkflow,
    addNode,
    updateNode,
    deleteNode,
    markReady,
    confirmWorkflow,
    executeWorkflow,
  } = useEmployeeInvestmentWorkbench();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [topic, setTopic] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [draftNodeType, setDraftNodeType] = useState(NODE_TYPES[0]);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [drag, setDrag] = useState<DragState>(null);
  const [connect, setConnect] = useState<ConnectState>(null);
  const [titleInput, setTitleInput] = useState("");
  const [enabledInput, setEnabledInput] = useState(true);
  const [skillInput, setSkillInput] = useState("none");
  const [sopInput, setSopInput] = useState("none");
  const [paramsInput, setParamsInput] = useState("{}");
  const [formError, setFormError] = useState("");

  const selectedNode = useMemo(
    () => selectedWorkflow?.nodes.find((node) => node.node_id === selectedNodeId) ?? null,
    [selectedWorkflow, selectedNodeId]
  );
  const availableSkillOptions = useMemo(() => {
    const initiatorSkills = (currentProfile?.skills ?? []).map((skill) => ({
      ownerEmployeeId: currentProfile?.employeeCode ?? "",
      ownerName: currentProfile?.displayName ?? "Initiator",
      skill,
    }));
    const teammateSkills = demoEmployees
      .filter((employee) =>
        selectedWorkflow?.team_members.some((member) => member.employee_id === employee.employeeCode)
      )
      .flatMap((employee) =>
        employee.skills.map((skill) => ({
          ownerEmployeeId: employee.employeeCode,
          ownerName: employee.displayName,
          skill,
        }))
      );
    return [...initiatorSkills, ...teammateSkills];
  }, [currentProfile, demoEmployees, selectedWorkflow]);
  const selectedSkillDefinition = useMemo<EmployeeSkill | null>(
    () =>
      availableSkillOptions.find((item) => item.skill.name === selectedNode?.skill_name)?.skill ??
      null,
    [availableSkillOptions, selectedNode]
  );

  useEffect(() => {
    if (!selectedWorkflow) {
      setPositions({});
      setSelectedNodeId("");
      return;
    }
    setPositions((current) => {
      const base = autoLayout(selectedWorkflow.nodes);
      for (const node of selectedWorkflow.nodes) {
        const ui = node.params?.ui as { x?: number; y?: number } | undefined;
        if (typeof ui?.x === "number" && typeof ui?.y === "number")
          base[node.node_id] = { x: ui.x, y: ui.y };
        else if (current[node.node_id]) base[node.node_id] = current[node.node_id];
      }
      return base;
    });
    setSelectedNodeId((current) =>
      current && selectedWorkflow.nodes.some((node) => node.node_id === current)
        ? current
        : selectedWorkflow.nodes[0]?.node_id ?? ""
    );
  }, [selectedWorkflow]);

  useEffect(() => {
    if (!selectedNode) return;
    setTitleInput(selectedNode.title);
    setEnabledInput(selectedNode.enabled);
    setSkillInput(selectedNode.skill_name ?? "none");
    setSopInput(selectedNode.sop_name ?? "none");
    const { ui, ...rest } = (selectedNode.params ?? {}) as Record<string, unknown>;
    void ui;
    setParamsInput(JSON.stringify(rest, null, 2));
    setFormError("");
  }, [selectedNode]);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPositions((current) => ({
        ...current,
        [drag.nodeId]: {
          x: Math.max(24, event.clientX - rect.left - drag.dx),
          y: Math.max(24, event.clientY - rect.top - drag.dy),
        },
      }));
    };
    const up = () => {
      const node = selectedWorkflow?.nodes.find((item) => item.node_id === drag.nodeId);
      const pos = positions[drag.nodeId];
      if (selectedWorkflow && node && pos) {
        updateNode(selectedWorkflow.draft_id, drag.nodeId, {
          params: { ...(node.params ?? {}), ui: pos },
        });
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, positions, selectedWorkflow, updateNode]);

  useEffect(() => {
    if (!connect) return;
    const move = (event: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setConnect((current) =>
        current ? { ...current, x: event.clientX - rect.left, y: event.clientY - rect.top } : null
      );
    };
    const up = () => setConnect(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [connect]);

  const toggleSkill = (skillName: string) =>
    setSelectedSkills((current) =>
      current.includes(skillName)
        ? current.filter((item) => item !== skillName)
        : [...current, skillName]
    );
  const toggleMember = (employeeCode: string) =>
    setSelectedTeamMembers((current) =>
      current.includes(employeeCode)
        ? current.filter((item) => item !== employeeCode)
        : [...current, employeeCode]
    );

  const handleCreateWorkflow = async () => {
    if (!topic.trim()) return;
    await createWorkflow(topic.trim(), selectedSkills, selectedTeamMembers);
    setTopic("");
  };

  const connectNodes = (sourceId: string, targetId: string) => {
    if (!selectedWorkflow || sourceId === targetId) return;
    const target = selectedWorkflow.nodes.find((node) => node.node_id === targetId);
    if (!target) return;
    updateNode(selectedWorkflow.draft_id, targetId, {
      depends_on: Array.from(new Set([...(target.depends_on ?? []), sourceId])),
    });
    setSelectedNodeId(targetId);
    setConnect(null);
  };

  const removeDependency = (dependencyId: string) => {
    if (!selectedWorkflow || !selectedNode) return;
    updateNode(selectedWorkflow.draft_id, selectedNode.node_id, {
      depends_on: selectedNode.depends_on.filter((item) => item !== dependencyId),
    });
  };

  const handleAddNode = () => {
    if (!selectedWorkflow) return;
    const maxY = Object.values(positions).reduce((acc, item) => Math.max(acc, item.y), 120);
    addNode(selectedWorkflow.draft_id, {
      nodeType: draftNodeType,
      title: titleFromType(draftNodeType),
      params: { ui: { x: 410, y: maxY + 170 } },
    });
  };

  const handleSaveNode = () => {
    if (!selectedWorkflow || !selectedNode) return;
    try {
      const parsed = paramsInput.trim() ? JSON.parse(paramsInput) : {};
      updateNode(selectedWorkflow.draft_id, selectedNode.node_id, {
        title: titleInput,
        enabled: enabledInput,
        skill_name: skillInput === "none" ? null : skillInput,
        sop_name: sopInput === "none" ? null : sopInput,
        params: {
          ...(typeof parsed === "object" && parsed ? parsed : {}),
          ui: positions[selectedNode.node_id],
          owner_employee_id:
            availableSkillOptions.find((item) => item.skill.name === skillInput)?.ownerEmployeeId ??
            undefined,
          owner_name:
            availableSkillOptions.find((item) => item.skill.name === skillInput)?.ownerName ??
            undefined,
        },
      });
      setFormError("");
    } catch {
      setFormError("Params must be valid JSON.");
    }
  };

  const canvasHeight = Math.max(980, ...Object.values(positions).map((item) => item.y + 260));
  const canvasWidth = Math.max(
    1080,
    ...Object.values(positions).map((item) => item.x + NODE_W + 120)
  );
  const edges =
    (selectedWorkflow?.nodes
      .flatMap((node) =>
        node.depends_on.map((dependencyId) => {
          const source = positions[dependencyId];
          const target = positions[node.node_id];
          if (!source || !target) return null;
          return {
            key: `${dependencyId}-${node.node_id}`,
            fromX: source.x + NODE_W / 2,
            fromY: source.y + NODE_H,
            toX: target.x + NODE_W / 2,
            toY: target.y,
          };
        })
      )
      .filter(Boolean) as { key: string; fromX: number; fromY: number; toX: number; toY: number }[]) ??
    [];

  if (loading) {
    return (
      <div className="nf-page h-full overflow-y-auto p-6">
        <div className="nf-panel p-5 text-xs tracking-[0.04em] nf-text-secondary">
          <span className="nf-mono nf-text-accent">&gt;</span> Loading investment workbench&hellip;
        </div>
      </div>
    );
  }

  return (
    <div className="nf-page nf-scroll h-full overflow-y-auto p-6 pb-16">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--nf-border-invisible)] pb-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="nf-nano">SYS / 03</span>
              <span className="h-px w-10 bg-[var(--nf-border-visible)]" />
              <span className="nf-nano nf-text-accent">INVESTMENT_WORKFLOW</span>
            </div>
            <h1 className="nf-h1">Workflow Studio</h1>
            <p className="nf-sub max-w-2xl">
              Assemble the team, bind skills, and wire the DAG. All state is expressed via precision borders &mdash; no decoration, only structure.
            </p>
          </div>
          <button type="button" className="nf-btn" onClick={() => void refresh()}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </header>

        <section className="nf-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-3.5 w-3.5 nf-text-accent" />
              <h2 className="nf-h2">Project Setup</h2>
            </div>
            <span className="nf-nano">01</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-4">
              <div className="nf-panel p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 nf-text-accent2" />
                  <span className="nf-nano">Initiator</span>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium nf-text-primary tracking-[0.02em]">
                    {safeText(currentProfile?.displayName, "Current employee")}
                  </div>
                  <div className="text-xs nf-text-secondary tracking-[0.03em]">
                    {safeText(currentProfile?.title, "Unknown title")} &middot; {safeText(currentProfile?.department, "Unknown department")}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {currentProfile?.focusAreas.map((item) => (
                    <span key={item} className="nf-tag nf-tag-cyan">
                      {safeText(item, "focus")}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="nf-label">Project Topic</label>
                <input
                  className="nf-input"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="evaluate one innovative drug asset with finance, policy, and clinical collaborators"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="nf-btn nf-btn-primary"
                  onClick={() => void handleCreateWorkflow()}
                  disabled={!topic.trim() || pending}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Workflow
                </button>
                {selectedWorkflow && (
                  <>
                    <button
                      type="button"
                      className="nf-btn"
                      onClick={() => markReady(selectedWorkflow.draft_id)}
                      disabled={pending}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Ready
                    </button>
                    <button
                      type="button"
                      className="nf-btn"
                      onClick={() => confirmWorkflow(selectedWorkflow.draft_id)}
                      disabled={pending}
                    >
                      <CircleDashed className="h-3.5 w-3.5" />
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="nf-btn nf-btn-primary"
                      onClick={() => executeWorkflow(selectedWorkflow.draft_id)}
                      disabled={pending}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Execute
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="nf-panel p-4">
                <div className="mb-3 flex items-center gap-2">
                  <UserPlus2 className="h-3.5 w-3.5 nf-text-accent" />
                  <span className="nf-nano">Team Builder</span>
                </div>
                <div className="flex flex-col gap-2">
                  {demoEmployees
                    .filter((employee) => employee.employeeCode !== currentProfile?.employeeCode)
                    .map((employee) => {
                      const active = selectedTeamMembers.includes(employee.employeeCode);
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => toggleMember(employee.employeeCode)}
                          className={cn("nf-selectable", active && "is-active-cyan")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm nf-text-primary tracking-[0.02em]">
                                {safeText(employee.displayName, "Teammate")}
                              </div>
                              <div className="mt-0.5 truncate text-xs nf-text-secondary">
                                {safeText(employee.title, "Unknown title")}
                              </div>
                            </div>
                            {active && <CheckCircle2 className="h-4 w-4 nf-text-accent2" />}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="nf-panel p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 nf-text-accent" />
                  <span className="nf-nano">Skill Pack</span>
                </div>
                <div className="flex flex-col gap-2">
                  {currentProfile?.skills.map((skill) => {
                    const active = selectedSkills.includes(skill.name);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleSkill(skill.name)}
                        className={cn("nf-selectable", active && "is-active")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm nf-text-primary tracking-[0.02em]">
                              {safeText(skill.name, "Skill")}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-xs nf-text-secondary leading-relaxed">
                              {safeText(skill.description, "Skill description unavailable.")}
                            </div>
                          </div>
                          <span className="nf-tag nf-tag-muted shrink-0">
                            {safeText(skill.mergeMode, "merge")}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <hr className="nf-divider my-5" />

          <div className="flex flex-col gap-4">
            <div className="nf-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList className="h-3.5 w-3.5 nf-text-accent2" />
                <span className="nf-nano">Workflow Drafts</span>
                <span className="ml-auto nf-nano nf-mono nf-text-tertiary">{workflows.length} REC</span>
              </div>
              <div className="grid gap-2 lg:grid-cols-3">
                {workflows.length === 0 ? (
                  <div className="nf-empty lg:col-span-3">No draft yet &mdash; create one above.</div>
                ) : (
                  workflows.map((workflow) => (
                    <button
                      key={workflow.draft_id}
                      type="button"
                      onClick={() => setSelectedWorkflowId(workflow.draft_id)}
                      className={cn(
                        "nf-selectable",
                        selectedWorkflowId === workflow.draft_id && "is-active-cyan"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm nf-text-primary tracking-[0.02em]">
                            {safeText(workflow.topic, "Untitled workflow")}
                          </div>
                          <div className="mt-1 text-[11px] nf-text-secondary nf-mono tracking-[0.04em]">
                            {workflow.nodes.length} nodes &middot; {workflow.team_members.length} collab
                          </div>
                        </div>
                        <span className={statusToneClass(workflow.status)}>
                          {safeText(workflow.status, "draft")}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="nf-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 nf-text-accent" />
                    <span className="nf-nano">Workflow Canvas</span>
                  </div>
                  <p className="nf-sub max-w-2xl">
                    Drag nodes. Connect from bottom port to top port. Edit properties below.
                  </p>
                </div>
                {selectedWorkflow && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="nf-select w-[220px]"
                      value={draftNodeType}
                      onChange={(event) => setDraftNodeType(event.target.value ?? NODE_TYPES[0])}
                    >
                      {NODE_TYPES.map((nodeType) => (
                        <option key={nodeType} value={nodeType}>
                          {titleFromType(nodeType)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="nf-btn nf-btn-primary"
                      onClick={handleAddNode}
                      disabled={pending}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Node
                    </button>
                  </div>
                )}
              </div>

              {selectedWorkflow ? (
                <div className="nf-canvas nf-scroll mt-4 overflow-x-auto">
                  <div
                    ref={canvasRef}
                    className="relative"
                    style={{ width: canvasWidth, height: canvasHeight }}
                  >
                    <svg className="pointer-events-none absolute inset-0 h-full w-full">
                      <defs>
                        <linearGradient id="nf-edge" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="rgba(224,168,72,0.55)" />
                          <stop offset="100%" stopColor="rgba(255,109,31,0.9)" />
                        </linearGradient>
                      </defs>
                      {edges.map((edge) => {
                        const midY = (edge.fromY + edge.toY) / 2;
                        return (
                          <path
                            key={edge.key}
                            d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`}
                            fill="none"
                            stroke="url(#nf-edge)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        );
                      })}
                      {connect && positions[connect.sourceId] && (
                        <path
                          d={`M ${positions[connect.sourceId].x + NODE_W / 2} ${
                            positions[connect.sourceId].y + NODE_H
                          } C ${positions[connect.sourceId].x + NODE_W / 2} ${
                            (positions[connect.sourceId].y + NODE_H + connect.y) / 2
                          }, ${connect.x} ${
                            (positions[connect.sourceId].y + NODE_H + connect.y) / 2
                          }, ${connect.x} ${connect.y}`}
                          fill="none"
                          stroke="rgba(255, 109, 31, 0.85)"
                          strokeWidth="1.5"
                          strokeDasharray="6 5"
                        />
                      )}
                    </svg>

                    {selectedWorkflow.nodes.map((node) => {
                      const pos = positions[node.node_id] ?? { x: 80, y: 80 };
                      const active = node.node_id === selectedNodeId;
                      return (
                        <div
                          key={node.node_id}
                          className={cn("nf-node absolute", active && "is-active")}
                          style={{ width: NODE_W, height: NODE_H, left: pos.x, top: pos.y }}
                          onClick={() => setSelectedNodeId(node.node_id)}
                        >
                          <button
                            type="button"
                            aria-label="connect from this node"
                            className="absolute -bottom-[7px] left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-[var(--nf-bg-base)] bg-[var(--nf-accent)] shadow-[0_0_6px_rgba(255,109,31,0.55)]"
                            onMouseDown={(event) => {
                              event.stopPropagation();
                              const rect = canvasRef.current?.getBoundingClientRect();
                              if (!rect) return;
                              setConnect({
                                sourceId: node.node_id,
                                x: event.clientX - rect.left,
                                y: event.clientY - rect.top,
                              });
                            }}
                          />
                          <button
                            type="button"
                            aria-label="connect to this node"
                            className="absolute -top-[7px] left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-[var(--nf-bg-base)] bg-[var(--nf-accent2)] shadow-[0_0_6px_rgba(224,168,72,0.5)]"
                            onMouseUp={(event) => {
                              event.stopPropagation();
                              if (connect) connectNodes(connect.sourceId, node.node_id);
                            }}
                          />
                          <div
                            className="flex cursor-grab items-start justify-between gap-2 border-b border-[var(--nf-border-invisible)] px-3 py-2 active:cursor-grabbing"
                            onPointerDown={(event) => {
                              const rect = (
                                event.currentTarget.parentElement as HTMLDivElement | null
                              )?.getBoundingClientRect();
                              if (!rect) return;
                              setDrag({
                                nodeId: node.node_id,
                                dx: event.clientX - rect.left,
                                dy: event.clientY - rect.top,
                              });
                            }}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium nf-text-primary tracking-[0.02em]">
                                {safeText(node.title, "Workflow node")}
                              </div>
                              <div className="mt-1 nf-nano nf-mono">
                                {safeText(node.node_type, "node")}
                              </div>
                            </div>
                            <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 nf-text-tertiary" />
                          </div>
                          <div className="space-y-1.5 px-3 py-2 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "nf-tag",
                                  node.enabled ? "" : "nf-tag-muted"
                                )}
                              >
                                {node.enabled ? "enabled" : "disabled"}
                              </span>
                              <span className="nf-tag nf-tag-muted">
                                {node.depends_on.length} deps
                              </span>
                            </div>
                            <div className="line-clamp-1 nf-text-secondary tracking-[0.02em]">
                              {node.skill_name
                                ? `skill: ${safeText(node.skill_name, "skill")}${
                                    node.sop_name ? ` / ${safeText(node.sop_name, "sop")}` : ""
                                  }`
                                : "No skill attached"}
                            </div>
                            {Boolean(node.params?.member_name) && (
                              <div className="nf-text-accent2 text-[10px] tracking-[0.06em] uppercase">
                                &gt; {safeText(String(node.params?.member_name), "member")}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="nf-empty mt-4">
                  Create or select a workflow draft first.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="nf-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 nf-text-accent" />
              <h2 className="nf-h2">Node Properties</h2>
            </div>
            <span className="nf-nano">02</span>
          </div>

          {selectedWorkflow && selectedNode ? (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="nf-label">Node Title</label>
                  <input
                    className="nf-input"
                    value={titleInput}
                    onChange={(event) => setTitleInput(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="nf-label">Node Type</label>
                  <input
                    className="nf-input nf-mono"
                    value={safeText(selectedNode.node_type, "node")}
                    disabled
                    readOnly
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="nf-label">Enabled</label>
                  <select
                    className="nf-select"
                    value={enabledInput ? "enabled" : "disabled"}
                    onChange={(event) => setEnabledInput(event.target.value === "enabled")}
                  >
                    <option value="enabled">enabled</option>
                    <option value="disabled">disabled</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="nf-label">Skill Binding</label>
                  <select
                    className="nf-select"
                    value={skillInput}
                    onChange={(event) => setSkillInput(event.target.value ?? "none")}
                  >
                    <option value="none">No skill</option>
                    {availableSkillOptions.map((item) => (
                      <option
                        key={`${item.ownerEmployeeId}-${item.skill.id}`}
                        value={item.skill.name}
                      >
                        {safeText(item.skill.name, "Skill")} / {safeText(item.ownerName, "Owner")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="nf-label">SOP</label>
                  <select
                    className="nf-select"
                    value={sopInput}
                    onChange={(event) => setSopInput(event.target.value ?? "none")}
                  >
                    <option value="none">No SOP</option>
                    {selectedSkillDefinition?.sops.map((sop) => (
                      <option key={sop.id} value={sop.name}>
                        {safeText(sop.name, "SOP")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="nf-label">Dependencies</label>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.depends_on.length === 0 ? (
                    <span className="text-xs nf-text-tertiary tracking-[0.03em]">
                      No dependencies.
                    </span>
                  ) : (
                    selectedNode.depends_on.map((dependencyId) => {
                      const dependency = selectedWorkflow.nodes.find(
                        (node) => node.node_id === dependencyId
                      );
                      return (
                        <button
                          key={dependencyId}
                          type="button"
                          onClick={() => removeDependency(dependencyId)}
                          className="nf-dep-chip"
                        >
                          <span>{safeText(dependency?.title, "Dependency")}</span>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="nf-label">Params (JSON)</label>
                <textarea
                  className="nf-textarea nf-scroll min-h-[200px]"
                  value={paramsInput}
                  onChange={(event) => setParamsInput(event.target.value)}
                />
                {formError && (
                  <div className="text-xs nf-text-danger tracking-[0.03em]">&gt; {formError}</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="nf-btn nf-btn-primary"
                  onClick={handleSaveNode}
                  disabled={pending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Save Node
                </button>
                <button
                  type="button"
                  className="nf-btn nf-btn-danger"
                  onClick={() => deleteNode(selectedWorkflow.draft_id, selectedNode.node_id)}
                  disabled={pending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Node
                </button>
              </div>
            </div>
          ) : (
            <div className="nf-empty">Select a node on the canvas to edit it.</div>
          )}
        </section>

        <section className="nf-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 nf-text-accent" />
              <h2 className="nf-h2">Execution &amp; Team Context</h2>
            </div>
            <span className="nf-nano">03</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="flex flex-col gap-3">
              <div className="nf-nano">Current Team</div>
              <div className="nf-panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm nf-text-primary tracking-[0.02em]">
                      {safeText(currentProfile?.displayName, "Initiator")}
                    </div>
                    <div className="mt-0.5 text-xs nf-text-secondary">
                      {safeText(currentProfile?.title, "Unknown title")}
                    </div>
                  </div>
                  <span className="nf-tag">Initiator</span>
                </div>
              </div>
              {selectedWorkflow?.team_members.map((member) => (
                <div key={member.employee_id} className="nf-panel p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm nf-text-primary tracking-[0.02em]">
                        {safeText(member.name, "Member")}
                      </div>
                      <div className="mt-0.5 text-xs nf-text-secondary">
                        {safeText(member.title, "Unknown title")}
                      </div>
                    </div>
                    <span className="nf-tag nf-tag-cyan">Member</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <div className="nf-nano">Latest Result</div>
              {latestResult ? (
                <div className="nf-panel border-[rgba(255,109,31,0.25)] p-4 shadow-[var(--nf-glow-sm)]">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--nf-accent)] shadow-[0_0_6px_rgba(255,109,31,0.6)]" />
                    <div className="text-sm font-medium nf-text-primary tracking-[0.02em]">
                      {safeText(latestResult.team_name, "Investment team")}
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed nf-text-secondary tracking-[0.02em]">
                    {safeText(latestResult.summary, "Summary unavailable.")}
                  </p>
                </div>
              ) : (
                <div className="nf-empty">
                  Execute a confirmed workflow to see result data here.
                </div>
              )}
            </div>
          </div>

          {error && (
            <>
              <hr className="nf-divider my-5" />
              <div className="nf-panel border-[rgba(217,106,94,0.3)] p-3 text-xs nf-text-danger tracking-[0.03em]">
                <span className="nf-mono">&gt; ERR</span> {safeText(error, "Request failed")}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
