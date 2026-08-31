"use client";
import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/Skeleton";

const PAGE_SIZE = 20;

export default function MyTasksPage() {
  const { user } = useCurrentUser();
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true); // start true for initial render

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

  useEffect(() => { load(1); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>My Tasks</h1>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        {/* Shimmer overlay for loading */}
        <div style={{
          position: "absolute", inset: 0, background: "var(--panel)", zIndex: 5,
          opacity: isLoading ? 0.7 : 0, pointerEvents: "none", transition: "opacity 200ms ease",
        }} />
        
        {isLoading && tasks.length === 0 ? (
          <div style={{ padding: 24 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="40px" style={{ marginBottom: 12 }} />)}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Project</th><th>Status</th><th>Priority</th><th>Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}><a href={`/tasks/${t.id}`}>{t.title}</a></td>
                    <td><span className="badge" style={{ background: "transparent" }}>{t.project?.key}</span></td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td className={`priority-${t.priority}`}>{t.priority}</td>
                    <td style={{ color: "var(--text-dim)" }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
                {!isLoading && tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-dim)", padding: 48 }}>
                      Nothing assigned to you right now. 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination — goal 6: total count always shown */}
      <div className="flex-between">
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
          {pagination.total} total matches — page {pagination.page} of {pagination.totalPages || 1}
        </span>
        <div className="flex">
          <button
            className="secondary"
            disabled={pagination.page <= 1 || isLoading}
            onClick={() => load(pagination.page - 1)}
          >
            Prev
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
    </div>
  );
}
