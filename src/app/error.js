"use client";

// Catches any unhandled error that bubbles up through the React tree.
// error.js must be a client component — Next.js App Router requirement.
// Without this, any runtime crash shows the raw Next.js error overlay to the user.
export default function ErrorPage({ error, reset }) {
  return (
    <div style={{ padding: 60, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 12 }}>Something went wrong</h2>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
