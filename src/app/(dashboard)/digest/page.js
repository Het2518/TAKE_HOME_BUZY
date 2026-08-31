"use client";
import { useEffect, useState } from "react";

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

  if (loading) return <div style={{ color: "var(--text-dim)", paddingTop: 40 }}>Building digest…</div>;

  const smtpNote = sendResult && !sendResult.ok && sendResult.configured === false;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="flex-between">
        <h1>📧 Email Digest</h1>
        <div className="flex" style={{ gap: 8 }}>
          <button onClick={sendDigest} disabled={sending || !digest?.taskCount}>
            {sending ? "Sending…" : `Send to ${digest?.user?.email}`}
          </button>
        </div>
      </div>

      {/* Send result banner */}
      {sendResult && (
        <div className="card" style={{ background: sendResult.ok ? "color-mix(in srgb,var(--success) 15%,transparent)" : "color-mix(in srgb,var(--danger) 15%,transparent)" }}>
          {sendResult.ok
            ? `✅ Digest sent to ${sendResult.to} (${sendResult.taskCount} task${sendResult.taskCount !== 1 ? "s" : ""})`
            : `❌ ${sendResult.error}`}
          {smtpNote && (
            <p style={{ marginTop: 8, fontSize: 13 }}>
              To enable email sending, add these environment variables:
              <code style={{ display: "block", marginTop: 6, padding: 8, background: "var(--bg)", borderRadius: 4 }}>
                SMTP_HOST=smtp.gmail.com{"\n"}
                SMTP_PORT=587{"\n"}
                SMTP_USER=your@gmail.com{"\n"}
                SMTP_PASS=your-app-password{"\n"}
                SMTP_FROM=your@gmail.com
              </code>
              For Gmail, generate an App Password at myaccount.google.com → Security → App Passwords.
            </p>
          )}
        </div>
      )}

      {/* No overdue tasks */}
      {digest?.taskCount === 0 && (
        <div className="card" style={{ color: "var(--text-dim)" }}>
          🎉 No overdue tasks — nothing to send!
        </div>
      )}

      {/* Preview table */}
      {digest?.taskCount > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <strong>Preview</strong>
            <span style={{ color: "var(--text-dim)", fontSize: 13, marginLeft: 8 }}>
              {digest.taskCount} overdue task{digest.taskCount !== 1 ? "s" : ""} assigned to you
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Project</th><th>Task</th><th>Status</th><th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {digest.tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.project.key}</td>
                  <td><a href={`/tasks/${t.id}`}>{t.title}</a></td>
                  <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                  <td style={{ color: "var(--danger)" }}>
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* HTML preview iframe */}
      {digest?.html && digest.taskCount > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Email Preview</h3>
          <iframe
            srcDoc={digest.html}
            style={{ width: "100%", height: 400, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
            title="Email digest preview"
          />
        </div>
      )}
    </div>
  );
}
