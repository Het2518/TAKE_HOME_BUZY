"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";

function daysOverdue(dueDateString) {
  const diff = Date.now() - new Date(dueDateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyConfig(days) {
  if (days > 14) return { color: "var(--danger)", bg: "var(--danger-bg)", label: "Critical" };
  if (days > 7)  return { color: "var(--warning)", bg: "var(--warning-bg)", label: "High" };
  return { color: "var(--text-secondary)", bg: "var(--panel-highlight)", label: "Overdue" };
}

const IconAlert = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconParty = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(null);
  const [dismissingIds, setDismissingIds] = useState(new Set());

  function load() {
    fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.alerts || []));
  }
  useEffect(load, []);

  async function dismiss(taskId) {
    setDismissingIds((s) => new Set(s).add(taskId));
    await fetch(`/api/alerts/${taskId}/dismiss`, { method: "POST" });
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== taskId));
      setDismissingIds((s) => { const next = new Set(s); next.delete(taskId); return next; });
    }, 350);
  }

  return (
    <div className="container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-title">
          <h1>Overdue Alerts</h1>
          {alerts !== null && (
            <div className="page-header-subtitle">
              {alerts.length === 0
                ? "All tasks are on track"
                : `${alerts.length} overdue task${alerts.length !== 1 ? "s" : ""} need attention`}
            </div>
          )}
        </div>
      </div>

      {/* Alert list */}
      {alerts === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 76, borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      ) : (
        <>
          {alerts.length === 0 && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">{IconParty}</div>
                <h3>All caught up!</h3>
                <p>You have no active overdue alerts. Nice work keeping things on track.</p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((t) => {
              const days = daysOverdue(t.dueDate);
              const urgency = getUrgencyConfig(days);
              const isDismissing = dismissingIds.has(t.id);

              return (
                <div
                  key={t.id}
                  className="alert-card animate-slide-up"
                  style={{
                    borderLeft: `3px solid ${urgency.color}`,
                    opacity: isDismissing ? 0 : 1,
                    transform: isDismissing ? "translateX(16px)" : "none",
                    maxHeight: isDismissing ? 0 : 200,
                    overflow: "hidden",
                    marginBottom: isDismissing ? -10 : 0,
                    paddingTop: isDismissing ? 0 : undefined,
                    paddingBottom: isDismissing ? 0 : undefined,
                    transition: "opacity 300ms ease, transform 300ms ease, max-height 300ms ease, margin 300ms ease, padding 300ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ color: urgency.color, marginTop: 2, flexShrink: 0 }}>
                      {IconAlert}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={`/tasks/${t.id}`}
                        style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", display: "block", marginBottom: 5, opacity: 1 }}
                      >
                        {t.title}
                      </Link>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span
                          className="badge"
                          style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, background: "transparent", border: "1px solid var(--border)", padding: "1px 6px" }}
                        >
                          {t.project.key}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: urgency.color,
                            background: urgency.bg,
                            padding: "1px 7px",
                            borderRadius: "var(--radius-xs)",
                          }}
                        >
                          {days}d overdue
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                          Due {new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => dismiss(t.id)}
                    disabled={isDismissing}
                    style={{ flexShrink: 0, fontSize: 12, padding: "5px 12px" }}
                  >
                    {isDismissing ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Dismiss"}
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
