// Root loading.js — shown during any top-level route transition.
// Next.js automatically wraps this in a Suspense boundary for the (dashboard) group.
export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 200,
        gap: 12,
        color: "var(--text-dim)",
      }}
    >
      <span className="spinner" />
      <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  );
}
