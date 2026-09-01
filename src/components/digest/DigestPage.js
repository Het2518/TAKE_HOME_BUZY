"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

export default function DigestPage() {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then(setDigest)
      .finally(() => setLoading(false));
  }, []);

  async function sendDigest() {
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/digest", { method: "POST" });
    const d = await res.json();
    setSendResult(d);
    setSending(false);
  }

  if (loading) {
    return (
      <div className="container grid animate-fade-in" style={{ gap: 24 }}>
        <Skeleton height="40px" width="200px" style={{ marginBottom: 16 }} />
        <Skeleton height="300px" className="card" />
      </div>
    );
  }

  const smtpNote = sendResult && !sendResult.ok && sendResult.configured === false;
  const IconEmail = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;
  
  return (
    <div className="container grid animate-fade-in" style={{ gap: 32 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "var(--accent)" }}>{IconEmail}</span> Email Digest
        </h1>
        <div className="flex" style={{ gap: 8 }}>
          <button className="primary" onClick={sendDigest} disabled={sending || !digest?.taskCount}>
            {sending ? <span className="spinner" /> : `Send to ${digest?.user?.email}`}
          </button>
        </div>
      </div>

      {/* Send result banner */}
      {sendResult && (
        <div className="card animate-slide-down" style={{ background: sendResult.ok ? "var(--success-bg)" : "var(--danger-bg)", borderColor: sendResult.ok ? "var(--success-border)" : "var(--danger-border)" }}>
          <div className="flex" style={{ color: sendResult.ok ? "var(--success)" : "var(--danger)", fontWeight: 500, fontSize: 15 }}>
            {sendResult.ok ? "✅ Digest sent successfully" : "❌ Failed to send digest"}
          </div>
          <p style={{ marginTop: 8, margin: "8px 0 0 0", color: "var(--text)" }}>
            {sendResult.ok ? `Delivered to ${sendResult.to} containing ${sendResult.taskCount} task${sendResult.taskCount !== 1 ? "s" : ""}.` : sendResult.error}
          </p>
          
          {smtpNote && (
            <div style={{ marginTop: 16, fontSize: 13 }}>
              <p style={{ margin: "0 0 8px 0", color: "var(--text-dim)" }}>To enable email sending, add these environment variables:</p>
              <code style={{ display: "block", padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-muted)" }}>
                SMTP_HOST=smtp.gmail.com{"\n"}
                SMTP_PORT=587{"\n"}
                SMTP_USER=your@gmail.com{"\n"}
                SMTP_PASS=your-app-password{"\n"}
                SMTP_FROM=your@gmail.com
              </code>
              <p style={{ margin: "8px 0 0 0", color: "var(--text-dim)" }}>For Gmail, generate an App Password at myaccount.google.com → Security → App Passwords.</p>
            </div>
          )}
        </div>
      )}

      {/* No overdue tasks */}
      {digest?.taskCount === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Nothing to send!</h3>
          <p style={{ color: "var(--text-dim)", margin: 0, fontSize: 14 }}>You have no overdue tasks to include in the digest.</p>
        </div>
      )}

      {/* Preview table */}
      {digest?.taskCount > 0 && (
        <div className="card animate-slide-up" style={{ padding: 0, overflow: "hidden", animationDelay: "100ms" }}>
          <div className="flex-between" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
            <h3 style={{ margin: 0 }}>Data Preview</h3>
            <span className="badge" style={{ background: "transparent", border: "1px solid var(--border-strong)" }}>
              {digest.taskCount} overdue task{digest.taskCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Project</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {digest.tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <span className="badge" style={{ background: "transparent", padding: "2px 6px" }}>{t.project.key}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}><Link href={`/tasks/${t.id}`}>{t.title}</Link></td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td style={{ color: "var(--danger)", fontWeight: 500, fontSize: 13 }}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HTML preview iframe */}
      {digest?.html && digest.taskCount > 0 && (
        <div className="card animate-slide-up" style={{ animationDelay: "200ms" }}>
          <h3 style={{ margin: "0 0 16px 0" }}>Email Layout Preview</h3>
          <iframe
            srcDoc={digest.html}
            style={{ width: "100%", height: 500, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "#ffffff" }}
            title="Email digest preview"
          />
        </div>
      )}
    </div>
  );
}
