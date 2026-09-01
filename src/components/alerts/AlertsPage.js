"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";

function daysOverdue(dueDateString) {
  const diff = Date.now() - new Date(dueDateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days) {
  if (days > 14) return "var(--danger)";
  if (days > 7) return "var(--warning)";
  return "var(--text)";
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(null);
  const [dismissingIds, setDismissingIds] = useState(new Set());

  function load() {
    fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.alerts || []));
  }
  useEffect(load, []);

  async function dismiss(taskId) {
    setDismissingIds(s => new Set(s).add(taskId));
    await fetch(`/api/alerts/${taskId}/dismiss`, { method: "POST" });
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== taskId));
    }, 300);
  }

  const IconAlert = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24, maxWidth: 800 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>Overdue Alerts</h1>
      </div>
      
      {alerts === null ? (
        <div className="grid" style={{ gap: 16 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height="88px" className="card" />)}
        </div>
      ) : (
        <>
          {alerts.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h3 style={{ margin: 0, marginBottom: 8 }}>All caught up!</h3>
              <p style={{ color: "var(--text-dim)", margin: 0, fontSize: 14 }}>You have no active overdue alerts. Nice work.</p>
            </div>
          )}
          
          <div className="grid" style={{ gap: 16 }}>
            {alerts.map((t) => {
              const days = daysOverdue(t.dueDate);
              const color = getUrgencyColor(days);
              const isDismissing = dismissingIds.has(t.id);
              
              return (
                <div 
                  key={t.id} 
                  className="card flex-between animate-slide-up"
                  style={{ 
                    borderLeft: `4px solid ${color}`,
                    opacity: isDismissing ? 0 : 1,
                    transform: isDismissing ? "translateX(20px)" : "none",
                    maxHeight: isDismissing ? 0 : 200, 
                    paddingTop: isDismissing ? 0 : 24,
                    paddingBottom: isDismissing ? 0 : 24,
                    marginTop: isDismissing ? -16 : 0, 
                    overflow: "hidden",
                    transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <div className="flex" style={{ alignItems: "flex-start", gap: 16 }}>
                    <div style={{ color, marginTop: 2 }}>{IconAlert}</div>
                    <div>
                      <Link href={`/tasks/${t.id}`} style={{ fontWeight: 600, fontSize: 15, display: "block" }}>{t.title}</Link>
                      <div className="flex" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8, gap: 12 }}>
                        <span className="badge" style={{ background: "transparent", padding: 0, border: "none" }}>{t.project.key}</span>
                        <span style={{ color, fontWeight: 500 }}>{days} days overdue</span>
                        <span>Due {new Date(t.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <button className="secondary" onClick={() => dismiss(t.id)} disabled={isDismissing}>
                    {isDismissing ? <span className="spinner" /> : "Dismiss"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
