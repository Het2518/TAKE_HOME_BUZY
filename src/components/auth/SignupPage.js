"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const Logo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);

const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconAlertCircle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Signup failed. Please try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="auth-layout">
      <div className="auth-card animate-fade-in">

        {/* Logo + heading */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Logo />
          </div>
          <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Create your account</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-dim)", margin: 0 }}>
            Join ProjectFlow and start collaborating
          </p>
        </div>

        {/* Form card */}
        <div className="auth-form-card animate-slide-up">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div className="auth-field">
              <label htmlFor="name" className="auth-label">Full name</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex", pointerEvents: "none" }}>
                  <IconUser />
                </span>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                  placeholder="Jane Doe"
                  style={{ paddingLeft: 32 }}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email address</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex", pointerEvents: "none" }}>
                  <IconMail />
                </span>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                  placeholder="name@company.com"
                  style={{ paddingLeft: 32 }}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">Password</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex", pointerEvents: "none" }}>
                  <IconLock />
                </span>
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ paddingLeft: 32 }}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="auth-error">
                <IconAlertCircle />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="primary"
              disabled={loading}
              style={{ width: "100%", padding: "9px", marginTop: 4, fontSize: 14, fontWeight: 500 }}
            >
              {loading ? (
                <span className="spinner" style={{ width: 14, height: 14, borderTopColor: "var(--accent-contrast)", borderColor: "rgba(255,255,255,0.2)" }} />
              ) : "Create account"}
            </button>

            <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
              New accounts are created as <strong style={{ color: "var(--text-secondary)" }}>Members</strong>. A manager can promote you afterward.
            </p>
          </form>
        </div>

        <div className="auth-footer animate-fade-in" style={{ animationDelay: "100ms" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--text)", fontWeight: 500 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
