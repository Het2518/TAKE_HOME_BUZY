"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function MyTasksPage() {
  const { user } = useCurrentUser();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/tasks?assigneeId=${user.id}&pageSize=100`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []));
  }, [user]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1>My Tasks</h1>
      <table>
        <thead>
          <tr><th>Title</th><th>Project</th><th>Status</th><th>Priority</th><th>Due</th></tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td><a href={`/tasks/${t.id}`}>{t.title}</a></td>
              <td>{t.project?.key}</td>
              <td><span className={`badge ${t.status}`}>{t.status}</span></td>
              <td className={`priority-${t.priority}`}>{t.priority}</td>
              <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <p style={{ color: "var(--text-dim)" }}>Nothing assigned to you right now.</p>}
    </div>
  );
}
