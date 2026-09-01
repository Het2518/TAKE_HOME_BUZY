"use client";
import { useEffect, useState, useRef } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import TimeTracker from "@/components/TimeTracker";
import { highlightMentions, MentionInput } from "@/components/Mentions";
import CustomFieldValues from "@/components/CustomFieldValues";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function relativeTime(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusProgression({ currentStatus, legalMoves, pendingTarget, onTransition }) {
  const ORDER = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  
  // Create a linear progression UI
  return (
    <div className="flex" style={{ gap: 4, flexWrap: "wrap" }}>
      {ORDER.map((status, i) => {
        const isCurrent = status === currentStatus;
        const move = legalMoves.find(m => m.target === status);
        const isLegal = !!move;
        
        let className = "badge";
        if (isCurrent) className += ` ${status}`;
        
        return (
          <div key={status} className="flex" style={{ gap: 4 }}>
            {isCurrent ? (
              <span className={className}>{status}</span>
            ) : isLegal ? (
              <button 
                className="secondary" 
                style={{ padding: "4px 8px", fontSize: 12, borderRadius: 999 }}
                disabled={pendingTarget !== null}
                onClick={() => onTransition(status)}
              >
                {pendingTarget === status ? <span className="spinner" style={{ width: 12, height: 12 }} /> : `→ ${status}`}
              </button>
            ) : (
              <span className="badge" style={{ opacity: 0.4, background: "transparent" }}>{status}</span>
            )}
            {i < ORDER.length - 1 && <span style={{ color: "var(--border)" }}>›</span>}
          </div>
        );
      })}
      
      {/* Blocked state is special */}
      <div style={{ width: "100%", marginTop: 8 }} />
      {currentStatus === "BLOCKED" ? (
        <span className="badge BLOCKED">BLOCKED</span>
      ) : (
        legalMoves.find(m => m.target === "BLOCKED" || m.target === "UNBLOCK") && (
          <button 
            className="danger-ghost" 
            style={{ padding: "4px 8px", fontSize: 12, borderRadius: 999 }}
            disabled={pendingTarget !== null}
            onClick={() => onTransition(currentStatus === "BLOCKED" ? "UNBLOCK" : "BLOCKED")}
          >
            {pendingTarget === "BLOCKED" || pendingTarget === "UNBLOCK" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : (currentStatus === "BLOCKED" ? "Unblock" : "Mark Blocked")}
          </button>
        )
      )}
    </div>
  );
}

export default function TaskDetailPage({ params }) {
  const { taskId } = params;
  const { user } = useCurrentUser();
  const { addToast } = useToast();
  const [task, setTask] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [comment, setComment] = useState("");
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

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setAllUsers).catch(() => {});
  }, []);

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

  function legalMoves() {
    if (!task) return [];
    const hasIncompleteBlockers = task.blockedBy?.some((b) => b.blockingTask.status !== "DONE");
    if (task.status === "BLOCKED") {
      return task.blockedFromStatus ? [{ label: `Unblock`, target: "UNBLOCK" }] : [];
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

  async function changeStatus(target) {
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
        setTask((t) => ({ ...t, status: previousStatus })); // rollback
        addToast(d.error || "Failed to update status", "error");
        return;
      }
      addToast(`Status moved to ${optimisticStatus}`, "success");
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
    addToast("Task updated successfully", "success");
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
    addToast("Assignee added", "success");
    loadTask();
    loadTimeline();
  }

  async function handleRemoveAssignee(userId) {
    await fetch(`/api/tasks/${taskId}/assignees?userId=${userId}`, { method: "DELETE" });
    addToast("Assignee removed", "info");
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
      addToast("Comment posted", "success");
      await loadTimeline();
    } finally {
      setIsPostingComment(false);
    }
  }

  if (!task) {
    return (
      <div className="grid container animate-fade-in" style={{ gridTemplateColumns: "2fr 1fr", gap: 32 }}>
        <div className="grid" style={{ gap: 24 }}>
          <Skeleton height="150px" className="card" />
          <Skeleton height="200px" className="card" />
        </div>
        <Skeleton height="600px" className="card" />
      </div>
    );
  }

  const assignedIds = new Set(task.assignees.map((a) => a.userId));
  const unassignedUsers = allUsers.filter((u) => !assignedIds.has(u.id));
  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.name]));

  return (
    <div className="grid container animate-fade-in" style={{ gridTemplateColumns: "1fr", gap: 32 }}>
      {/* Responsive layout: 1 col on mobile, 2 col on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
        
        {/* ── Left column: task detail + status + edit + assignees ── */}
        <div className="grid" style={{ gap: 24, alignContent: "start" }}>
          
          {/* Header Card */}
          <div className="card">
            <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
              <a href={`/projects/${task.project.id}`}>{task.project.key}</a> / Task
            </div>
            <div className="flex-between" style={{ alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
              <h1 style={{ margin: 0 }}>{task.title}</h1>
              <div className="flex">
                <button className="secondary" onClick={() => setIsEditing((v) => !v)}>
                  {isEditing ? "Cancel edit" : "Edit"}
                </button>
                {user?.role === "MANAGER" && (
                  <button className="danger-ghost" onClick={handleDeleteTask}>
                    Delete
                  </button>
                )}
              </div>
            </div>
            
            {!isEditing ? (
              <>
                <p style={{ marginTop: 0, color: "var(--text-dim)" }}>{task.description || "No description provided."}</p>
                <div className="flex" style={{ marginTop: 16, flexWrap: "wrap", gap: 12 }}>
                  <span className={`priority-${task.priority}`}>{task.priority} priority</span>
                  {task.dueDate && <span style={{ color: "var(--text-dim)", fontSize: 14 }}>📅 Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                </div>
              </>
            ) : (
              <form onSubmit={saveEdit} className="grid" style={{ gap: 16, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Title
                  <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required style={{ marginTop: 6 }} />
                </label>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Description
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} style={{ marginTop: 6 }} />
                </label>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>
                    Priority
                    <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} style={{ marginTop: 6 }}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 500 }}>
                    Due date
                    <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} style={{ marginTop: 6 }} />
                  </label>
                </div>
                {editError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{editError}</p>}
                <div className="flex">
                  <button type="submit" className="primary" disabled={isSavingEdit}>
                    {isSavingEdit ? "Saving…" : "Save changes"}
                  </button>
                  <button type="button" className="ghost" onClick={() => setIsEditing(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>

          {/* Status Transitions */}
          <div className="card">
            <h3 style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>Status Progression</h3>
            <StatusProgression 
              currentStatus={task.status} 
              legalMoves={legalMoves()} 
              pendingTarget={pendingTarget}
              onTransition={changeStatus}
            />
          </div>

          {/* Blocking tasks */}
          {task.blockedBy?.length > 0 && (
            <div className="card" style={{ borderLeft: "4px solid var(--danger)" }}>
              <h3>Blocked by</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)" }}>
                {task.blockedBy.map((b) => (
                  <li key={b.blockingTask.id} style={{ marginBottom: 8 }}>
                    <a href={`/tasks/${b.blockingTask.id}`}>{b.blockingTask.title}</a>{" "}
                    <span className={`badge ${b.blockingTask.status}`}>{b.blockingTask.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Assignees */}
          <div className="card">
            <h3 style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>Assignees</h3>
            <div className="flex" style={{ flexWrap: "wrap", marginBottom: 16 }}>
              {task.assignees.map((a) => (
                <span key={a.id} className="badge flex animate-slide-up" style={{ gap: 6, padding: "4px 8px", background: "var(--panel-hover)" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", color: "var(--accent-contrast)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                    {a.user.name.charAt(0)}
                  </div>
                  {a.user.name}
                  <button className="ghost" style={{ padding: 2, height: 20, width: 20, minWidth: 20, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => handleRemoveAssignee(a.user.id)}>
                    ×
                  </button>
                </span>
              ))}
              {task.assignees.length === 0 && <span style={{ color: "var(--text-dim)", fontSize: 14 }}>Unassigned</span>}
            </div>
            {unassignedUsers.length > 0 && (
              <form onSubmit={handleAddAssignee} className="flex" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <select value={addAssigneeId} onChange={(e) => setAddAssigneeId(e.target.value)}>
                  <option value="">Add assignee…</option>
                  {unassignedUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button type="submit" className="secondary" disabled={isAddingAssignee || !addAssigneeId}>
                  {isAddingAssignee ? <span className="spinner" /> : "Add"}
                </button>
              </form>
            )}
          </div>

          <CustomFieldValues taskId={taskId} />
          <TimeTracker taskId={taskId} />

        </div>

        {/* ── Right column: timeline + comments (goal 9) ── */}
        <div className="grid" style={{ alignContent: "start", gap: 24 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", position: "sticky", top: 24 }}>
            <h3 style={{ margin: 0, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>Activity</h3>
            
            {/* Timeline scroll area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {timeline.map((e, index) => {
                  const isComment = e.type === "COMMENT";
                  const icon = isComment ? "💬" : e.type === "STATUS_CHANGE" ? "🔄" : e.type === "CREATED" ? "✨" : "📝";
                  
                  return (
                    <div key={e.id} className="animate-slide-up" style={{ display: "flex", gap: 16, paddingBottom: index === timeline.length - 1 ? 0 : 24, position: "relative", animationDelay: `${index * 50}ms` }}>
                      {/* Vertical line connecting events */}
                      {index !== timeline.length - 1 && (
                        <div style={{ position: "absolute", left: 15, top: 32, bottom: -8, width: 2, background: "var(--border)" }} />
                      )}
                      
                      {/* Event Icon/Avatar */}
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: isComment ? "var(--accent-ghost)" : "var(--panel-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, zIndex: 1, flexShrink: 0 }}>
                        {icon}
                      </div>
                      
                      {/* Event Content */}
                      <div style={{ flex: 1, paddingTop: 6 }}>
                        <div className="flex-between" style={{ marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{e.user.name}</span>
                          <span style={{ color: "var(--text-dim)", fontSize: 12 }} title={new Date(e.createdAt).toLocaleString()}>
                            {relativeTime(e.createdAt)}
                          </span>
                        </div>
                        
                        {isComment ? (
                          <div style={{ background: "var(--panel-highlight)", padding: "12px 16px", borderRadius: "0 12px 12px 12px", fontSize: 14, color: "var(--text)" }}>
                            {describeEvent(e, userMap)}
                          </div>
                        ) : (
                          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                            {describeEvent(e, userMap)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {timeline.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>No activity yet.</p>}
              </div>
            </div>

            {/* Comment input pinned to bottom */}
            <form onSubmit={postComment} style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: "auto" }}>
              <div style={{ position: "relative" }}>
                <MentionInput
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  users={allUsers}
                  placeholder="Type @ to mention someone..."
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="submit" className="primary" disabled={isPostingComment || !comment.trim()}>
                    {isPostingComment ? <span className="spinner" /> : "Comment"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function describeEvent(e, userMap = {}) {
  const name = (id) => userMap[id] || id;
  switch (e.type) {
    case "CREATED": return "Created this task";
    case "STATUS_CHANGE": return `Moved from ${e.oldValue} to ${e.newValue}`;
    case "FIELD_CHANGE":
      if (e.field === "blockedBy") return "Updated blockers";
      return `Changed ${e.field} from "${e.oldValue ?? "empty"}" to "${e.newValue ?? "empty"}"`;
    case "ASSIGNED": return `Assigned ${name(e.newValue)}`;
    case "UNASSIGNED": return `Removed ${name(e.oldValue)}`;
    case "COMMENT": return highlightMentions(e.commentText);
    default: return e.type;
  }
}
