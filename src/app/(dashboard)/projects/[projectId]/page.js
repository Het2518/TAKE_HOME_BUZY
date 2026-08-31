"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import CustomFieldsPanel from "@/components/CustomFieldsPanel";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

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
    if (!res.ok) {
      setMemberError("No user found with that email");
      return;
    }
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

  if (!project) return (
    <div className="container animate-fade-in">
      <Skeleton height="32px" width="200px" style={{ marginBottom: 16 }} />
      <Skeleton height="20px" width="400px" style={{ marginBottom: 32 }} />
      <Skeleton height="300px" className="card" />
    </div>
  );

  return (
    <div className="container grid animate-fade-in" style={{ gap: 32 }}>
      <div>
        <div className="flex" style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 12 }}>
          <Link href="/projects" className="nav-link" style={{ margin: 0, padding: 0 }}>Projects</Link> 
          <span>/</span> 
          <span style={{ color: "var(--text)" }}>{project.key}</span>
        </div>
        <div className="flex-between" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0 }}>{project.name}</h1>
            <p style={{ color: "var(--text-dim)", marginTop: 8, fontSize: 15, maxWidth: 600 }}>{project.description}</p>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
        
        {/* Main tasks area */}
        <div className="grid" style={{ gap: 24 }}>
          <div className="flex-between">
            <h3 style={{ margin: 0 }}>Tasks ({tasks.length})</h3>
            <button className="primary" onClick={() => setShowNewTask((s) => !s)}>
              {showNewTask ? "Cancel" : "New task"}
            </button>
          </div>

          {showNewTask && (
            <form onSubmit={handleCreateTask} className="card grid animate-slide-down" style={{ gap: 16 }}>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <input placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required autoFocus />
                <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                  <option value="LOW">Low priority</option>
                  <option value="MEDIUM">Medium priority</option>
                  <option value="HIGH">High priority</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <textarea placeholder="Add a description..." value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={3} />
              <div className="flex-between">
                <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} style={{ width: "auto" }} />
                <button type="submit" className="primary">Create task</button>
              </div>
            </form>
          )}

          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Assignees</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} style={{ padding: 24 }}><Skeleton height="24px" /></td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-dim)", padding: 48 }}>No tasks in this project yet.</td></tr>
                ) : tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 500 }}><Link href={`/tasks/${t.id}`}>{t.title}</Link></td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td className={`priority-${t.priority}`}>{t.priority}</td>
                    <td style={{ color: "var(--text-dim)" }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                    <td>
                      <div className="avatar-group">
                        {t.assignees.length > 0 
                          ? t.assignees.map((a) => <div key={a.id} className="avatar" title={a.user.name}>{a.user.name.charAt(0)}</div>)
                          : <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Unassigned</span>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="card">
            <CustomFieldsPanel projectId={projectId} isManager={user?.role === "MANAGER"} />
          </div>
        </div>

        {/* Sidebar / Members panel */}
        <div className="card grid" style={{ gap: 20 }}>
          <h3 style={{ margin: 0 }}>Team</h3>
          
          <div className="flex-column" style={{ gap: 12 }}>
            {project.members?.map((m) => (
              <div key={m.id} className="flex-between" style={{ padding: "8px 12px", background: "var(--panel-hover)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div className="flex" style={{ gap: 10 }}>
                  <div className="avatar">{m.user.name.charAt(0)}</div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{m.user.name}</span>
                </div>
                {user?.role === "MANAGER" && (
                  <button
                    className="ghost"
                    style={{ padding: "4px", minWidth: 24, height: 24, borderRadius: "50%" }}
                    onClick={() => handleRemoveMember(m.user.id)}
                    title="Remove member"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {project.members?.length === 0 && <span style={{ color: "var(--text-dim)", fontSize: 14 }}>No members.</span>}
          </div>

          {user?.role === "MANAGER" && (
            <form onSubmit={handleAddMember} className="flex-column" style={{ gap: 8, marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Add Member</span>
              <div className="flex" style={{ gap: 8 }}>
                <input placeholder="Email address" type="email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} style={{ flex: 1 }} />
                <button type="submit" className="secondary">Add</button>
              </div>
              {memberError && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{memberError}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
