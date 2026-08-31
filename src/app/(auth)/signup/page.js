"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setError(data.error || "Signup failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: 60 }}>
      <div className="card">
        <h1>Create account</h1>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
          <label>
            Name
            <input value={form.name} onChange={(e) => update("name", e.target.value)} required style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required style={{ width: "100%", marginTop: 4 }} />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required style={{ width: "100%", marginTop: 4 }} />
          </label>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" disabled={loading}>{loading ? "Creating..." : "Sign up"}</button>
        </form>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)" }}>
          New accounts are created as Members. An existing manager can promote you afterward.
        </p>
        <p style={{ marginTop: 8, fontSize: 13 }}>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
