"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";
import { KeyboardShortcutsModal } from "@/components/KeyboardNav";
import Link from "next/link";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
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
      <div className="app-layout" style={{ justifyContent: "center", alignItems: "center" }}>
        <span className="spinner" /> 
        <span style={{ color: "var(--text-dim)", marginLeft: 12 }}>Loading…</span>
      </div>
    );
  }

  const navLink = (href, label, icon, extra) => {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`nav-link ${isActive ? "active" : ""}`}
      >
        <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
          {icon}
        </span>
        <span style={{ flex: 1 }}>{label}</span>
        {extra}
      </Link>
    );
  };

  const IconDashboard = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>;
  const IconProjects = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
  const IconTasks = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>;
  const IconBoard = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>;
  const IconMyTasks = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
  const IconActivity = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
  const IconAlerts = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;
  const IconDigest = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 24, height: 24, background: "var(--accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12l5.25 5 2.625-3-2.625-3z"></path><path d="M11 14l2.625-3 5.25 5L22 12l-5.25-5-2.625 3 2.625 3z"></path></svg>
          </div>
          <strong style={{ fontSize: 15, letterSpacing: "-0.01em" }}>Project Tracker</strong>
        </div>

        <nav style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
          <div style={{ padding: "0 24px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Overview</div>
          {navLink("/dashboard", "Dashboard", IconDashboard)}
          {navLink("/projects", "Projects", IconProjects)}
          {navLink("/tasks", "All Tasks", IconTasks)}
          {navLink("/board", "Board", IconBoard)}
          
          <div style={{ padding: "24px 24px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Me</div>
          {navLink("/my-tasks", "My Tasks", IconMyTasks)}
          {navLink("/activity", "Activity", IconActivity)}
          {navLink("/alerts", "Alerts", IconAlerts, alertCount > 0 && (
            <span className="badge" style={{ background: "var(--danger)", color: "#fff", border: "none", fontSize: 11, padding: "2px 6px" }}>
              {alertCount}
            </span>
          ))}
          {navLink("/digest", "Digest", IconDigest)}
        </nav>

        <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
          <div className="flex-between" style={{ padding: "8px" }}>
            <div className="flex" style={{ gap: 10 }}>
              <div className="avatar">{user.name.charAt(0)}</div>
              <div className="flex-column" style={{ gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1 }}>{user.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1 }}>{user.role}</span>
              </div>
            </div>
          </div>
          <div className="flex" style={{ gap: 8, marginTop: 12 }}>
            <button
              className="ghost"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ flex: 1, padding: "6px" }}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button className="ghost" onClick={handleLogout} style={{ flex: 1, padding: "6px" }}>Log out</button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header">
          <div className="flex" style={{ color: "var(--text-dim)", fontSize: 13, fontWeight: 500 }}>
            {/* Breadcrumb could go here based on pathname */}
          </div>
          <div className="flex">
            <button
              className="secondary"
              title="Keyboard shortcuts (?)"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={() => document.getElementById("kb-help-modal")?.classList.toggle("visible")}
            >
              <kbd style={{ fontFamily: "inherit" }}>?</kbd>
            </button>
          </div>
        </header>
        
        <div style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </main>

      <KeyboardShortcutsModal />
    </div>
  );
}
