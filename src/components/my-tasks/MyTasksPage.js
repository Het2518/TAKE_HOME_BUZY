"use client";
import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";

const PAGE_SIZE = 20;

const STATUS_LABELS = {
  BACKLOG: "Backlog", IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review", DONE: "Done", BLOCKED: "Blocked",
};
const PRIORITY_LABELS = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

const IconTarget = (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

export default function MyTasksPage() {
  const { user } = useCurrentUser();
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback((page = 1) => {
    if (!user) return;
    setIsLoading(true);
    fetch(`/api/tasks?assigneeId=${user.id}&page=${page}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => {
        setTasks(d.tasks || []);
        setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 });
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  useEffect(() => { load(1); }, [user, load]);

  return (
    <div className="container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-title">
          <h1>My Tasks</h1>
          {!isLoading && (
            <div className="page-header-subtitle">
              {pagination.total} task{pagination.total !== 1 ? "s" : ""} assigned to you
            </div>
          )}
        </div>
      </div>

      {/* Task table */}
      <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        {/* Loading overlay */}
        <div style={{
          position: "absolute", inset: 0, background: "var(--panel)", zIndex: 5,
          opacity: isLoading && tasks.length > 0 ? 0.5 : 0, pointerEvents: "none", transition: "opacity 200ms ease",
        }} />

        {isLoading && tasks.length === 0 ? (
          <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 36, borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th style={{ width: 90 }}>Project</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 110 }}>Priority</th>
                  <th style={{ width: 100 }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link
                          href={`/tasks/${t.id}`}
                          style={{ fontWeight: 500, fontSize: 13, color: "var(--text)", display: "block" }}
                        >
                          {t.title}
                        </Link>
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, fontFamily: "monospace", fontWeight: 600, color: "var(--text-dim)" }}>
                          {t.project?.key}
                        </span>
                      </td>
                      <td>
                        <span className="status-indicator">
                          <span className={`status-dot ${t.status}`} />
                          <span style={{ color: `var(--status-${t.status?.toLowerCase().replace("_", "") || "backlog"})`, fontSize: 12.5 }}>
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
                        <span style={{ fontSize: 12.5, color: isOverdue ? "var(--danger)" : "var(--text-secondary)", fontWeight: isOverdue ? 500 : 400 }}>
                          {t.dueDate ? new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 0, border: "none" }}>
                      <div className="empty-state">
                        <div className="empty-state-icon">{IconTarget}</div>
                        <h3>No tasks assigned to you</h3>
                        <p>When someone assigns tasks to you, they'll appear here.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && tasks.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
            {pagination.total} task{pagination.total !== 1 ? "s" : ""}
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
              · Page {pagination.page} of {pagination.totalPages || 1}
            </span>
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="secondary" disabled={pagination.page <= 1 || isLoading} onClick={() => load(pagination.page - 1)} style={{ padding: "5px 10px", fontSize: 12 }}>
              Previous
            </button>
            <button className="secondary" disabled={pagination.page >= pagination.totalPages || isLoading} onClick={() => load(pagination.page + 1)} style={{ padding: "5px 10px", fontSize: 12 }}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
