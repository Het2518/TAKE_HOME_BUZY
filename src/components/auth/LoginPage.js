"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      setError(data.error || "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: "var(--accent)", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "var(--shadow-md)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12l5.25 5 2.625-3-2.625-3z"></path><path d="M11 14l2.625-3 5.25 5L22 12l-5.25-5-2.625 3 2.625 3z"></path></svg>
          </div>
          <h1 style={{ fontSize: 28, margin: "0 0 8px 0" }}>Welcome back</h1>
          <p style={{ color: "var(--text-dim)", margin: 0 }}>Sign in to your Project Tracker account</p>
        </div>

        <div className="card animate-slide-up" style={{ padding: "32px 24px" }}>
          <form onSubmit={handleSubmit} className="flex-column" style={{ gap: 20 }}>
            <div className="flex-column" style={{ gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                style={{ padding: "10px 12px" }}
              />
            </div>
            <div className="flex-column" style={{ gap: 8 }}>
              <div className="flex-between">
                <label style={{ fontSize: 13, fontWeight: 500 }}>Password</label>
                <Link href="#" style={{ fontSize: 12, color: "var(--text-dim)" }}>Forgot password?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ padding: "10px 12px" }}
              />
            </div>
            
            {error && (
              <div style={{ padding: "12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-sm)", color: "var(--danger)", fontSize: 13 }}>
                {error}
              </div>
            )}
            
            <button type="submit" className="primary" disabled={loading} style={{ width: "100%", padding: "10px", marginTop: 8, fontSize: 15 }}>
              {loading ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: "var(--accent-contrast)", borderColor: "rgba(0,0,0,0.1)" }} /> : "Sign in"}
            </button>
          </form>
        </div>
        
        <div className="animate-fade-in" style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--text-dim)" }}>
          Don't have an account? <Link href="/signup" style={{ color: "var(--text)", fontWeight: 500 }}>Sign up</Link>
        </div>

        <div className="animate-fade-in" style={{ marginTop: 48, padding: 16, border: "1px dashed var(--border)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
          <strong style={{ color: "var(--text)" }}>Demo Accounts</strong><br/>
          Managers: aarav@demo.com, ananya@demo.com<br/>
          Members: vihaan@demo.com, diya@demo.com<br/>
          Password: <strong>Password123!</strong>
        </div>

      </div>
    </div>
  );
}
