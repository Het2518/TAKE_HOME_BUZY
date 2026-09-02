"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

// ── SVG Icons ─────────────────────────────────────────────────
const IconTasks = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IconUsers = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconPlus = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconFolder = (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconChevronDown = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconArchive = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8"/>
    <rect x="1" y="3" width="22" height="5"/>
    <line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
);

// Deterministic color strip based on project key
const PROJECT_COLORS = [
  "#4C9BF0", "#30A46C", "#E5A20D", "#E5484D",
  "#A78BFA", "#FB923C", "#38BDF8", "#F472B6",
];
function getProjectColor(key) {
  if (!key) return PROJECT_COLORS[0];
  let hash = 0;
  for (let c of key) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

function ProjectCard({ project, isManager, onToggleArchive, index }) {
  const color = getProjectColor(project.key);
  const total = project._count?.tasks ?? 0;
  const done = project._count?.doneTasks ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <a
      href={`/projects/${project.id}`}
      className="card animate-slide-up"
      style={{
        color: "inherit",
        animationDelay: `${index * 40}ms`,
        display: "flex",
        flexDirection: "column",
        opacity: project.archived ? 0.55 : 1,
        position: "relative",
        overflow: "hidden",
        padding: 0,
        gap: 0,
      }}
    >
      {/* Color accent strip */}
      <div style={{ height: 3, background: color, borderRadius: "var(--radius-md) var(--radius-md) 0 0" }} />

      <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <span className="badge" style={{ background: `${color}18`, color, border: "none", fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>
            {project.key}
          </span>
          {project.archived && (
            <span className="badge" style={{ fontSize: 10, color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              Archived
            </span>
          )}
        </div>

        {/* Name + description */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 5px", fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {project.name}
          </h3>
          <p style={{
            color: "var(--text-dim)",
            fontSize: 12.5,
            margin: 0,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {project.description || "No description provided."}
          </p>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>
              <span>Progress</span>
              <span style={{ fontWeight: 500, color: pct === 100 ? "var(--success)" : "var(--text-secondary)" }}>
                {pct}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-bar-fill${pct === 100 ? "" : " blue"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border)", marginTop: "auto" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span className="flex gap-4" style={{ color: "var(--text-dim)", fontSize: 12 }} title="Tasks">
              {IconTasks}
              <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{total}</span>
            </span>
            <span className="flex gap-4" style={{ color: "var(--text-dim)", fontSize: 12 }} title="Members">
              {IconUsers}
              <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{project._count?.members ?? 0}</span>
            </span>
          </div>

          {isManager && (
            <button
              className="ghost"
              style={{ padding: "3px 8px", fontSize: 11, color: "var(--text-muted)", gap: 4 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleArchive(project);
              }}
            >
              {IconArchive}
              {project.archived ? "Restore" : "Archive"}
            </button>
          )}
        </div>
      </div>
    </a>
  );
}

function EmptyState({ isManager, onNew }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        padding: "56px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{IconFolder}</div>
      <h3 style={{ fontSize: 15, color: "var(--text)", marginBottom: 2 }}>No projects yet</h3>
      <p style={{ color: "var(--text-dim)", fontSize: 13, maxWidth: 280, margin: 0 }}>
        {isManager
          ? "Create your first project to start organizing tasks and collaborating with your team."
          : "You haven't been added to any projects yet. Ask your manager to invite you."}
      </p>
      {isManager && (
        <button className="primary" style={{ marginTop: 8 }} onClick={onNew}>
          {IconPlus} New project
        </button>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useCurrentUser();
  const { addToast } = useToast();
  const [projects, setProjects] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", name: "", description: "", ownerId: "" });
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [users, setUsers] = useState([]);

  function load(archived = showArchived) {
    const url = archived ? "/api/projects?includeArchived=true" : "/api/projects";
    fetch(url).then((r) => r.json()).then(setProjects);
  }

  useEffect(() => { load(showArchived); }, [showArchived]);

  useEffect(() => {
    if (user?.role === "MANAGER") {
      fetch("/api/users").then((r) => r.json()).then(setUsers);
    }
  }, [user]);

  useEffect(() => {
    if (user && !form.ownerId) setForm((f) => ({ ...f, ownerId: user.id }));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error);
      return;
    }
    setForm({ key: "", name: "", description: "", ownerId: user.id });
    setShowForm(false);
    addToast("Project created", "success");
    load();
  }

  async function toggleArchive(project) {
    await fetch(`/api/projects/${project.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project.archived }),
    });
    addToast(project.archived ? "Project restored" : "Project archived", "info");
    load();
  }

  const activeCount = projects ? projects.filter((p) => !p.archived).length : 0;
  const isManager = user?.role === "MANAGER";

  return (
    <div className="container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title">
          <h1>Projects</h1>
          {projects && (
            <div className="page-header-subtitle">
              {activeCount} active project{activeCount !== 1 ? "s" : ""}
              {showArchived && projects.filter((p) => p.archived).length > 0 && (
                <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                  · {projects.filter((p) => p.archived).length} archived
                </span>
              )}
            </div>
          )}
        </div>
        <div className="page-header-actions">
          <button
            className="ghost"
            onClick={() => setShowArchived((s) => !s)}
            style={{ fontSize: 12 }}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          {isManager && (
            <button
              className={showForm ? "secondary" : "primary"}
              onClick={() => setShowForm((s) => !s)}
            >
              {showForm ? "Cancel" : <>{IconPlus} New project</>}
            </button>
          )}
        </div>
      </div>

      {/* Create Project Form */}
      {showForm && (
        <div className="card animate-slide-down" style={{ maxWidth: 580 }}>
          <h3 style={{ marginBottom: 20, fontSize: 15 }}>New project</h3>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
              <label className="field-label">
                Key
                <input
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })}
                  required
                  maxLength={5}
                  placeholder="e.g. ACM"
                  style={{ fontFamily: "monospace", fontWeight: 600 }}
                />
              </label>
              <label className="field-label">
                Project Name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="My awesome project"
                />
              </label>
            </div>
            <label className="field-label">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Briefly describe the purpose of this project…"
              />
            </label>
            <label className="field-label">
              Project Owner
              <select
                value={form.ownerId}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                required
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === "MANAGER" ? "Manager" : "Member"})
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <div style={{ padding: "10px 12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-sm)", color: "var(--danger)", fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary">Create project</button>
            </div>
          </form>
        </div>
      )}

      {/* Project grid */}
      {!projects ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: 220, borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {projects.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              isManager={isManager}
              onToggleArchive={toggleArchive}
              index={i}
            />
          ))}
          {projects.length === 0 && (
            <EmptyState isManager={isManager} onNew={() => setShowForm(true)} />
          )}
        </div>
      )}
    </div>
  );
}
