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
              const Icon = isComment ? () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> 
                                   : e.type === "STATUS_CHANGE" ? () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 1 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                                   : e.type === "CREATED" ? () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                   : () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;

              return (
                <div key={e.id} className="animate-slide-up" style={{ display: "flex", gap: 20, paddingBottom: index === data.events.length - 1 ? 0 : 32, position: "relative", animationDelay: `${index * 30}ms` }}>
                  {index !== data.events.length - 1 && (
                    <div style={{ position: "absolute", left: 19, top: 40, bottom: -8, width: 2, background: "var(--border-subtle)" }} />
                  )}
                  
                  <div style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--background-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-accent)", zIndex: 1, flexShrink: 0 }}>
                    <Icon />
                  </div>
                  
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div className="flex" style={{ flexWrap: "wrap", marginBottom: 4, gap: "4px 8px", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{e.user.name}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                        {isComment ? "commented on" : describeEvent(e) + " on"}
                      </span>
                      <Link href={`/tasks/${e.task.id}`} className="flex" style={{ fontSize: 14, textDecoration: "none", color: "var(--text-accent)", fontWeight: 500 }}>
                        {e.task.project.key}-{e.task.id}
                      </Link>
                    </div>
                    
                    {isComment && (
                      <div style={{ background: "var(--background-secondary)", padding: "12px", borderRadius: "8px", fontSize: 14, color: "var(--text)", marginTop: 8, border: "1px solid var(--border)" }}>
                        {describeEvent(e)}
                      </div>
                    )}
                    
                    <div style={{ color: "var(--text-subtle)", fontSize: 12, marginTop: 4 }}>
                      {relativeTime(e.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {!loading && data.events.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>✨</div>
                <h3 style={{ margin: "0 0 8px" }}>No recent activity</h3>
                <p style={{ fontSize: 14, margin: 0 }}>Things will start appearing here once your team gets moving.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && data.pagination.totalPages > 1 && (
        <div className="flex-between">
          <span style={{ fontSize: 13, color: "var(--text-subtle)" }}>
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex" style={{ gap: 8 }}>
            <button className="secondary" disabled={data.pagination.page <= 1} onClick={() => load(data.pagination.page - 1)}>Previous</button>
            <button className="secondary" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => load(data.pagination.page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
