"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

const COLUMNS = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "DONE", label: "Done" },
  { key: "BLOCKED", label: "Blocked" },
];

export default function BoardPage() {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [rollbackQueue, setRollbackQueue] = useState({});

  function load() {
    fetch("/api/tasks?pageSize=200&sortBy=updatedAt&sortDir=desc")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []));
  }
  useEffect(load, []);

  function tasksFor(status) {
    if (!tasks) return [];
    return tasks.filter((t) => t.status === status);
  }

  async function handleDrop(targetStatus) {
    setHoverTarget(null);
    if (!draggingId) return;
    
    const task = tasks.find((t) => t.id === draggingId);
    setDraggingId(null);
    
    if (!task || task.status === targetStatus) return;

    // Optimistic Update
    const originalStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: targetStatus } : t));

    const body = task.status === "BLOCKED" ? { targetStatus: "UNBLOCK" } : { targetStatus };

    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      addToast(`Moved ${task.title} to ${targetStatus}`, "success");
    } catch (err) {
      // Rollback
      addToast(err.message, "error");
      
      // We apply a temporary class for the slide-back animation
      setRollbackQueue(prev => ({ ...prev, [task.id]: true }));
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: originalStatus } : t));
      
      setTimeout(() => {
        setRollbackQueue(prev => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });
      }, 300);
    }
  }

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24, padding: "32px 24px", maxWidth: "100%", overflowX: "auto" }}>
      <h1 style={{ margin: 0 }}>Board</h1>
      
      {!tasks ? (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(300px, 1fr))`, gap: 16 }}>
          {COLUMNS.map(c => (
            <div key={c.key} className="card" style={{ minHeight: 600 }}>
              <Skeleton height="24px" width="100px" style={{ marginBottom: 16 }} />
              <div className="grid" style={{ gap: 12 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} height="100px" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, minHeight: 600, alignItems: "stretch" }}>
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className="card"
              style={{ 
                flex: "1 0 300px", 
                background: hoverTarget === col.key ? "var(--panel-hover)" : "var(--panel)", 
                border: hoverTarget === col.key ? `1px dashed var(--status-${col.key.toLowerCase().replace('_', '')})` : "1px solid var(--border)",
                transition: "all 150ms ease",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverTarget(col.key);
              }}
              onDragLeave={() => setHoverTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.key);
              }}
            >
              <div className="flex-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
                <strong style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)" }}>
                  {col.label}
                </strong>
                <span className="badge" style={{ background: "transparent" }}>{tasksFor(col.key).length}</span>
              </div>
              
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                {tasksFor(col.key).map((t) => (
                  <div
                    key={t.id}
                    className="card animate-slide-up"
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                      // Make original slightly transparent
                      setTimeout(() => e.target.style.opacity = '0.5', 0);
                    }}
                    onDragEnd={(e) => {
                      e.target.style.opacity = '1';
                      setDraggingId(null);
                      setHoverTarget(null);
                    }}
                    style={{ 
                      cursor: "grab", 
                      padding: 16, 
                      animationDuration: "150ms",
                      border: rollbackQueue[t.id] ? "1px solid var(--danger)" : "1px solid var(--border)",
                      transform: rollbackQueue[t.id] ? "translateX(10px)" : "none",
                      transition: "transform 200ms ease, border-color 200ms ease",
                    }}
                  >
                    <a href={`/tasks/${t.id}`} style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 8, color: "var(--text)" }}>
                      {t.title}
                    </a>
                    <div className="flex-between">
                      <div className={`priority-${t.priority}`} style={{ fontSize: 12 }}>
                        {t.priority}
                      </div>
                      <div className="badge" style={{ background: "transparent", border: "none" }}>{t.project?.key}</div>
                    </div>
                  </div>
                ))}
                
                {hoverTarget === col.key && draggingId && tasksFor(col.key).find(t => t.id === draggingId) === undefined && (
                  <div className="card skeleton" style={{ minHeight: 100, border: "2px dashed var(--border)", background: "transparent", opacity: 0.5 }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
