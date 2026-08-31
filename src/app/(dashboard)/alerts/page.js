"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";

function daysOverdue(dueDateString) {
  const diff = Date.now() - new Date(dueDateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days) {
  if (days > 14) return "var(--danger)";
  if (days > 7) return "var(--warning)";
  return "var(--accent)";
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(null);
  const [dismissingIds, setDismissingIds] = useState(new Set());

  function load() {
    fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.alerts || []));
  }
  useEffect(load, []);

  async function dismiss(taskId) {
    // Add to dismissing set to trigger exit animation
    setDismissingIds(s => new Set(s).add(taskId));
    
    await fetch(`/api/alerts/${taskId}/dismiss`, { method: "POST" });
    
    // After a short delay for the animation, remove it from the list entirely
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== taskId));
    }, 300); // Wait for the transition to finish
  }

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24, maxWidth: 800 }}>
      <h1 style={{ margin: 0 }}>Overdue Alerts</h1>
      
      {alerts === null ? (
        <div className="grid" style={{ gap: 16 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height="80px" className="card" />)}
        </div>
      ) : (
        <>
          {alerts.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h3 style={{ margin: 0, marginBottom: 8 }}>All caught up!</h3>
              <p style={{ color: "var(--text-dim)", margin: 0 }}>No active overdue alerts. Nice work.</p>
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
                    maxHeight: isDismissing ? 0 : 200, // collapse height
                    paddingTop: isDismissing ? 0 : 24,
                    paddingBottom: isDismissing ? 0 : 24,
                    marginTop: isDismissing ? -16 : 0, // collapse margin gap
                    overflow: "hidden",
                    transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <div>
                    <a href={`/tasks/${t.id}`} style={{ fontWeight: 600, fontSize: 16 }}>{t.title}</a>
                    <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge" style={{ background: "transparent", padding: 0 }}>{t.project.key}</span>
                      <span>•</span>
                      <span style={{ color }}>{days} days overdue</span>
                      <span>•</span>
                      <span>Due {new Date(t.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button className="ghost" onClick={() => dismiss(t.id)} disabled={isDismissing}>
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
