"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, BriefcaseBusiness, CheckCircle2, CircleDashed, ClipboardList, Database, GitBranch, GripVertical, Play, Plus, RefreshCcw, ShieldCheck, Sparkles, Trash2, UserPlus2, Users } from "lucide-react";
import { useEmployeeInvestmentWorkbench, type EmployeeSkill, type WorkflowNodeView } from "@/hooks/use-employee-investment-workbench";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Pos = { x: number; y: number };
type DragState = { nodeId: string; dx: number; dy: number } | null;
type ConnectState = { sourceId: string; x: number; y: number } | null;

const NODE_W = 260;
const NODE_H = 116;
const NODE_TYPES = ["data_analysis", "competitive_tracking", "policy_monitoring", "financial_analysis", "risk_control", "team_collaboration", "synthesize", "notify"];

const safeText = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  return value.includes("\uFFFD") || value.includes("???") || /^\?{3,}$/.test(value)
    ? fallback
    : value;
};

const titleFromType = (nodeType: string) => nodeType.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");

const statusTone = (status: string) => {
  if (status === "completed") return "bg-pa-green/10 text-pa-green border-pa-green/20";
  if (status === "confirmed" || status === "ready") return "bg-pa-cyan/10 text-pa-cyan border-pa-cyan/20";
  if (status === "running") return "bg-pa-amber/10 text-pa-amber border-pa-amber/20";
  return "bg-muted text-muted-foreground border-border";
};

function autoLayout(nodes: WorkflowNodeView[]) {
  const levels = new Map<string, number>();
  const byId = new Map(nodes.map((node) => [node.node_id, node]));
  const resolve = (node: WorkflowNodeView): number => {
    if (levels.has(node.node_id)) return levels.get(node.node_id)!;
    if (!node.depends_on.length) return levels.set(node.node_id, 0).get(node.node_id)!;
    const level = Math.max(...node.depends_on.map((dep) => (byId.get(dep) ? resolve(byId.get(dep)!) : 0))) + 1;
    levels.set(node.node_id, level);
    return level;
  };
  nodes.forEach(resolve);
  const grouped = new Map<number, WorkflowNodeView[]>();
  nodes.forEach((node) => grouped.set(levels.get(node.node_id) ?? 0, [...(grouped.get(levels.get(node.node_id) ?? 0) ?? []), node]));
  const positions: Record<string, Pos> = {};
  Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]).forEach(([level, group]) => {
    const total = group.length * NODE_W + (group.length - 1) * 80;
    const startX = Math.max(60, 560 - total / 2);
    group.forEach((node, index) => {
      positions[node.node_id] = { x: startX + index * (NODE_W + 80), y: 72 + level * 190 };
    });
  });
  return positions;
}

