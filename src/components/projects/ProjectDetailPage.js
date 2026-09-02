"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import CustomFieldsPanel from "@/components/CustomFieldsPanel";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

const STATUS_LABELS = {
  BACKLOG: "Backlog", IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review", DONE: "Done", BLOCKED: "Blocked",
};
const PRIORITY_LABELS = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

const IconPlus = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconX = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
const IconTasks = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IconEmptyTasks = (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

export default function ProjectDetailPage({ params }) {
  const { user } = useCurrentUser();
  const { projectId } = params;
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [memberError, setMemberError] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
  const [isLoading, setIsLoading] = useState(true);

  function loadProject() {
    fetch(`/api/projects/${projectId}`).then((r) => r.json()).then(setProject);
  }
  function loadTasks() {
    fetch(`/api/tasks?projectId=${projectId}&pageSize=100`)
      .then((r) => r.json())
      .then((d) => {
        setTasks(d.tasks || []);
        setIsLoading(false);
      });
  }
  useEffect(() => {
    loadProject();
    loadTasks();
  }, [projectId]);

  async function handleAddMember(e) {
    e.preventDefault();
    setMemberError("");
    if (!newMemberEmail.trim()) return;
    const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(newMemberEmail.trim())}`);
    if (!res.ok) { setMemberError("No user found with that email"); return; }
    const foundUser = await res.json();
    const addRes = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: foundUser.id }),
    });
    if (!addRes.ok) {
      const d = await addRes.json();
      setMemberError(d.error || "Could not add member");
      return;
    }
    setNewMemberEmail("");
    loadProject();
  }

  async function handleRemoveMember(userId) {
    if (!confirm("Remove this member? They will be unassigned from this project's tasks.")) return;
    await fetch(`/api/projects/${projectId}/members?userId=${userId}`, { method: "DELETE" });
    loadProject();
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
      }),
    });
    setTaskForm({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
    setShowNewTask(false);
    loadTasks();
  }

  if (!project) {
    return (
      <div className="container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="skeleton" style={{ height: 28, width: 260, borderRadius: "var(--radius-sm)" }} />
        <div className="skeleton" style={{ height: 16, width: 180, borderRadius: "var(--radius-sm)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
          <div className="skeleton card" style={{ height: 400 }} />
          <div className="skeleton card" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0;

  return (
    <div className="container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-dim)" }}>
        <Link href="/projects" style={{ color: "var(--text-dim)", opacity: 1 }}>Projects</Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <span style={{ color: "var(--text)", fontWeight: 500 }}>{project.key}</span>
      </div>

      {/* Project header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", padding: "2px 7px", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)" }}>
              {project.key}
            </span>
            {project.archived && <span className="badge BACKLOG">Archived</span>}
          </div>
          <h1 style={{ marginBottom: 6, fontSize: 22 }}>{project.name}</h1>
          {project.description && (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5, maxWidth: 560, margin: 0, lineHeight: 1.6 }}>
              {project.description}
            </p>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 12.5, color: "var(--text-dim)" }}>
            <span className="flex gap-4">{IconTasks} <strong style={{ color: "var(--text-secondary)" }}>{total}</strong> tasks</span>
            <span className="flex gap-4">{IconUsers} <strong style={{ color: "var(--text-secondary)" }}>{project.members?.length ?? 0}</strong> members</span>
            {total > 0 && (
              <span style={{ color: pct === 100 ? "var(--success)" : "var(--text-dim)" }}>
                <strong style={{ color: pct === 100 ? "var(--success)" : "var(--text-secondary)" }}>{pct}%</strong> complete
              </span>
            )}
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="progress-bar" style={{ marginTop: 10, maxWidth: 320 }}>
              <div className={`progress-bar-fill${pct === 100 ? "" : " blue"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        {user?.role === "MANAGER" && (
          <button
            className="secondary"
            onClick={async () => {
              await fetch(`/api/projects/${project.id}/archive`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ archived: !project.archived }),
              });
              loadProject();
            }}
            style={{ flexShrink: 0, fontSize: 12 }}
          >
            {project.archived ? "Restore" : "Archive"}
          </button>
        )}
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 264px", gap: 16, alignItems: "start" }}>

        {/* Tasks panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Tasks header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-dim)" }}>
              Tasks ({tasks.length})
            </div>
            <button
              className={showNewTask ? "secondary" : "primary"}
              onClick={() => setShowNewTask((s) => !s)}
              style={{ fontSize: 12, padding: "5px 10px" }}
            >
              {showNewTask ? "Cancel" : <>{IconPlus} New task</>}
            </button>
          </div>

          {/* New task form */}
          {showNewTask && (
            <form
              onSubmit={handleCreateTask}
              className="card animate-slide-down"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                <input
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                  autoFocus
                />
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  style={{ width: "auto" }}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <textarea
                placeholder="Description (optional)…"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={2}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  style={{ width: "auto" }}
                />
                <button type="submit" className="primary" style={{ fontSize: 12 }}>
                  Create task
                </button>
              </div>
            </form>
          )}

          {/* Task table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {isLoading ? (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: 36, borderRadius: "var(--radius-sm)" }} />
                ))}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th style={{ width: 130 }}>Status</th>
                      <th style={{ width: 100 }}>Priority</th>
                      <th style={{ width: 90 }}>Due</th>
                      <th style={{ width: 80 }}>Assignees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 0, border: "none" }}>
                          <div className="empty-state">
                            <div className="empty-state-icon">{IconEmptyTasks}</div>
                            <h3>No tasks yet</h3>
                            <p>Create the first task to get this project moving.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      tasks.map((t) => {
                        const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                        return (
                          <tr key={t.id}>
                            <td>
                              <Link href={`/tasks/${t.id}`} style={{ fontWeight: 500, fontSize: 13, color: "var(--text)" }}>
                                {t.title}
                              </Link>
                            </td>
                            <td>
                              <span className="status-indicator">
                                <span className={`status-dot ${t.status}`} />
                                <span style={{ color: `var(--status-${t.status?.toLowerCase().replace("_", "") || "backlog"})`, fontSize: 12 }}>
                                  {STATUS_LABELS[t.status] || t.status}
                                </span>
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, fontWeight: 500, color: `var(--priority-${t.priority?.toLowerCase() || "medium"})` }}>
                                {PRIORITY_LABELS[t.priority] || t.priority}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: isOverdue ? "var(--danger)" : "var(--text-dim)", fontWeight: isOverdue ? 500 : 400 }}>
                                {t.dueDate ? new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                              </span>
                            </td>
                            <td>
                              <div className="avatar-group">
                                {t.assignees.length > 0
                                  ? t.assignees.slice(0, 3).map((a) => (
                                      <div key={a.id} className="avatar sm" title={a.user.name}>
                                        {a.user.name.charAt(0).toUpperCase()}
                                      </div>
                                    ))
                                  : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                                }
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Custom fields */}
          <div className="card">
            <CustomFieldsPanel projectId={projectId} isManager={user?.role === "MANAGER"} />
          </div>
        </div>

        {/* Members sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-dim)" }}>
            Team ({project.members?.length ?? 0})
          </div>

          <div className="card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {project.members?.length === 0 && (
              <span style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>No members yet.</span>
            )}

            {project.members?.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 8px", borderRadius: "var(--radius-sm)",
                  transition: "background 120ms ease",
                }}
                className="member-row"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div className="avatar">{m.user.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{m.user.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.user.role === "MANAGER" ? "Manager" : "Member"}</div>
                  </div>
                </div>
                {user?.role === "MANAGER" && (
                  <button
                    className="ghost icon-btn"
                    onClick={() => handleRemoveMember(m.user.id)}
                    title="Remove member"
                    style={{ color: "var(--text-muted)", opacity: 0.6 }}
                  >
                    {IconX}
                  </button>
                )}
              </div>
            ))}

            {/* Add member form */}
            {user?.role === "MANAGER" && (
              <form
                onSubmit={handleAddMember}
                style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-dim)" }}>Add member by email</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <button type="submit" className="secondary" style={{ fontSize: 12, padding: "5px 10px", flexShrink: 0 }}>
                    Add
                  </button>
                </div>
                {memberError && (
                  <span style={{ fontSize: 12, color: "var(--danger)" }}>{memberError}</span>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
