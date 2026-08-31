"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { highlightMentions } from "@/components/Mentions";
import { Skeleton } from "@/components/Skeleton";

function relativeTime(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function describeEvent(e) {
  switch (e.type) {
    case "CREATED": return "created the task";
    case "STATUS_CHANGE": return `changed status from ${e.oldValue} to ${e.newValue}`;
    case "FIELD_CHANGE": return `updated ${e.field} from "${e.oldValue || 'empty'}" to "${e.newValue || 'empty'}"`;
    case "ASSIGNED": return `assigned ${e.newValue}`;
    case "UNASSIGNED": return `unassigned ${e.oldValue}`;
    case "COMMENT": return highlightMentions(e.commentText);
    default: return e.type;
  }
}

export default function ActivityPage() {
  const [data, setData] = useState({ events: [], pagination: { page: 1, totalPages: 1 } });
  const [loading, setLoading] = useState(true);

  function load(page = 1) {
    setLoading(true);
    fetch(`/api/activity?page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }
  useEffect(() => load(1), []);

  return (
    <div className="container grid animate-fade-in" style={{ gap: 32, maxWidth: 800 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>Global Activity</h1>
      </div>

      <div className="card" style={{ padding: "32px" }}>
        {loading ? (
          <div className="grid" style={{ gap: 24 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex" style={{ gap: 16 }}>
                <Skeleton height="32px" width="32px" style={{ borderRadius: "50%" }} />
                <div className="flex-column" style={{ flex: 1, gap: 8 }}>
                  <Skeleton height="16px" width="60%" />
                  <Skeleton height="12px" width="30%" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.events.map((e, index) => {
              const isComment = e.type === "COMMENT";
              const icon = isComment ? "💬" : e.type === "STATUS_CHANGE" ? "🔄" : e.type === "CREATED" ? "✨" : "📝";
              
              return (
                <div key={e.id} className="animate-slide-up" style={{ display: "flex", gap: 20, paddingBottom: index === data.events.length - 1 ? 0 : 32, position: "relative", animationDelay: `${index * 30}ms` }}>
                  {/* Vertical line connecting events */}
                  {index !== data.events.length - 1 && (
                    <div style={{ position: "absolute", left: 19, top: 40, bottom: -8, width: 2, background: "var(--border)" }} />
                  )}
                  
                  {/* Event Icon/Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: isComment ? "var(--accent-ghost)" : "var(--panel-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, zIndex: 1, flexShrink: 0 }}>
                    {icon}
                  </div>
                  
                  {/* Event Content */}
                  <div style={{ flex: 1, paddingTop: 8 }}>
                    <div className="flex" style={{ flexWrap: "wrap", marginBottom: 4, gap: "6px 8px", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{e.user.name}</span>
                      <span style={{ color: "var(--text-dim)", fontSize: 14 }}>
                        {isComment ? "commented on" : describeEvent(e) + " on"}
                      </span>
                      <Link href={`/tasks/${e.task.id}`} className="badge flex" style={{ padding: "2px 8px", fontSize: 12, textDecoration: "none", background: "transparent", border: "1px solid var(--border-strong)" }}>
                        <strong style={{ color: "var(--text-dim)" }}>{e.task.project.key}</strong>
                        {e.task.title}
                      </Link>
                    </div>
                    
                    {isComment && (
                      <div style={{ background: "var(--panel-highlight)", padding: "12px 16px", borderRadius: "0 12px 12px 12px", fontSize: 14, color: "var(--text)", marginTop: 8, border: "1px solid var(--border)" }}>
                        {describeEvent(e)}
                      </div>
                    )}
                    
                    <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }} title={new Date(e.createdAt).toLocaleString()}>
                      {relativeTime(e.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {!loading && data.events.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-dim)" }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>📭</div>
                <h3>No activity found</h3>
                <p style={{ fontSize: 14 }}>Events across all projects will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && data.pagination.totalPages > 1 && (
        <div className="flex-between">
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex">
            <button className="secondary" disabled={data.pagination.page <= 1} onClick={() => load(data.pagination.page - 1)}>Previous</button>
            <button className="secondary" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => load(data.pagination.page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
