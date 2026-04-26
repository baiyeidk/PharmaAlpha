"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, BriefcaseBusiness, Plus, RefreshCcw } from "lucide-react";
import type { EmployeeSkill } from "@/hooks/use-employee-investment-workbench";
import { cn } from "@/lib/utils";

type EmployeeSummary = {
  profileId: string;
  employeeCode: string;
  displayName: string;
  title: string;
  department: string;
};

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data as T;
}

export default function InvestmentSkillsPage() {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [skills, setSkills] = useState<EmployeeSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillCategory, setSkillCategory] = useState("analysis");
  const [defaultSopName, setDefaultSopName] = useState("");
  const [defaultSopDescription, setDefaultSopDescription] = useState("");
  const [defaultSopConfig, setDefaultSopConfig] = useState(
    '{\n  "workflow": ["read inputs", "extract evidence", "write conclusion"],\n  "outputSections": ["Conclusion", "Evidence", "Risks", "Next actions"]\n}'
  );
  const [sopName, setSopName] = useState("");
  const [sopDescription, setSopDescription] = useState("");
  const [sopConfig, setSopConfig] = useState(
    '{\n  "workflow": ["define scope", "run analysis", "state assumptions"],\n  "qualityBar": ["cite evidence", "list missing data"]\n}'
  );
  const [sopIsDefault, setSopIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const selectedSkill =
    skills.find((skill) => skill.id === selectedSkillId) ?? skills[0] ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await readJson<{ employee: EmployeeSummary; skills: EmployeeSkill[] }>(
        "/api/employee-investment/skills"
      );
      setEmployee(payload.employee);
      setSkills(payload.skills ?? []);
      setSelectedSkillId((current) => {
        if (current && payload.skills?.some((skill) => skill.id === current)) return current;
        return payload.skills?.[0]?.id ?? "";
      });
    } catch (err) {
      setError((err as Error).message || "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async <T,>(action: () => Promise<T>) => {
    setPending(true);
    setError("");
    try {
      return await action();
    } catch (err) {
      setError((err as Error).message || "Request failed");
      throw err;
    } finally {
      setPending(false);
    }
  };

  const createSkill = async () => {
    if (!skillName.trim() || !skillDescription.trim()) return;
    const payload = await runAction(() =>
      readJson<{ skill: EmployeeSkill }>("/api/employee-investment/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skillName.trim(),
          description: skillDescription.trim(),
          category: skillCategory.trim() || null,
          mergeMode: "parallel",
          defaultSop: defaultSopName.trim()
            ? {
                name: defaultSopName.trim(),
                description: defaultSopDescription.trim() || null,
                config: defaultSopConfig,
              }
            : undefined,
        }),
      })
    );
    setSelectedSkillId(payload.skill.id);
    setSkillName("");
    setSkillDescription("");
    setDefaultSopName("");
    setDefaultSopDescription("");
    await refresh();
  };

  const createSop = async () => {
    if (!selectedSkill || !sopName.trim()) return;
    await runAction(() =>
      readJson(`/api/employee-investment/skills/${selectedSkill.id}/sops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sopName.trim(),
          description: sopDescription.trim() || null,
          config: sopConfig,
          isDefault: sopIsDefault,
        }),
      })
    );
    setSopName("");
    setSopDescription("");
    setSopIsDefault(false);
    await refresh();
  };

  const skillCountLabel = useMemo(
    () => `${skills.length} skill${skills.length === 1 ? "" : "s"}`,
    [skills.length]
  );

  return (
    <div className="h-full overflow-y-auto bg-[var(--nf-bg-base)] p-5">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4 nf-text-accent" />
              <span className="nf-nano">Employee capability library</span>
            </div>
            <h1 className="nf-h1">My Skills & SOPs</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 nf-text-secondary">
              Maintain only your own reusable skills and execution SOPs. Project team tasks can
              use these capabilities after they are created here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="nf-btn" onClick={refresh} disabled={pending || loading}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <Link href="/investment-team/projects" className="nf-btn">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Projects
            </Link>
          </div>
        </header>

        {error && (
          <div className="nf-panel border-[rgba(217,106,94,0.35)] p-3 text-sm nf-text-danger">
            {error}
          </div>
        )}

        <section className="nf-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="nf-h2">{employee?.displayName ?? "Current employee"}</h2>
              <p className="mt-1 text-xs nf-text-tertiary">
                {employee?.title ?? "Employee"} / {employee?.department ?? "Department"}
              </p>
            </div>
            <span className="nf-tag nf-tag-muted">{skillCountLabel}</span>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <aside className="flex flex-col gap-5">
            <section className="nf-card p-5">
              <div className="mb-4">
                <div className="nf-nano">Create My Skill</div>
                <p className="mt-1 text-xs nf-text-tertiary">
                  Skills are owned by your employee profile only.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  className="nf-input"
                  placeholder="Skill name"
                  value={skillName}
                  onChange={(event) => setSkillName(event.target.value)}
                />
                <textarea
                  className="nf-textarea min-h-[100px]"
                  placeholder="Skill description"
                  value={skillDescription}
                  onChange={(event) => setSkillDescription(event.target.value)}
                />
                <input
                  className="nf-input"
                  placeholder="Category"
                  value={skillCategory}
                  onChange={(event) => setSkillCategory(event.target.value)}
                />
                <input
                  className="nf-input"
                  placeholder="Optional default SOP name"
                  value={defaultSopName}
                  onChange={(event) => setDefaultSopName(event.target.value)}
                />
                <textarea
                  className="nf-textarea min-h-[80px]"
                  placeholder="Optional default SOP description"
                  value={defaultSopDescription}
                  onChange={(event) => setDefaultSopDescription(event.target.value)}
                />
                <textarea
                  className="nf-textarea min-h-[140px] font-mono text-[11px]"
                  placeholder="Default SOP config JSON"
                  value={defaultSopConfig}
                  onChange={(event) => setDefaultSopConfig(event.target.value)}
                />
                <button
                  type="button"
                  className="nf-btn nf-btn-primary"
                  onClick={createSkill}
                  disabled={pending || !skillName.trim() || !skillDescription.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Skill
                </button>
              </div>
            </section>

            <section className="nf-card p-5">
              <div className="mb-4">
                <div className="nf-nano">Add SOP To My Skill</div>
                <p className="mt-1 text-xs nf-text-tertiary">
                  SOPs can only be added to skills you own.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <select
                  className="nf-select"
                  value={selectedSkill?.id ?? ""}
                  onChange={(event) => setSelectedSkillId(event.target.value)}
                  disabled={!skills.length}
                >
                  <option value="">Select skill</option>
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
                <input
                  className="nf-input"
                  placeholder="SOP name"
                  value={sopName}
                  onChange={(event) => setSopName(event.target.value)}
                />
                <textarea
                  className="nf-textarea min-h-[90px]"
                  placeholder="SOP description"
                  value={sopDescription}
                  onChange={(event) => setSopDescription(event.target.value)}
                />
                <textarea
                  className="nf-textarea min-h-[150px] font-mono text-[11px]"
                  placeholder="SOP config JSON"
                  value={sopConfig}
                  onChange={(event) => setSopConfig(event.target.value)}
                />
                <label className="flex items-center gap-2 text-xs nf-text-secondary">
                  <input
                    type="checkbox"
                    checked={sopIsDefault}
                    onChange={(event) => setSopIsDefault(event.target.checked)}
                  />
                  Set as default SOP for this skill
                </label>
                <button
                  type="button"
                  className="nf-btn"
                  onClick={createSop}
                  disabled={pending || !selectedSkill || !sopName.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add SOP
                </button>
              </div>
            </section>
          </aside>

          <main className="nf-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="nf-h2">My Capability Records</h2>
              <span className="nf-tag">{skillCountLabel}</span>
            </div>

            {loading ? (
              <div className="nf-empty min-h-[240px]">Loading skills...</div>
            ) : skills.length === 0 ? (
              <div className="nf-empty min-h-[240px]">No skills yet.</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {skills.map((skill) => (
                  <article
                    key={skill.id}
                    className={cn(
                      "nf-panel cursor-pointer p-4",
                      selectedSkill?.id === skill.id &&
                        "border-[rgba(255,109,31,0.45)] shadow-[var(--nf-glow-sm)]"
                    )}
                    onClick={() => setSelectedSkillId(skill.id)}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium nf-text-primary">{skill.name}</h3>
                      <span className="nf-tag nf-tag-muted">{skill.category ?? "skill"}</span>
                    </div>
                    <p className="text-xs leading-5 nf-text-secondary">{skill.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {skill.sops.length === 0 ? (
                        <span className="nf-tag nf-tag-muted">No SOP</span>
                      ) : (
                        skill.sops.map((sop) => (
                          <span key={sop.id} className="nf-tag nf-tag-muted">
                            {sop.name}
                            {sop.isDefault ? " / default" : ""}
                          </span>
                        ))
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
