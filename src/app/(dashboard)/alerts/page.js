"use client";
import { useEffect, useState } from "react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(null); // null = not loaded yet
  const [dismissingId, setDismissingId] = useState(null);

  function load() {
    fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.alerts || []));
  }
  useEffect(load, []);

  async function dismiss(taskId) {
    setDismissingId(taskId);
    await fetch(`/api/alerts/${taskId}/dismiss`, { method: "POST" });
    setDismissingId(null);
    load();
  }

  if (alerts === null) {
    return (
      <div className="flex" style={{ justifyContent: "center", paddingTop: 60 }}>
        <span className="spinner" /> <span style={{ color: "var(--text-dim)" }}>Loading alerts…</span>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1>Overdue Alerts</h1>
      {alerts.length === 0 && <p style={{ color: "var(--text-dim)" }}>No active overdue alerts. Nice work.</p>}
      <div className="grid" style={{ gap: 10 }}>
        {alerts.map((t) => (
          <div key={t.id} className="card flex-between">
            <div>
              <a href={`/tasks/${t.id}`}>{t.title}</a>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                {t.project.key} — was due {new Date(t.dueDate).toLocaleDateString()}
              </div>
            </div>
            <button className="secondary" onClick={() => dismiss(t.id)} disabled={dismissingId === t.id}>
              {dismissingId === t.id ? <span className="spinner" /> : "Dismiss"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
