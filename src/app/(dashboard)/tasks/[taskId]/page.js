"use client";
import { useEffect, useState } from "react";

export default function TaskDetailPage({ params }) {
  const { taskId } = params;
  const [task, setTask] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [comment, setComment] = useState("");
  const [statusError, setStatusError] = useState("");
  const [pendingTarget, setPendingTarget] = useState(null); // which status button is mid-flight
  const [isPostingComment, setIsPostingComment] = useState(false);

  function loadTask() {
    return fetch(`/api/tasks/${taskId}`).then((r) => r.json()).then(setTask);
  }
  function loadTimeline() {
    return fetch(`/api/tasks/${taskId}/timeline`).then((r) => r.json()).then(setTimeline);
  }
  useEffect(() => { loadTask(); loadTimeline(); }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Optimistic status change: the badge updates the instant you click, before the network
  // request even resolves — this is what makes status changes feel instant rather than
  // "click, wait, eventually see it move." If the server rejects it (e.g. a blocker finished
  // in another tab a second ago), the optimistic change is rolled back and the real error shown.
  async function changeStatus(target, label) {
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

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      <div className="grid" style={{ gap: 16 }}>
        <div>
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
            <a href={`/projects/${task.project.id}`}>{task.project.key}</a> / Task
          </div>
          <h1>{task.title}</h1>
          <p>{task.description}</p>
          <div className="flex">
            <span className={`badge ${task.status}`}>{task.status}</span>
            <span className={`priority-${task.priority}`}>{task.priority} priority</span>
            {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
          </div>
        </div>

        <div className="card">
          <h3>Status</h3>
          <div className="flex" style={{ flexWrap: "wrap" }}>
            {legalMoves().map((m) => (
              <button
                key={m.target}
                onClick={() => changeStatus(m.target, m.label)}
                disabled={pendingTarget !== null}
              >
                {pendingTarget === m.target ? <span className="spinner" /> : m.label}
              </button>
            ))}
            {legalMoves().length === 0 && <span style={{ color: "var(--text-dim)" }}>No legal moves right now.</span>}
          </div>
          {statusError && <p style={{ color: "var(--danger)", marginTop: 8 }}>{statusError}</p>}
        </div>

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

        <div className="card">
          <h3>Assignees</h3>
          <div className="flex" style={{ flexWrap: "wrap" }}>
            {task.assignees.map((a) => <span key={a.id} className="badge">{a.user.name}</span>)}
            {task.assignees.length === 0 && <span style={{ color: "var(--text-dim)" }}>Unassigned</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{ maxHeight: 600, overflowY: "auto" }}>
        <h3>Timeline</h3>
        <div className="grid" style={{ gap: 10 }}>
          {timeline.map((e) => (
            <div key={e.id} style={{ borderLeft: "2px solid var(--border)", paddingLeft: 10, fontSize: 13 }}>
              <div style={{ color: "var(--text-dim)" }}>
                {new Date(e.createdAt).toLocaleString()} — {e.user.name}
              </div>
              <div>{describeEvent(e)}</div>
            </div>
          ))}
          {timeline.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No activity yet.</p>}
        </div>
        <form onSubmit={postComment} className="flex" style={{ marginTop: 12 }}>
          <input placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" disabled={isPostingComment || !comment.trim()}>
            {isPostingComment ? <span className="spinner" /> : "Post"}
          </button>
        </form>
      </div>
    </div>
  );
}

function describeEvent(e) {
  switch (e.type) {
    case "CREATED": return "Task created.";
    case "STATUS_CHANGE": return `Status changed: ${e.oldValue} → ${e.newValue}`;
    case "FIELD_CHANGE":
      if (e.field === "blockedBy") return "Blocking tasks updated.";
      return `${e.field} changed: "${e.oldValue ?? ""}" → "${e.newValue ?? ""}"`;
    case "ASSIGNED": return "Assigned a user.";
    case "UNASSIGNED": return "Unassigned a user.";
    case "COMMENT": return e.commentText;
    default: return e.type;
  }
}