export default function InvestmentTeamPage() {
  const { currentProfile, demoEmployees, workflows, selectedWorkflow, selectedWorkflowId, setSelectedWorkflowId, latestResult, loading, pending, error, refresh, createWorkflow, addNode, updateNode, deleteNode, markReady, confirmWorkflow, executeWorkflow } = useEmployeeInvestmentWorkbench();
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

  const selectedNode = useMemo(() => selectedWorkflow?.nodes.find((node) => node.node_id === selectedNodeId) ?? null, [selectedWorkflow, selectedNodeId]);
  const availableSkillOptions = useMemo(() => {
    const initiatorSkills = (currentProfile?.skills ?? []).map((skill) => ({
      ownerEmployeeId: currentProfile?.employeeCode ?? "",
      ownerName: currentProfile?.displayName ?? "Initiator",
      skill,
    }));
    const teammateSkills = demoEmployees
      .filter((employee) => selectedWorkflow?.team_members.some((member) => member.employee_id === employee.employeeCode))
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
    () => availableSkillOptions.find((item) => item.skill.name === selectedNode?.skill_name)?.skill ?? null,
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
        if (typeof ui?.x === "number" && typeof ui?.y === "number") base[node.node_id] = { x: ui.x, y: ui.y };
        else if (current[node.node_id]) base[node.node_id] = current[node.node_id];
      }
      return base;
    });
    setSelectedNodeId((current) => current && selectedWorkflow.nodes.some((node) => node.node_id === current) ? current : selectedWorkflow.nodes[0]?.node_id ?? "");
  }, [selectedWorkflow]);

  useEffect(() => {
    if (!selectedNode) return;
    setTitleInput(selectedNode.title);
    setEnabledInput(selectedNode.enabled);
    setSkillInput(selectedNode.skill_name ?? "none");
    setSopInput(selectedNode.sop_name ?? "none");
    const { ui, ...rest } = (selectedNode.params ?? {}) as Record<string, unknown>;
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
        updateNode(selectedWorkflow.draft_id, drag.nodeId, { params: { ...(node.params ?? {}), ui: pos } });
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
      setConnect((current) => current ? { ...current, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
    };
    const up = () => setConnect(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [connect]);

  const toggleSkill = (skillName: string) => setSelectedSkills((current) => current.includes(skillName) ? current.filter((item) => item !== skillName) : [...current, skillName]);
  const toggleMember = (employeeCode: string) => setSelectedTeamMembers((current) => current.includes(employeeCode) ? current.filter((item) => item !== employeeCode) : [...current, employeeCode]);

  const handleCreateWorkflow = async () => {
    if (!topic.trim()) return;
    await createWorkflow(topic.trim(), selectedSkills, selectedTeamMembers);
    setTopic("");
  };

  const connectNodes = (sourceId: string, targetId: string) => {
    if (!selectedWorkflow || sourceId === targetId) return;
    const target = selectedWorkflow.nodes.find((node) => node.node_id === targetId);
    if (!target) return;
    updateNode(selectedWorkflow.draft_id, targetId, { depends_on: Array.from(new Set([...(target.depends_on ?? []), sourceId])) });
    setSelectedNodeId(targetId);
    setConnect(null);
  };

  const removeDependency = (dependencyId: string) => {
    if (!selectedWorkflow || !selectedNode) return;
    updateNode(selectedWorkflow.draft_id, selectedNode.node_id, { depends_on: selectedNode.depends_on.filter((item) => item !== dependencyId) });
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
            availableSkillOptions.find((item) => item.skill.name === skillInput)?.ownerEmployeeId ?? undefined,
          owner_name:
            availableSkillOptions.find((item) => item.skill.name === skillInput)?.ownerName ?? undefined,
        },
      });
      setFormError("");
    } catch {
      setFormError("Params must be valid JSON.");
    }
  };

  const canvasHeight = Math.max(980, ...Object.values(positions).map((item) => item.y + 260));
  const canvasWidth = Math.max(1080, ...Object.values(positions).map((item) => item.x + NODE_W + 120));
  const edges = selectedWorkflow?.nodes.flatMap((node) => node.depends_on.map((dependencyId) => {
    const source = positions[dependencyId];
    const target = positions[node.node_id];
    if (!source || !target) return null;
    return { key: `${dependencyId}-${node.node_id}`, fromX: source.x + NODE_W / 2, fromY: source.y + NODE_H, toX: target.x + NODE_W / 2, toY: target.y };
  }).filter(Boolean) as { key: string; fromX: number; fromY: number; toX: number; toY: number }[]) ?? [];

  if (loading) {
    return <div className="p-4"><div className="rounded-xl border border-border/30 bg-card/30 p-4 text-sm text-muted-foreground">Loading investment workbench...</div></div>;
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 p-4 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Investment Workflow Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a project, assemble the team, and edit the DAG directly on the canvas.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void refresh()}><RefreshCcw className="h-4 w-4" />Refresh</Button>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BriefcaseBusiness className="h-4 w-4 text-pa-green" />Project Setup</CardTitle>
          <CardDescription>Start from the initiator, pull in collaborators, and choose skills that extend the workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Users className="h-4 w-4 text-pa-cyan" />Initiator</div>
                <div className="mt-3 text-sm">
                  <div className="font-medium text-foreground">{safeText(currentProfile?.displayName, "Current employee")}</div>
                  <div className="text-muted-foreground">{safeText(currentProfile?.title, "Unknown title")} / {safeText(currentProfile?.department, "Unknown department")}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {currentProfile?.focusAreas.map((item) => <Badge key={item} className="bg-pa-cyan/10 text-pa-cyan border-pa-cyan/20">{safeText(item, "focus")}</Badge>)}
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Project Topic</label>
                <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Example: evaluate one innovative drug asset with finance, policy, and clinical collaborators" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleCreateWorkflow()} disabled={!topic.trim() || pending}>Create Workflow</Button>
                {selectedWorkflow && <>
                  <Button variant="outline" onClick={() => markReady(selectedWorkflow.draft_id)} disabled={pending}><ShieldCheck className="mr-2 h-4 w-4" />Ready</Button>
                  <Button variant="outline" onClick={() => confirmWorkflow(selectedWorkflow.draft_id)} disabled={pending}><CircleDashed className="mr-2 h-4 w-4" />Confirm</Button>
                  <Button onClick={() => executeWorkflow(selectedWorkflow.draft_id)} disabled={pending}><Play className="mr-2 h-4 w-4" />Execute</Button>
                </>}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><UserPlus2 className="h-4 w-4 text-pa-amber" />Team Builder</div>
                <div className="mt-3 space-y-2">
                  {demoEmployees.filter((employee) => employee.employeeCode !== currentProfile?.employeeCode).map((employee) => {
                    const active = selectedTeamMembers.includes(employee.employeeCode);
                    return (
                      <button key={employee.id} type="button" onClick={() => toggleMember(employee.employeeCode)} className={cn("w-full rounded-lg border p-3 text-left transition-colors", active ? "border-pa-cyan/30 bg-pa-cyan/5" : "border-border/40 bg-card/30 hover:bg-card/60")}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-foreground">{safeText(employee.displayName, "Teammate")}</div>
                            <div className="text-xs text-muted-foreground">{safeText(employee.title, "Unknown title")}</div>
                          </div>
                          {active && <CheckCircle2 className="h-4 w-4 text-pa-cyan" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Sparkles className="h-4 w-4 text-pa-green" />Skill Pack</div>
                <div className="mt-3 space-y-2">
                  {currentProfile?.skills.map((skill) => {
                    const active = selectedSkills.includes(skill.name);
                    return (
                      <button key={skill.id} type="button" onClick={() => toggleSkill(skill.name)} className={cn("w-full rounded-lg border p-3 text-left transition-colors", active ? "border-pa-green/30 bg-pa-green/5" : "border-border/40 bg-card/30 hover:bg-card/60")}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-foreground">{safeText(skill.name, "Skill")}</div>
                            <div className="text-xs text-muted-foreground">{safeText(skill.description, "Skill description unavailable.")}</div>
                          </div>
                          <Badge variant="outline">{safeText(skill.mergeMode, "merge")}</Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-background/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-pa-cyan" />
                Workflow Drafts
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                {workflows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-sm text-muted-foreground">
                    No draft yet.
                  </div>
                ) : (
                  workflows.map((workflow) => (
                    <button
                      key={workflow.draft_id}
                      type="button"
                      onClick={() => setSelectedWorkflowId(workflow.draft_id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        selectedWorkflowId === workflow.draft_id
                          ? "border-pa-cyan/30 bg-pa-cyan/5"
                          : "border-border/40 bg-card/30 hover:bg-card/60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {safeText(workflow.topic, "Untitled workflow")}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {workflow.nodes.length} nodes / {workflow.team_members.length} collaborators
                          </div>
                        </div>
                        <Badge className={statusTone(workflow.status)}>
                          {safeText(workflow.status, "draft")}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-background/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground"><GitBranch className="h-4 w-4 text-pa-amber" />Workflow Canvas</div>
                  <div className="mt-1 text-xs text-muted-foreground">The graph is the main workspace. Drag nodes, connect edges, and then fine-tune properties below.</div>
                </div>
                {selectedWorkflow && <div className="flex flex-wrap items-center gap-2">
                  <Select value={draftNodeType} onValueChange={(value) => setDraftNodeType(value ?? NODE_TYPES[0])}>
                    <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{NODE_TYPES.map((nodeType) => <SelectItem key={nodeType} value={nodeType}>{titleFromType(nodeType)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleAddNode} disabled={pending}><Plus className="mr-2 h-4 w-4" />Add Node</Button>
                </div>}
              </div>

              {selectedWorkflow ? (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-border/40 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.02))]">
                  <div ref={canvasRef} className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
                    <svg className="pointer-events-none absolute inset-0 h-full w-full">
                      <defs>
                        <pattern id="workflow-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#workflow-grid)" />
                      {edges.map((edge) => {
                        const midY = (edge.fromY + edge.toY) / 2;
                        return <path key={edge.key} d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`} fill="none" stroke="rgba(34,211,238,0.65)" strokeWidth="3" strokeLinecap="round" />;
                      })}
                      {connect && positions[connect.sourceId] && (
                        <path
                          d={`M ${positions[connect.sourceId].x + NODE_W / 2} ${positions[connect.sourceId].y + NODE_H} C ${positions[connect.sourceId].x + NODE_W / 2} ${(positions[connect.sourceId].y + NODE_H + connect.y) / 2}, ${connect.x} ${(positions[connect.sourceId].y + NODE_H + connect.y) / 2}, ${connect.x} ${connect.y}`}
                          fill="none"
                          stroke="rgba(16,185,129,0.8)"
                          strokeWidth="3"
                          strokeDasharray="8 6"
                        />
                      )}
                    </svg>

                    {selectedWorkflow.nodes.map((node) => {
                      const pos = positions[node.node_id] ?? { x: 80, y: 80 };
                      const active = node.node_id === selectedNodeId;
                      return (
                        <div key={node.node_id} className={cn("absolute rounded-2xl border bg-card/95 shadow-lg backdrop-blur-sm transition-shadow", active ? "border-pa-cyan/40 shadow-[0_0_0_2px_rgba(34,211,238,0.2)]" : "border-border/40")} style={{ width: NODE_W, height: NODE_H, left: pos.x, top: pos.y }} onClick={() => setSelectedNodeId(node.node_id)}>
                          <button type="button" aria-label="connect from this node" className="absolute -bottom-2 left-1/2 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-pa-cyan shadow" onMouseDown={(event) => {
                            event.stopPropagation();
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setConnect({ sourceId: node.node_id, x: event.clientX - rect.left, y: event.clientY - rect.top });
                          }} />
                          <button type="button" aria-label="connect to this node" className="absolute -top-2 left-1/2 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-pa-green shadow" onMouseUp={(event) => {
                            event.stopPropagation();
                            if (connect) connectNodes(connect.sourceId, node.node_id);
                          }} />
                          <div className="flex cursor-grab items-start justify-between gap-2 border-b border-border/40 px-3 py-2 active:cursor-grabbing" onPointerDown={(event) => {
                            const rect = (event.currentTarget.parentElement as HTMLDivElement | null)?.getBoundingClientRect();
                            if (!rect) return;
                            setDrag({ nodeId: node.node_id, dx: event.clientX - rect.left, dy: event.clientY - rect.top });
                          }}>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{safeText(node.title, "Workflow node")}</div>
                              <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{safeText(node.node_type, "node")}</div>
                            </div>
                            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                          <div className="space-y-2 px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <Badge className={statusTone(node.enabled ? "ready" : "draft")}>{node.enabled ? "enabled" : "disabled"}</Badge>
                              <Badge variant="outline">{node.depends_on.length} deps</Badge>
                            </div>
                            <div className="line-clamp-2 text-muted-foreground">{node.skill_name ? `skill: ${safeText(node.skill_name, "skill")}${node.sop_name ? ` / ${safeText(node.sop_name, "sop")}` : ""}` : "No skill attached"}</div>
                            {Boolean(node.params?.member_name) && <div className="text-pa-cyan">collaborator: {safeText(String(node.params?.member_name), "member")}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <div className="mt-4 rounded-xl border border-dashed border-border/40 px-6 py-12 text-center text-sm text-muted-foreground">Create or select a workflow draft first.</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-pa-amber" />Node Properties</CardTitle>
            <CardDescription>Select a node on the canvas to edit title, dependencies, skill binding, and JSON params.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedWorkflow && selectedNode ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Node title</label><Input value={titleInput} onChange={(event) => setTitleInput(event.target.value)} /></div>
                  <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Node type</label><Input value={safeText(selectedNode.node_type, "node")} disabled /></div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Enabled</label>
                    <Select value={enabledInput ? "enabled" : "disabled"} onValueChange={(value) => setEnabledInput(value === "enabled")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="enabled">enabled</SelectItem><SelectItem value="disabled">disabled</SelectItem></SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Skill</label>
                    <Select value={skillInput} onValueChange={(value) => setSkillInput(value ?? "none")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No skill</SelectItem>{availableSkillOptions.map((item) => <SelectItem key={`${item.ownerEmployeeId}-${item.skill.id}`} value={item.skill.name}>{safeText(item.skill.name, "Skill")} / {safeText(item.ownerName, "Owner")}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">SOP</label>
                    <Select value={sopInput} onValueChange={(value) => setSopInput(value ?? "none")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No SOP</SelectItem>{selectedSkillDefinition?.sops.map((sop) => <SelectItem key={sop.id} value={sop.name}>{safeText(sop.name, "SOP")}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Dependencies</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.depends_on.length === 0 ? <span className="text-sm text-muted-foreground">No dependencies.</span> : selectedNode.depends_on.map((dependencyId) => {
                      const dependency = selectedWorkflow.nodes.find((node) => node.node_id === dependencyId);
                      return (
                        <button key={dependencyId} type="button" onClick={() => removeDependency(dependencyId)} className="inline-flex items-center gap-2 rounded-full border border-border/50 px-3 py-1 text-xs text-foreground transition-colors hover:border-pa-red/40 hover:text-pa-red">
                          {safeText(dependency?.title, "Dependency")}
                          <Trash2 className="h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Params (JSON)</label>
                  <Textarea value={paramsInput} onChange={(event) => setParamsInput(event.target.value)} className="min-h-48 font-mono text-xs" />
                  {formError && <div className="text-sm text-pa-red">{formError}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveNode} disabled={pending}>Save Node</Button>
                  <Button variant="destructive" onClick={() => deleteNode(selectedWorkflow.draft_id, selectedNode.node_id)} disabled={pending}>Delete Node</Button>
                </div>
              </div>
            ) : <div className="rounded-xl border border-dashed border-border/40 px-6 py-12 text-center text-sm text-muted-foreground">Select a node on the canvas to edit it.</div>}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-pa-green" />Execution And Team Context</CardTitle>
            <CardDescription>Keep the project context visible while editing the graph.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Team</div>
                <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                  <div className="font-medium text-foreground">{safeText(currentProfile?.displayName, "Initiator")} / Initiator</div>
                  <div className="text-sm text-muted-foreground">{safeText(currentProfile?.title, "Unknown title")}</div>
                </div>
                {selectedWorkflow?.team_members.map((member) => <div key={member.employee_id} className="rounded-xl border border-border/40 bg-background/50 p-3"><div className="font-medium text-foreground">{safeText(member.name, "Member")}</div><div className="text-sm text-muted-foreground">{safeText(member.title, "Unknown title")}</div></div>)}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latest Result</div>
                {latestResult ? <div className="rounded-xl border border-pa-green/20 bg-pa-green/5 p-4"><div className="font-medium text-foreground">{safeText(latestResult.team_name, "Investment team")}</div><p className="mt-2 text-sm text-muted-foreground">{safeText(latestResult.summary, "Summary unavailable.")}</p></div> : <div className="rounded-xl border border-dashed border-border/40 px-4 py-8 text-sm text-muted-foreground">Execute a confirmed workflow to see result data here.</div>}
              </div>
            </div>
            {error && <><Separator /><div className="rounded-xl border border-pa-red/20 bg-pa-red/5 px-4 py-3 text-sm text-pa-red">{safeText(error, "Request failed")}</div></>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
