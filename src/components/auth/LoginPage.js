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

const DEMO_ACCOUNTS = [
  { email: "aarav@demo.com", role: "Manager" },
  { email: "ananya@demo.com", role: "Manager" },
  { email: "vihaan@demo.com", role: "Member" },
  { email: "diya@demo.com", role: "Member" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("manager@demo.com");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Login failed. Please check your credentials.");
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
          <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Welcome back</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
            Sign in to your ProjectFlow workspace
          </p>
        </div>

        {/* Form card */}
        <div className="auth-form-card animate-slide-up">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email address</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex", pointerEvents: "none" }}>
                  <IconMail />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  style={{ paddingLeft: 32 }}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="password" className="auth-label">Password</label>
                <Link href="#" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex", pointerEvents: "none" }}>
                  <IconLock />
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ paddingLeft: 32 }}
                  autoComplete="current-password"
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
              ) : "Sign in"}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <div className="auth-footer animate-fade-in" style={{ animationDelay: "100ms" }}>
          Don't have an account?{" "}
          <Link href="/signup" style={{ color: "var(--text)", fontWeight: 500 }}>
            Create one
          </Link>
        </div>

        {/* Demo accounts */}
        <div className="auth-demo animate-fade-in" style={{ animationDelay: "200ms" }}>
          <span className="auth-demo-title">Demo accounts</span>
          {DEMO_ACCOUNTS.map((acc) => (
            <div
              key={acc.email}
              className="auth-demo-row"
              style={{ cursor: "pointer" }}
              onClick={() => setEmail(acc.email)}
            >
              <span className="auth-demo-account">{acc.email}</span>
              <span className="auth-demo-role">{acc.role}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-muted)" }}>
            Password: <strong style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>Password123!</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
