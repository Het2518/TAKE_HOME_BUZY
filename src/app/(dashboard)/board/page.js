"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";

const COLUMNS = [
  { key: "BACKLOG", label: "Backlog", color: "var(--status-backlog)" },
  { key: "IN_PROGRESS", label: "In Progress", color: "var(--status-inprogress)" },
  { key: "IN_REVIEW", label: "In Review", color: "var(--status-inreview)" },
  { key: "DONE", label: "Done", color: "var(--status-done)" },
  { key: "BLOCKED", label: "Blocked", color: "var(--status-blocked)" },
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
    <div className="grid container animate-fade-in" style={{ gap: 24, maxWidth: "100%", overflowX: "auto", height: "calc(100vh - 56px)" }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>Board</h1>
      </div>
      
      {!tasks ? (
        <div className="flex" style={{ gap: 24, height: "100%", alignItems: "stretch" }}>
          {COLUMNS.map(c => (
            <div key={c.key} className="card" style={{ minWidth: 320, flex: "0 0 320px", display: "flex", flexDirection: "column", background: "var(--bg)", border: "1px dashed var(--border)" }}>
              <Skeleton height="24px" width="100px" style={{ marginBottom: 16 }} />
              <div className="grid" style={{ gap: 12 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} height="100px" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex" style={{ gap: 24, height: "100%", alignItems: "stretch", paddingBottom: 24 }}>
          {COLUMNS.map((col) => {
            const isHovering = hoverTarget === col.key;
            
            return (
              <div
                key={col.key}
                style={{ 
                  minWidth: 320,
                  flex: "0 0 320px", 
                  background: isHovering ? "color-mix(in srgb, var(--panel-hover) 80%, transparent)" : "var(--panel-hover)", 
                  border: isHovering ? `1px dashed ${col.color}` : "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
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
                <div className="flex-between" style={{ padding: "16px 20px", borderBottom: isHovering ? `1px dashed ${col.color}` : "1px solid var(--border)", background: "var(--panel)" }}>
                  <div className="flex" style={{ gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                    <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text)" }}>
                      {col.label}
                    </strong>
                  </div>
                  <span className="badge" style={{ background: "transparent", color: "var(--text-dim)", padding: 0, border: "none" }}>{tasksFor(col.key).length}</span>
                </div>
                
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: 16, overflowY: "auto" }}>
                  {tasksFor(col.key).map((t) => (
                    <div
                      key={t.id}
                      className="card animate-slide-up"
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(t.id);
                        e.dataTransfer.effectAllowed = "move";
                        setTimeout(() => e.target.style.opacity = '0.4', 0);
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
                        transition: "transform 200ms ease, border-color 200ms ease, box-shadow 150ms ease",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <Link href={`/tasks/${t.id}`} style={{ fontWeight: 500, fontSize: 14, display: "block", marginBottom: 12, color: "var(--text)", lineHeight: 1.4 }}>
                        {t.title}
                      </Link>
                      <div className="flex-between">
                        <div className="flex" style={{ gap: 8 }}>
                          <span className="badge" style={{ background: "transparent", border: "1px solid var(--border-strong)", padding: "2px 6px" }}>{t.project?.key}</span>
                          <div className={`priority-${t.priority}`} style={{ fontSize: 12 }}>
                            {t.priority}
                          </div>
                        </div>
                        <div className="avatar-group">
                          {t.assignees.length > 0 && t.assignees.slice(0, 3).map((a) => (
                            <div key={a.id} className="avatar" style={{ width: 20, height: 20, fontSize: 10 }} title={a.user.name}>
                              {a.user.name.charAt(0)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isHovering && draggingId && tasksFor(col.key).find(t => t.id === draggingId) === undefined && (
                    <div style={{ minHeight: 100, border: `2px dashed ${col.color}`, borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--panel) 50%, transparent)", opacity: 0.5 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
