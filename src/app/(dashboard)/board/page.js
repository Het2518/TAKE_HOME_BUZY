"use client";
import { useEffect, useState } from "react";

// STRETCH GOAL: drag-and-drop board. This view adds zero new backend logic — every drop
// calls the exact same PATCH /api/tasks/:id/status endpoint used by the task detail page's
// status buttons, so all the legality/blocking checks from src/lib/taskStateMachine.js are
// already enforced server-side. Dragging a card to an illegal column just gets rejected with
// the same error message the button-based flow would show.
const COLUMNS = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "DONE", label: "Done" },
  { key: "BLOCKED", label: "Blocked" },
];

export default function BoardPage() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState(null);

  function load() {
    fetch("/api/tasks?pageSize=200&sortBy=updatedAt&sortDir=desc")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []));
  }
  useEffect(load, []);

  function tasksFor(status) {
    return tasks.filter((t) => t.status === status);
  }

  async function handleDrop(targetStatus) {
    if (!draggingId) return;
    setError("");
    const task = tasks.find((t) => t.id === draggingId);
    setDraggingId(null);
    if (!task || task.status === targetStatus) return;

    // A drop onto the Blocked column or from Blocked needs the same UNBLOCK vocabulary
    // the status route expects — translate the drag target into the right API call.
    const body =
      task.status === "BLOCKED"
        ? { targetStatus: "UNBLOCK" }
        : { targetStatus };

    const res = await fetch(`/api/tasks/${task.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(`${task.title}: ${d.error}`);
      return;
    }
    load();
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1>Board</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`, gap: 12 }}>
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="card"
            style={{ minHeight: 400, background: "var(--bg)" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
          >
            <div className="flex-between">
              <strong>{col.label}</strong>
              <span className="badge">{tasksFor(col.key).length}</span>
            </div>
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              {tasksFor(col.key).map((t) => (
                <div
                  key={t.id}
                  className="card"
                  draggable
                  onDragStart={() => setDraggingId(t.id)}
                  style={{ cursor: "grab", padding: 10 }}
                >
                  <a href={`/tasks/${t.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
                    {t.title}
                  </a>
                  <div className={`priority-${t.priority}`} style={{ fontSize: 12 }}>
                    {t.priority}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.project?.key}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
