"use client";
import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";

const PAGE_SIZE = 20;

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

  const IconFilter = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>My Tasks</h1>
        <div className="flex" style={{ gap: 12 }}>
          <span className="badge" style={{ background: "transparent", border: "1px solid var(--border-strong)", gap: 6 }}>
            {IconFilter} Assigned to me
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        {/* Shimmer overlay for loading */}
        <div style={{
          position: "absolute", inset: 0, background: "var(--panel)", zIndex: 5,
          opacity: isLoading && tasks.length > 0 ? 0.7 : 0, pointerEvents: "none", transition: "opacity 200ms ease",
        }} />
        
        {isLoading && tasks.length === 0 ? (
          <div style={{ padding: "12px 16px" }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex" style={{ gap: 16, borderBottom: i !== 5 ? "1px solid var(--border)" : "none", padding: "12px 0" }}>
                <Skeleton height="20px" width="40%" />
                <Skeleton height="20px" width="10%" />
                <Skeleton height="20px" width="15%" />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Task Title</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th style={{ paddingRight: 24 }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 500 }}>
                      <Link href={`/tasks/${t.id}`} style={{ display: "block" }}>{t.title}</Link>
                    </td>
                    <td>
                      <span className="badge" style={{ background: "transparent", padding: "2px 6px" }}>{t.project?.key}</span>
                    </td>
                    <td>
                      <span className={`badge ${t.status}`}>{t.status}</span>
                    </td>
                    <td>
                      <span className={`priority-${t.priority}`} style={{ fontSize: 13, fontWeight: 500 }}>{t.priority}</span>
                    </td>
                    <td style={{ color: "var(--text-dim)", paddingRight: 24, fontSize: 13 }}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {!isLoading && tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "64px 24px" }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
                      <h3 style={{ margin: 0, marginBottom: 8 }}>Inbox Zero</h3>
                      <p style={{ color: "var(--text-dim)", margin: 0, fontSize: 14 }}>You have no tasks assigned to you right now.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && tasks.length > 0 && (
        <div className="flex-between">
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Showing page {pagination.page} of {pagination.totalPages || 1} • {pagination.total} total tasks
          </span>
          <div className="flex">
            <button
              className="secondary"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => load(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              className="secondary"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => load(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
