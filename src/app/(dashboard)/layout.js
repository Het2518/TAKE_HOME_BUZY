"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => setAlertCount(d.count || 0))
      .catch(() => {});
  }, [user]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading || !user) {
    return (
      <div className="container flex" style={{ justifyContent: "center", paddingTop: 80 }}>
        <span className="spinner" /> <span style={{ color: "var(--text-dim)" }}>Loading…</span>
      </div>
    );
  }

  const navLink = (href, label, extra) => (
    <a
      href={href}
      className="flex"
      style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 14 }}
    >
      {label}
      {extra}
    </a>
  );

  return (
    <div>
      <nav
        className="flex-between"
        style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}
      >
        <div className="flex" style={{ gap: 4, flexWrap: "wrap" }}>
          <strong style={{ marginRight: 16 }}>Project Tracker</strong>
          {navLink("/dashboard", "Dashboard")}
          {navLink("/projects", "Projects")}
          {navLink("/tasks", "All Tasks")}
          {navLink("/board", "Board")}
          {navLink("/my-tasks", "My Tasks")}
          {navLink("/activity", "Activity")}
          {navLink(
            "/alerts",
            "Alerts",
            alertCount > 0 && (
              <span className="badge" style={{ background: "var(--danger)", color: "#fff", border: "none", marginLeft: 6 }}>
                {alertCount}
              </span>
            )
          )}
        </div>
        <div className="flex">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
            {user.name} ({user.role})
          </span>
          <button className="secondary" onClick={handleLogout}>Log out</button>
        </div>
      </nav>
      <main className="container">{children}</main>
    </div>
  );
}
