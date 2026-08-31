"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import TimeTracker from "@/components/TimeTracker";
import { highlightMentions, MentionInput } from "@/components/Mentions";
import CustomFieldValues from "@/components/CustomFieldValues";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function TaskDetailPage({ params }) {
  const { taskId } = params;
  const { user } = useCurrentUser();
  const [task, setTask] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [comment, setComment] = useState("");
  const [statusError, setStatusError] = useState("");
  const [pendingTarget, setPendingTarget] = useState(null);
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Assignee management
  const [allUsers, setAllUsers] = useState([]);
  const [addAssigneeId, setAddAssigneeId] = useState("");
  const [isAddingAssignee, setIsAddingAssignee] = useState(false);

  function loadTask() {
    return fetch(`/api/tasks/${taskId}`).then((r) => r.json()).then(setTask);
  }
  function loadTimeline() {
    return fetch(`/api/tasks/${taskId}/timeline`).then((r) => r.json()).then(setTimeline);
  }
  useEffect(() => { loadTask(); loadTimeline(); }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate the user list for the assignee picker
  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setAllUsers).catch(() => {});
  }, []);

  // When the task loads, pre-fill the edit form with current values
  useEffect(() => {
    if (task) {
      setEditForm({
        title: task.title,
        description: task.description ?? "",
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
      });
    }
  }, [task]);

  // Compute legal transitions client-side, mirroring src/lib/taskStateMachine.js,
  // purely so the UI only offers legal moves — the server re-validates independently.
  function legalMoves() {
    if (!task) return [];
    const hasIncompleteBlockers = task.blockedBy?.some((b) => b.blockingTask.status !== "DONE");
    if (task.status === "BLOCKED") {
      return task.blockedFromStatus ? [{ label: `Unblock → ${task.blockedFromStatus}`, target: "UNBLOCK" }] : [];
    }
    const base = {
      BACKLOG: ["IN_PROGRESS"],
      IN_PROGRESS: ["IN_REVIEW", "BLOCKED"],
      IN_REVIEW: ["DONE", "IN_PROGRESS", "BLOCKED"],
      DONE: ["IN_PROGRESS"],
    }[task.status] || [];
    return base
      .filter((s) => !(s === "DONE" && hasIncompleteBlockers))
      .map((s) => ({ label: `Move to ${s}`, target: s }));
  }

  // Optimistic status change: badge updates instantly before the network request resolves.
  // Rolls back if the server rejects it.
  async function changeStatus(target) {
    setStatusError("");
    setPendingTarget(target);
    const previousStatus = task.status;
    const optimisticStatus = target === "UNBLOCK" ? task.blockedFromStatus : target;
    setTask((t) => ({ ...t, status: optimisticStatus }));

    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: target }),
      });
      if (!res.ok) {
        const d = await res.json();
        setTask((t) => ({ ...t, status: previousStatus })); // roll back
        setStatusError(d.error);
        return;
      }
      await Promise.all([loadTask(), loadTimeline()]);
    } finally {
      setPendingTarget(null);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError("");
    setIsSavingEdit(true);
    const body = {
      title: editForm.title,
      description: editForm.description,
      priority: editForm.priority,
      dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null,
    };
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setIsSavingEdit(false);
    if (!res.ok) {
      const d = await res.json();
      setEditError(d.error || "Could not save changes");
      return;
    }
    setIsEditing(false);
    await Promise.all([loadTask(), loadTimeline()]);
  }

  async function handleAddAssignee(e) {
    e.preventDefault();
    if (!addAssigneeId) return;
    setIsAddingAssignee(true);
    await fetch(`/api/tasks/${taskId}/assignees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: addAssigneeId }),
    });
    setAddAssigneeId("");
    setIsAddingAssignee(false);
    loadTask();
    loadTimeline();
  }

  async function handleRemoveAssignee(userId) {
    await fetch(`/api/tasks/${taskId}/assignees?userId=${userId}`, { method: "DELETE" });
    loadTask();
    loadTimeline();
  }

  async function handleDeleteTask() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    window.location.href = "/tasks";
  }

  async function postComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setIsPostingComment(true);
    const text = comment;
    setComment("");
    try {
      await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      await loadTimeline();
    } finally {
      setIsPostingComment(false);
    }
  }

  if (!task) {
    return (
      <div className="flex" style={{ justifyContent: "center", paddingTop: 60 }}>
        <span className="spinner" /> <span style={{ color: "var(--text-dim)" }}>Loading task…</span>
      </div>
    );
  }

  // Users who are not already assigned to this task (for the add-assignee picker)
  const assignedIds = new Set(task.assignees.map((a) => a.userId));
  const unassignedUsers = allUsers.filter((u) => !assignedIds.has(u.id));

  // Build a userId → name lookup from the already-fetched allUsers list.
  // Used in describeEvent to show names in ASSIGNED/UNASSIGNED timeline entries.
  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      {/* ── Left column: task detail + status + edit + assignees ── */}
      <div className="grid" style={{ gap: 16 }}>

        {/* Breadcrumb + header */}
        <div>
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
            <a href={`/projects/${task.project.id}`}>{task.project.key}</a> / Task
          </div>
          <div className="flex-between" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>{task.title}</h1>
            <div className="flex">
              <button className="secondary" onClick={() => setIsEditing((v) => !v)}>
                {isEditing ? "Cancel edit" : "Edit"}
              </button>
              {user?.role === "MANAGER" && (
                <button
                  className="secondary"
                  style={{ color: "var(--danger)" }}
                  onClick={handleDeleteTask}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          {!isEditing && (
            <>
              <p style={{ marginTop: 8 }}>{task.description}</p>
              <div className="flex" style={{ marginTop: 8 }}>
                <span className={`badge ${task.status}`}>{task.status}</span>
                <span className={`priority-${task.priority}`}>{task.priority} priority</span>
                {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
              </div>
            </>
          )}
        </div>

        {/* ── Edit form (goal 3) ── */}
        {isEditing && (
          <form onSubmit={saveEdit} className="card grid" style={{ gap: 12 }}>
            <h3 style={{ margin: 0 }}>Edit task</h3>
            <label style={{ fontSize: 13 }}>
              Title
              <input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Description
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 13 }}>
              Priority
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              Due date
              <input
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                style={{ display: "block", marginTop: 4 }}
              />
            </label>
            {editError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{editError}</p>}
            <div className="flex">
              <button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="secondary" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </form>
        )}

        {/* ── Status transitions ── */}
        <div className="card">
          <h3>Status</h3>
          <div className="flex" style={{ flexWrap: "wrap" }}>
            {legalMoves().map((m) => (
              <button
                key={m.target}
                onClick={() => changeStatus(m.target)}
                disabled={pendingTarget !== null}
              >
                {pendingTarget === m.target ? <span className="spinner" /> : m.label}
              </button>
            ))}
            {legalMoves().length === 0 && <span style={{ color: "var(--text-dim)" }}>No legal moves right now.</span>}
          </div>
          {statusError && <p style={{ color: "var(--danger)", marginTop: 8 }}>{statusError}</p>}
        </div>

        {/* ── Blocking tasks ── */}
        {task.blockedBy?.length > 0 && (
          <div className="card">
            <h3>Blocked by</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {task.blockedBy.map((b) => (
                <li key={b.blockingTask.id}>
                  <a href={`/tasks/${b.blockingTask.id}`}>{b.blockingTask.title}</a>{" "}
                  <span className={`badge ${b.blockingTask.status}`}>{b.blockingTask.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Assignees (goal 5) ── */}
        <div className="card">
          <h3>Assignees</h3>
          <div className="flex" style={{ flexWrap: "wrap", marginBottom: 10 }}>
            {task.assignees.map((a) => (
              <span key={a.id} className="badge flex" style={{ gap: 4, paddingRight: 4 }}>
                {a.user.name}
                <button
                  className="secondary"
                  style={{ padding: "0 4px", border: "none", fontSize: 12, color: "var(--danger)" }}
                  onClick={() => handleRemoveAssignee(a.user.id)}
                >
                  ×
                </button>
              </span>
            ))}
            {task.assignees.length === 0 && <span style={{ color: "var(--text-dim)" }}>Unassigned</span>}
          </div>
          {unassignedUsers.length > 0 && (
            <form onSubmit={handleAddAssignee} className="flex">
              <select value={addAssigneeId} onChange={(e) => setAddAssigneeId(e.target.value)}>
                <option value="">Add assignee…</option>
                {unassignedUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button type="submit" disabled={isAddingAssignee || !addAssigneeId}>
                {isAddingAssignee ? <span className="spinner" /> : "Add"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Right column: timeline + comments (goal 9) ── */}
      <div className="card" style={{ maxHeight: 700, overflowY: "auto" }}>
        <h3>Timeline</h3>
        <div className="grid" style={{ gap: 10 }}>
          {timeline.map((e) => (
            <div key={e.id} style={{ borderLeft: "2px solid var(--border)", paddingLeft: 10, fontSize: 13 }}>
              <div style={{ color: "var(--text-dim)" }}>
                {new Date(e.createdAt).toLocaleString()} — {e.user.name}
              </div>
              <div>{describeEvent(e, userMap)}</div>
            </div>
          ))}
          {timeline.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No activity yet.</p>}
        </div>
        <form onSubmit={postComment} className="flex" style={{ marginTop: 12 }}>
          <MentionInput
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            users={allUsers}
            placeholder="Add a comment… type @ to mention someone"
          />
          <button type="submit" disabled={isPostingComment || !comment.trim()}>
            {isPostingComment ? <span className="spinner" /> : "Post"}
          </button>
        </form>
      </div>

      {/* ── Time Tracker (stretch goal) ── */}
      <TimeTracker taskId={taskId} />

      {/* ── Custom Fields (stretch goal) ── */}
      <CustomFieldValues taskId={taskId} />
    </div>
  );
}

function describeEvent(e, userMap = {}) {
  const name = (id) => userMap[id] || id;
  switch (e.type) {
    case "CREATED": return "Task created.";
    case "STATUS_CHANGE": return `Status changed: ${e.oldValue} \u2192 ${e.newValue}`;
    case "FIELD_CHANGE":
      if (e.field === "blockedBy") return "Blocking tasks updated.";
      return `${e.field} changed: "${e.oldValue ?? ""}" \u2192 "${e.newValue ?? ""}"`;
    case "ASSIGNED": return `Assigned ${name(e.newValue)} to this task.`;
    case "UNASSIGNED": return `Unassigned ${name(e.oldValue)} from this task.`;
    case "COMMENT": return highlightMentions(e.commentText);
    default: return e.type;
  }
}
