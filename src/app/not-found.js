// Custom 404 page. Without this, Next.js shows its default "404 | This page
// could not be found" which looks out of place with the app's design.
export default function NotFound() {
  return (
    <div style={{ padding: 60, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 12 }}>Page not found</h2>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        The page you&#39;re looking for doesn&#39;t exist or was moved.
      </p>
      <a href="/dashboard" className="button">
        Go to dashboard
      </a>
    </div>
  );
}
