"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Bot,
  BriefcaseBusiness,
  FileText,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  SendToBack,
  Trash2,
  UserCheck,
  Users,
  Workflow,
} from "lucide-react";
import { ChatView } from "@/components/chat/chat-view";
import { useEmployeeInvestmentProjects } from "@/hooks/use-employee-investment-projects";
import { cn } from "@/lib/utils";

const fallbackProjectTopic = "创新药企业投资价值协作分析";

function shortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function InvestmentProjectsPage() {
  const {
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
    addArtifactToCanvas,
  } = useEmployeeInvestmentProjects();
  const [projectTitle, setProjectTitle] = useState("");
  const [projectTopic, setProjectTopic] = useState(fallbackProjectTopic);
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactContent, setArtifactContent] = useState("");
  const [sessionTopic, setSessionTopic] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedSopId, setSelectedSopId] = useState("");
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState("");
  const [editingArtifactId, setEditingArtifactId] = useState("");
  const [editingArtifactTitle, setEditingArtifactTitle] = useState("");
  const [editingArtifactContent, setEditingArtifactContent] = useState("");
  const [projectMemberCodes, setProjectMemberCodes] = useState<string[]>([]);
  const [memberCodesToAdd, setMemberCodesToAdd] = useState<string[]>([]);

  const selectedProjectMemberCodes = useMemo(
    () => new Set(selectedProject?.members.map((member) => member.employee.employeeCode) ?? []),
    [selectedProject]
  );
  const candidateMembers = useMemo(
    () =>
      demoEmployees.filter((employee) => !selectedProjectMemberCodes.has(employee.employeeCode)),
    [demoEmployees, selectedProjectMemberCodes]
  );
  const activeArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === activeArtifactId) ?? null,
    [activeArtifactId, artifacts]
  );
  const teamMembers = useMemo(
    () =>
      (selectedProject?.members ?? []).map((member) => {
        const detailedProfile =
          demoEmployees.find((employee) => employee.id === member.employee.id) ??
          (profile?.id === member.employee.id ? profile : null);

        return {
          ...member,
          profile: detailedProfile ?? member.employee,
          skills: detailedProfile?.skills ?? [],
        };
      }),
    [demoEmployees, profile, selectedProject]
  );
  const selectedAssignee =
    teamMembers.find((member) => member.employee.id === selectedAssigneeId) ?? teamMembers[0] ?? null;
  const selectedSkill = useMemo(
    () =>
      selectedAssignee?.skills.find((skill) => skill.id === selectedSkillId) ??
      selectedAssignee?.skills[0] ??
      null,
    [selectedAssignee, selectedSkillId]
  );
  const availableSops = useMemo(() => selectedSkill?.sops ?? [], [selectedSkill]);
  const selectedSop = useMemo(
    () =>
      availableSops.find((sop) => sop.id === selectedSopId) ??
      availableSops.find((sop) => sop.isDefault) ??
      availableSops[0] ??
      null,
    [availableSops, selectedSopId]
  );
  const fallbackTaskCapability = (() => {
    for (const member of teamMembers) {
      const skill = member.skills[0];
      if (skill) {
        return {
          assignee: member,
          skill,
          sop: skill.sops.find((item) => item.isDefault) ?? skill.sops[0] ?? null,
        };
      }
    }
    return null;
  })();
  const openTasks = useMemo(
    () => sessions.filter((session) => session.status !== "completed"),
    [sessions]
  );
  const completedTasks = useMemo(
    () => sessions.filter((session) => session.status === "completed"),
    [sessions]
  );

  useEffect(() => {
    const handleArtifactCreated = (event: Event) => {
      const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (projectId && projectId === selectedProjectId) {
        refreshProjectDetails(projectId);
      }
    };

    window.addEventListener("employee-investment:artifact-created", handleArtifactCreated);
    return () => {
      window.removeEventListener("employee-investment:artifact-created", handleArtifactCreated);
    };
  }, [refreshProjectDetails, selectedProjectId]);

  const handleCreateProject = async () => {
    if (!projectTitle.trim()) return;
    await createProject({
      title: projectTitle.trim(),
      topic: projectTopic.trim() || projectTitle.trim(),
      objective: "建立项目主会话、成员协作上下文和可复用分析资产。",
      priority: "normal",
      memberEmployeeCodes: projectMemberCodes,
    });
    setProjectTitle("");
    setProjectTopic(fallbackProjectTopic);
    setProjectMemberCodes([]);
  };

  const handleAddProjectMembers = async () => {
    if (!selectedProject || memberCodesToAdd.length === 0) return;
    await addProjectMembers(selectedProject.id, memberCodesToAdd);
    setMemberCodesToAdd([]);
  };

  const handleCreateArtifact = async () => {
    if (!selectedProject || !artifactTitle.trim() || !artifactContent.trim()) return;
    const artifact = await createArtifact(selectedProject.id, {
      artifactType: "markdown",
      title: artifactTitle.trim(),
      content: artifactContent.trim(),
    });
    setActiveArtifactId(artifact.id);
    setArtifactTitle("");
    setArtifactContent("");
  };

  const startEditArtifact = (artifactId: string) => {
    const artifact = artifacts.find((item) => item.id === artifactId);
    if (!artifact) return;
    setActiveArtifactId(artifact.id);
    setEditingArtifactId(artifact.id);
    setEditingArtifactTitle(artifact.title);
    setEditingArtifactContent(artifact.content);
  };

  const cancelEditArtifact = () => {
    setEditingArtifactId("");
    setEditingArtifactTitle("");
    setEditingArtifactContent("");
  };

  const handleUpdateArtifact = async () => {
    if (!selectedProject || !editingArtifactId) return;
    if (!editingArtifactTitle.trim() || !editingArtifactContent.trim()) return;
    const artifact = await updateArtifact(selectedProject.id, editingArtifactId, {
      title: editingArtifactTitle.trim(),
      content: editingArtifactContent.trim(),
    });
    setActiveArtifactId(artifact.id);
    cancelEditArtifact();
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    if (!selectedProject) return;
    await deleteArtifact(selectedProject.id, artifactId);
    setSelectedArtifactIds((current) => current.filter((id) => id !== artifactId));
    if (activeArtifactId === artifactId) {
      setActiveArtifactId("");
    }
    if (editingArtifactId === artifactId) {
      cancelEditArtifact();
    }
  };

  const handleCreateSession = async () => {
    if (!selectedProject) return;
    const taskAssignee = selectedSkill && selectedAssignee ? selectedAssignee : fallbackTaskCapability?.assignee;
    const taskSkill = selectedSkill ?? fallbackTaskCapability?.skill;
    const taskSop = selectedSkill ? selectedSop : fallbackTaskCapability?.sop;
    if (!taskAssignee || !taskSkill) return;
    await createSession(selectedProject.id, {
      topic: sessionTopic.trim() || `${taskSkill.name} analysis`,
      assigneeEmployeeProfileId: taskAssignee.employee.id,
      skillDefinitionId: taskSkill.id,
      skillSopId: taskSop?.id ?? null,
      inputArtifactIds: selectedArtifactIds,
    });
    setSessionTopic("");
    setSelectedArtifactIds([]);
  };

  const handleCreateAndRunSession = async () => {
    if (!selectedProject) return;
    const taskAssignee = selectedSkill && selectedAssignee ? selectedAssignee : fallbackTaskCapability?.assignee;
    const taskSkill = selectedSkill ?? fallbackTaskCapability?.skill;
    const taskSop = selectedSkill ? selectedSop : fallbackTaskCapability?.sop;
    if (!taskAssignee || !taskSkill) return;
    await createAndExecuteSession(selectedProject.id, {
      topic: sessionTopic.trim() || `${taskSkill.name} analysis`,
      assigneeEmployeeProfileId: taskAssignee.employee.id,
      skillDefinitionId: taskSkill.id,
      skillSopId: taskSop?.id ?? null,
      inputArtifactIds: selectedArtifactIds,
    });
    setSessionTopic("");
    setSelectedArtifactIds([]);
  };

  const duplicateTaskAsDraft = (sessionItem: (typeof sessions)[number]) => {
    setSelectedAssigneeId(sessionItem.employeeProfileId);
    setSelectedSkillId(sessionItem.skill?.id ?? "");
    setSelectedSopId(sessionItem.sop?.id ?? "");
    setSessionTopic(`${sessionItem.topic} - follow-up`);
    const inputArtifactIds = Array.isArray(sessionItem.config?.inputArtifactIds)
      ? sessionItem.config.inputArtifactIds.filter((id): id is string => typeof id === "string")
      : [];
    setSelectedArtifactIds(inputArtifactIds);
  };

  const toggleArtifactInput = (artifactId: string) => {
    setSelectedArtifactIds((current) =>
      current.includes(artifactId)
        ? current.filter((id) => id !== artifactId)
        : [...current, artifactId]
    );
  };

  const toggleProjectMember = (employeeCode: string) => {
    setProjectMemberCodes((current) =>
      current.includes(employeeCode)
        ? current.filter((code) => code !== employeeCode)
        : [...current, employeeCode]
    );
  };

  const toggleMemberToAdd = (employeeCode: string) => {
    setMemberCodesToAdd((current) =>
      current.includes(employeeCode)
        ? current.filter((code) => code !== employeeCode)
        : [...current, employeeCode]
    );
  };

  const handleAddArtifactToCanvas = async (artifactId: string) => {
    const artifact = artifacts.find((item) => item.id === artifactId);
    if (!selectedProject?.mainConversationId || !artifact) return;
    await addArtifactToCanvas(selectedProject.mainConversationId, artifact);
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--nf-bg-base)] p-5">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 nf-text-accent" />
              <span className="nf-nano">Project-first workspace</span>
            </div>
            <h1 className="nf-h1">Investment Projects</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 nf-text-secondary">
              Create a real project container, attach durable artifacts, and launch skill sessions
              against project context.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="nf-btn"
              onClick={refreshProjects}
              disabled={pending || loading}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link href="/investment-team/skills" className="nf-btn">
              <Bot className="h-3.5 w-3.5" />
              My Skills
            </Link>
            <Link href="/investment-team" className="nf-btn">
              <Workflow className="h-3.5 w-3.5" />
              Legacy Workflow
            </Link>
          </div>
        </header>

        {error && (
          <div className="nf-panel border-[rgba(217,106,94,0.35)] p-3 text-sm nf-text-danger">
            {error}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <aside className="flex flex-col gap-5">
            <section className="nf-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="nf-h2">Create Project</h2>
                <Plus className="h-4 w-4 nf-text-accent" />
              </div>
              <div className="flex flex-col gap-3">
                <input
                  className="nf-input"
                  placeholder="Project title"
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                />
                <textarea
                  className="nf-textarea min-h-[120px]"
                  placeholder="Project topic"
                  value={projectTopic}
                  onChange={(event) => setProjectTopic(event.target.value)}
                />
                {demoEmployees.length > 0 && (
                  <div className="nf-panel p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="nf-nano">Invite Demo Members</span>
                      <span className="nf-tag nf-tag-muted">{projectMemberCodes.length}</span>
                    </div>
                    <div className="flex max-h-[180px] flex-col gap-2 overflow-y-auto pr-1">
                      {demoEmployees.map((employee) => (
                        <button
                          key={employee.id}
                          type="button"
                          className={cn(
                            "rounded-[3px] border px-3 py-2 text-left text-xs transition-[border-color,background]",
                            projectMemberCodes.includes(employee.employeeCode)
                              ? "border-[rgba(255,109,31,0.5)] bg-[rgba(255,109,31,0.08)]"
                              : "border-[var(--nf-border-invisible)] bg-[var(--nf-bg-elevated)]"
                          )}
                          onClick={() => toggleProjectMember(employee.employeeCode)}
                        >
                          <div className="nf-text-primary">{employee.displayName}</div>
                          <div className="mt-1 nf-text-tertiary">
                            {employee.title} · {employee.department}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="nf-btn nf-btn-primary"
                  onClick={handleCreateProject}
                  disabled={pending || !projectTitle.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create
                </button>
              </div>
            </section>

            <section className="nf-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="nf-h2">Projects</h2>
                <span className="nf-tag">{projects.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {loading ? (
                  <div className="nf-empty">Loading projects.</div>
                ) : projects.length === 0 ? (
                  <div className="nf-empty">No projects yet.</div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className={cn(
                        "nf-panel p-3 text-left transition-[border-color,box-shadow]",
                        project.id === selectedProjectId &&
                          "border-[rgba(255,109,31,0.45)] shadow-[var(--nf-glow-sm)]"
                      )}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setMemberCodesToAdd([]);
                      }}
                    >
                      <div className="truncate text-sm nf-text-primary">{project.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] nf-text-tertiary">
                        <span>{project.artifactCount} artifacts</span>
                        <span>{project.sessionCount} sessions</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <main className="flex flex-col gap-5">
            {selectedProject ? (
              <>
                <section className="nf-card p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="nf-tag nf-tag-cyan">{selectedProject.status}</span>
                        <span className="nf-tag nf-tag-muted">
                          {selectedProject.projectCode}
                        </span>
                      </div>
                      <h2 className="text-xl font-semibold nf-text-primary">
                        {selectedProject.title}
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-6 nf-text-secondary">
                        {selectedProject.topic}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="nf-panel p-3">
                        <div className="nf-nano">Main Conversation</div>
                        <div className="mt-2 break-all text-xs nf-text-primary">
                          {selectedProject.mainConversationId ?? "not created"}
                        </div>
                        <div className="mt-3 text-[11px] nf-text-tertiary">
                          Updated {shortDate(selectedProject.updatedAt)}
                        </div>
                      </div>
                      <div className="nf-panel p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 nf-text-accent" />
                            <span className="nf-nano">Members</span>
                          </div>
                          <span className="nf-tag nf-tag-muted">
                            {selectedProject.members.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedProject.members.map((member) => (
                            <span key={member.id} className="nf-tag">
                              {member.employee.displayName}
                            </span>
                          ))}
                        </div>
                        {candidateMembers.length > 0 && (
                          <div className="mt-3">
                            <div className="mb-2 text-[11px] nf-text-tertiary">
                              Add demo members
                            </div>
                            <div className="flex max-h-[120px] flex-col gap-2 overflow-y-auto pr-1">
                              {candidateMembers.map((employee) => (
                                <button
                                  key={employee.id}
                                  type="button"
                                  className={cn(
                                    "rounded-[3px] border px-2 py-1.5 text-left text-[11px]",
                                    memberCodesToAdd.includes(employee.employeeCode)
                                      ? "border-[rgba(255,109,31,0.5)] bg-[rgba(255,109,31,0.08)]"
                                      : "border-[var(--nf-border-invisible)] bg-[var(--nf-bg-elevated)]"
                                  )}
                                  onClick={() => toggleMemberToAdd(employee.employeeCode)}
                                >
                                  {employee.displayName} · {employee.title}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="nf-btn mt-3 w-full"
                              onClick={handleAddProjectMembers}
                              disabled={pending || memberCodesToAdd.length === 0}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add Members
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-[4px] border border-[var(--nf-border-invisible)] bg-[var(--nf-bg-surface)]">
                  <div className="flex items-center justify-between border-b border-[var(--nf-border-invisible)] px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 nf-text-accent" />
                      <h2 className="nf-h2">Project Conversation &amp; Canvas</h2>
                    </div>
                    <span className="nf-tag nf-tag-muted">shared</span>
                  </div>
                  <div className="h-[760px] min-h-0">
                    {selectedProject.mainConversationId ? (
                      <ChatView
                        key={selectedProject.mainConversationId}
                        conversationId={selectedProject.mainConversationId}
                        projectId={selectedProject.id}
                        onProjectArtifactSaved={() => refreshProjectDetails(selectedProject.id)}
                      />
                    ) : (
                      <div className="nf-empty h-full">Project conversation is not available.</div>
                    )}
                  </div>
                </section>

                <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
                  <section className="nf-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4 nf-text-accent" />
                        <h2 className="nf-h2">Project Artifacts</h2>
                      </div>
                      <span className="nf-tag">{artifacts.length}</span>
                    </div>

                    <div className="mb-5 grid gap-3 md:grid-cols-[260px_1fr_auto]">
                      <input
                        className="nf-input"
                        placeholder="Artifact title"
                        value={artifactTitle}
                        onChange={(event) => setArtifactTitle(event.target.value)}
                      />
                      <input
                        className="nf-input"
                        placeholder="Markdown note or analysis content"
                        value={artifactContent}
                        onChange={(event) => setArtifactContent(event.target.value)}
                      />
                      <button
                        type="button"
                        className="nf-btn nf-btn-primary"
                        onClick={handleCreateArtifact}
                        disabled={pending || !artifactTitle.trim() || !artifactContent.trim()}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      {artifacts.length === 0 ? (
                        <div className="nf-empty lg:col-span-2">No artifacts yet.</div>
                      ) : (
                        artifacts.map((artifact) => (
                          <article
                            key={artifact.id}
                            className={cn(
                              "nf-panel p-4",
                              activeArtifactId === artifact.id &&
                                "border-[rgba(255,109,31,0.45)] shadow-[var(--nf-glow-sm)]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium nf-text-primary">
                                  {artifact.title}
                                </div>
                                <div className="mt-1 text-[11px] nf-text-tertiary">
                                  {artifact.artifactType} · {shortDate(artifact.createdAt)}
                                </div>
                              </div>
                              <button
                                type="button"
                                className={cn(
                                  "nf-tag",
                                  selectedArtifactIds.includes(artifact.id)
                                    ? "nf-tag-cyan"
                                    : "nf-tag-muted"
                                )}
                                onClick={() => toggleArtifactInput(artifact.id)}
                              >
                                input
                              </button>
                            </div>
                            <p className="mt-3 line-clamp-4 text-xs leading-5 nf-text-secondary">
                              {artifact.content}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                className="nf-btn"
                                onClick={() => setActiveArtifactId(artifact.id)}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className="nf-btn"
                                onClick={() => startEditArtifact(artifact.id)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="nf-btn"
                                onClick={() => handleAddArtifactToCanvas(artifact.id)}
                                disabled={pending || !selectedProject.mainConversationId}
                              >
                                <SendToBack className="h-3.5 w-3.5" />
                                Canvas
                              </button>
                              <button
                                type="button"
                                className="nf-btn border-[rgba(217,106,94,0.35)] nf-text-danger"
                                onClick={() => handleDeleteArtifact(artifact.id)}
                                disabled={pending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    {(activeArtifact || editingArtifactId) && (
                      <div className="nf-panel mt-5 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="nf-nano">Artifact Detail</div>
                            <div className="mt-1 text-sm font-medium nf-text-primary">
                              {editingArtifactId ? "Editing artifact" : activeArtifact?.title}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="nf-btn"
                            onClick={() => {
                              setActiveArtifactId("");
                              cancelEditArtifact();
                            }}
                          >
                            Close
                          </button>
                        </div>

                        {editingArtifactId ? (
                          <div className="flex flex-col gap-3">
                            <input
                              className="nf-input"
                              value={editingArtifactTitle}
                              onChange={(event) => setEditingArtifactTitle(event.target.value)}
                            />
                            <textarea
                              className="nf-textarea min-h-[260px]"
                              value={editingArtifactContent}
                              onChange={(event) => setEditingArtifactContent(event.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="nf-btn nf-btn-primary"
                                onClick={handleUpdateArtifact}
                                disabled={
                                  pending ||
                                  !editingArtifactTitle.trim() ||
                                  !editingArtifactContent.trim()
                                }
                              >
                                Save Changes
                              </button>
                              <button
                                type="button"
                                className="nf-btn"
                                onClick={cancelEditArtifact}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="mb-3 flex flex-wrap gap-2 text-[11px] nf-text-tertiary">
                              <span>{activeArtifact?.artifactType}</span>
                              <span>Updated {activeArtifact ? shortDate(activeArtifact.updatedAt) : ""}</span>
                              {activeArtifact?.createdByEmployee && (
                                <span>By {activeArtifact.createdByEmployee.displayName}</span>
                              )}
                            </div>
                            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[4px] border border-[var(--nf-border-invisible)] bg-[var(--nf-bg-elevated)] p-3 text-xs leading-5 nf-text-secondary">
                              {activeArtifact?.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="nf-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 nf-text-accent" />
                        <h2 className="nf-h2">Team Tasks</h2>
                      </div>
                      <span className="nf-tag">{sessions.length}</span>
                    </div>

                    <p className="mb-4 text-xs leading-5 nf-text-secondary">
                      Assign work to a project member, run it with their skill/SOP, and turn the
                      result into a reusable project artifact.
                    </p>

                    <div className="flex flex-col gap-3">
                      <select
                        className="nf-select"
                        value={selectedAssignee?.employee.id ?? ""}
                        onChange={(event) => {
                          setSelectedAssigneeId(event.target.value);
                          setSelectedSkillId("");
                          setSelectedSopId("");
                        }}
                      >
                        <option value="">Select owner</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.employee.id}>
                            {member.employee.displayName} · {member.employee.title}
                          </option>
                        ))}
                      </select>
                      {selectedAssignee && (
                        <div className="nf-panel p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm nf-text-primary">
                                {selectedAssignee.employee.displayName}
                              </div>
                              <div className="mt-1 text-[11px] nf-text-tertiary">
                                {selectedAssignee.employee.title} ·{" "}
                                {selectedAssignee.employee.department}
                              </div>
                            </div>
                            <span className="nf-tag nf-tag-muted">
                              {selectedAssignee.skills.length} skills
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {selectedAssignee.employee.focusAreas.slice(0, 4).map((area) => (
                              <span key={area} className="nf-tag nf-tag-muted">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <input
                        className="nf-input"
                        placeholder="Task topic"
                        value={sessionTopic}
                        onChange={(event) => setSessionTopic(event.target.value)}
                      />
                      <select
                        className="nf-select"
                        value={selectedSkill?.id ?? ""}
                        onChange={(event) => {
                          const nextSkillId = event.target.value;
                          const nextSkill = selectedAssignee?.skills.find(
                            (skill) => skill.id === nextSkillId
                          );
                          setSelectedSkillId(nextSkillId);
                          setSelectedSopId(
                            nextSkill?.sops.find((sop) => sop.isDefault)?.id ??
                              nextSkill?.sops[0]?.id ??
                              ""
                          );
                        }}
                      >
                        <option value="">Select owner skill</option>
                        {(selectedAssignee?.skills ?? []).map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="nf-select"
                        value={selectedSop?.id ?? ""}
                        onChange={(event) => setSelectedSopId(event.target.value)}
                        disabled={!availableSops.length}
                      >
                        <option value="">No SOP</option>
                        {availableSops.map((sop) => (
                          <option key={sop.id} value={sop.id}>
                            {sop.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="nf-btn nf-btn-primary"
                          onClick={handleCreateAndRunSession}
                          disabled={pending || !selectedProject || !fallbackTaskCapability}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Create &amp; Run
                        </button>
                        <button
                          type="button"
                          className="nf-btn"
                          onClick={handleCreateSession}
                          disabled={pending || !selectedProject || !fallbackTaskCapability}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Save Draft
                        </button>
                      </div>
                    </div>

                    <hr className="nf-divider my-5" />

                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="nf-nano">Open Tasks</div>
                        <div className="mt-1 text-[11px] nf-text-tertiary">
                          Draft, running, or failed work. Completed work moves to history.
                        </div>
                      </div>
                      <span className="nf-tag nf-tag-muted">{openTasks.length}</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {openTasks.length === 0 ? (
                        <div className="nf-empty">No open tasks.</div>
                      ) : (
                        openTasks.map((sessionItem) => (
                          <div
                            key={sessionItem.id}
                            className={cn(
                              "nf-panel p-3",
                              selectedSessionId === sessionItem.id &&
                                "border-[rgba(255,109,31,0.45)] shadow-[var(--nf-glow-sm)]"
                            )}
                            onClick={() => setSelectedSessionId(sessionItem.id)}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="nf-tag nf-tag-muted">
                                {teamMembers.find(
                                  (member) => member.employee.id === sessionItem.employeeProfileId
                                )?.employee.displayName ?? "Assignee"}
                              </span>
                              <span className="nf-tag">{sessionItem.status}</span>
                            </div>
                            <div className="text-sm nf-text-primary">{sessionItem.topic}</div>
                            <div className="mt-1 text-[11px] nf-text-tertiary">
                              {sessionItem.status} · {sessionItem.skill?.name ?? "skill"}
                            </div>
                            <button
                              type="button"
                              className="nf-btn mt-3 w-full"
                              onClick={(event) => {
                                event.stopPropagation();
                                executeSession(sessionItem.id, selectedProject.id);
                              }}
                              disabled={pending || sessionItem.status === "running"}
                            >
                              <Play className="h-3.5 w-3.5" />
                              {sessionItem.status === "failed" ? "Retry Task" : "Run Task"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <hr className="nf-divider my-5" />

                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="nf-nano">Completed Work</div>
                        <div className="mt-1 text-[11px] nf-text-tertiary">
                          Historical task records. Duplicate if you need a new run.
                        </div>
                      </div>
                      <span className="nf-tag nf-tag-muted">{completedTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {completedTasks.length === 0 ? (
                        <div className="nf-empty">No completed work yet.</div>
                      ) : (
                        completedTasks.map((sessionItem) => (
                          <div
                            key={sessionItem.id}
                            className={cn(
                              "nf-panel p-3",
                              selectedSessionId === sessionItem.id &&
                                "border-[rgba(255,109,31,0.45)] shadow-[var(--nf-glow-sm)]"
                            )}
                          >
                            <button
                              type="button"
                              className="block w-full text-left"
                              onClick={() => setSelectedSessionId(sessionItem.id)}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="nf-tag nf-tag-muted">
                                  {teamMembers.find(
                                    (member) =>
                                      member.employee.id === sessionItem.employeeProfileId
                                  )?.employee.displayName ?? "Assignee"}
                                </span>
                                <span className="nf-tag nf-tag-cyan">completed</span>
                              </div>
                              <div className="text-sm nf-text-primary">{sessionItem.topic}</div>
                              <div className="mt-1 text-[11px] nf-text-tertiary">
                                {sessionItem.skill?.name ?? "skill"} · outputs{" "}
                                {sessionItem.artifactCount}
                              </div>
                            </button>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                className="nf-btn"
                                onClick={() => setSelectedSessionId(sessionItem.id)}
                              >
                                View Output
                              </button>
                              <button
                                type="button"
                                className="nf-btn"
                                onClick={() => duplicateTaskAsDraft(sessionItem)}
                              >
                                Duplicate
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {selectedSessionDetail && (
                      <>
                        <hr className="nf-divider my-5" />
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="nf-nano">Task Detail</div>
                            <div className="mt-2 text-sm nf-text-primary">
                              {selectedSessionDetail.session.topic}
                            </div>
                            <div className="mt-1 text-[11px] nf-text-tertiary">
                              Owner:{" "}
                              {teamMembers.find(
                                (member) =>
                                  member.employee.id ===
                                  selectedSessionDetail.session.employeeProfileId
                              )?.employee.displayName ?? "Unknown"}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="nf-panel p-3">
                              <div className="nf-nano">Nodes</div>
                              <div className="mt-2 text-lg nf-text-primary">
                                {selectedSessionDetail.nodes.length}
                              </div>
                            </div>
                            <div className="nf-panel p-3">
                              <div className="nf-nano">Outputs</div>
                              <div className="mt-2 text-lg nf-text-primary">
                                {selectedSessionDetail.artifacts.length}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {selectedSessionDetail.nodes.map((node) => (
                              <div key={node.id} className="nf-panel p-3">
                                <div className="text-xs nf-text-primary">{node.title}</div>
                                <div className="mt-1 text-[11px] nf-text-tertiary">
                                  {node.nodeType} · {node.enabled ? "enabled" : "disabled"}
                                </div>
                              </div>
                            ))}
                          </div>
                          {selectedSessionDetail.artifacts.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {selectedSessionDetail.artifacts.map((artifact) => (
                                <button
                                  key={artifact.id}
                                  type="button"
                                  className="nf-btn justify-start"
                                  onClick={() => handleAddArtifactToCanvas(artifact.id)}
                                  disabled={pending || !selectedProject.mainConversationId}
                                >
                                  <SendToBack className="h-3.5 w-3.5" />
                                  {artifact.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="nf-empty min-h-[420px]">Create or select a project.</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
