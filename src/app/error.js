"use client";

// Catches any unhandled error that bubbles up through the React tree.
// error.js must be a client component — Next.js App Router requirement.
// Without this, any runtime crash shows the raw Next.js error overlay to the user.
export default function ErrorPage({ error, reset }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: 24,
    }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{
          width: 52, height: 52,
          background: "var(--danger-bg)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-lg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          color: "var(--danger)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 18, marginBottom: 8, color: "var(--text)" }}>Something went wrong</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginBottom: 24, lineHeight: 1.6 }}>
          {error?.message || "An unexpected error occurred. Our team has been notified."}
        </p>
        <button
          className="primary"
          onClick={reset}
          style={{ padding: "8px 20px" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
