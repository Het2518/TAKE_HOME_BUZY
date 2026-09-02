// Custom 404 page. Without this, Next.js shows its default "404 | This page
// could not be found" which looks out of place with the app's design.
export default function NotFound() {
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
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          color: "var(--text-muted)",
          lineHeight: 1,
          marginBottom: 16,
        }}>
          404
        </div>
        <h2 style={{ fontSize: 18, marginBottom: 8, color: "var(--text)" }}>Page not found</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginBottom: 24, lineHeight: 1.6 }}>
          The page you&#39;re looking for doesn&#39;t exist or may have been moved.
        </p>
        <a
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 20px",
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            transition: "opacity 150ms ease",
          }}
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}
