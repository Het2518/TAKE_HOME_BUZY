"use client";
import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const PAGE_SIZE = 20;

export default function MyTasksPage() {
  const { user } = useCurrentUser();
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="grid" style={{ gap: 16 }}>
      <div className="flex-between">
        <h1>My Tasks</h1>
        {isLoading && <span className="spinner" aria-label="Loading" />}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Title</th><th>Project</th><th>Status</th><th>Priority</th><th>Due</th>
            </tr>
          </thead>
          <tbody style={{ opacity: isLoading ? 0.5 : 1, transition: "opacity 120ms ease" }}>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td><a href={`/tasks/${t.id}`}>{t.title}</a></td>
                <td>{t.project?.key}</td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td className={`priority-${t.priority}`}>{t.priority}</td>
                <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {!isLoading && tasks.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-dim)", padding: 24 }}>
                  Nothing assigned to you right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — goal 6: total count always shown */}
      <div className="flex-between">
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
          {pagination.total} total — page {pagination.page} of {pagination.totalPages || 1}
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
