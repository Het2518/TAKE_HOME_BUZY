"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import CustomFieldsPanel from "@/components/CustomFieldsPanel";

export default function ProjectDetailPage({ params }) {
  const { user } = useCurrentUser();
  const { projectId } = params;
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [memberError, setMemberError] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "MEDIUM", dueDate: "" });

  function loadProject() {
    fetch(`/api/projects/${projectId}`).then((r) => r.json()).then(setProject);
  }
  function loadTasks() {
    fetch(`/api/tasks?projectId=${projectId}&pageSize=100`).then((r) => r.json()).then((d) => setTasks(d.tasks || []));
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

  if (!project) return <p>Loading...</p>;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="flex" style={{ color: "var(--text-dim)", fontSize: 13 }}>
          <a href="/projects">Projects</a> / {project.key}
        </div>
        <h1>{project.name}</h1>
        <p style={{ color: "var(--text-dim)" }}>{project.description}</p>
      </div>

      <div className="card">
        <div className="flex-between">
          <h3>Members</h3>
          {user?.role === "MANAGER" && (
            <form onSubmit={handleAddMember} className="flex">
              <input placeholder="user email" type="email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} />
              <button type="submit">Add</button>
            </form>
          )}
        </div>
        {memberError && <p style={{ color: "var(--danger)", fontSize: 13 }}>{memberError}</p>}
        <div className="flex" style={{ flexWrap: "wrap" }}>
          {project.members?.map((m) => (
            <span key={m.id} className="badge flex" style={{ gap: 6, paddingRight: 4 }}>
              {m.user.name}
              {user?.role === "MANAGER" && (
                <button
                  className="secondary"
                  style={{ padding: "0 4px", border: "none", fontSize: 12, color: "var(--danger)" }}
                  onClick={() => handleRemoveMember(m.user.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-between">
        <h3>Tasks ({tasks.length})</h3>
        <button onClick={() => setShowNewTask((s) => !s)}>{showNewTask ? "Cancel" : "New task"}</button>
      </div>

      {showNewTask && (
        <form onSubmit={handleCreateTask} className="card grid" style={{ gap: 10, maxWidth: 480 }}>
          <input placeholder="Title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
          <textarea placeholder="Description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
          <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
          <button type="submit">Create task</button>
        </form>
      )}

      <table>
        <thead>
          <tr><th>Title</th><th>Status</th><th>Priority</th><th>Due</th><th>Assignees</th></tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td><a href={`/tasks/${t.id}`}>{t.title}</a></td>
              <td><span className={`badge ${t.status}`}>{t.status}</span></td>
              <td className={`priority-${t.priority}`}>{t.priority}</td>
              <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
              <td>{t.assignees.map((a) => a.user.name).join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Custom Field Definitions (stretch goal) ── */}
      <div className="card">
        <CustomFieldsPanel projectId={projectId} isManager={user?.role === "MANAGER"} />
      </div>
    </div>
  );
}
