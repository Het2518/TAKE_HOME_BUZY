"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";
import { KeyboardShortcutsModal } from "@/components/KeyboardNav";
import Link from "next/link";

// ── SVG Icon set ──────────────────────────────────────────────
const icons = {
  dashboard: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/>
      <rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
    </svg>
  ),
  projects: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  tasks: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  board: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
  ),
  myTasks: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  activity: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  alerts: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  digest: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  moon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  sun: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  logout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  keyboard: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/>
      <line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/>
      <line x1="6" y1="14" x2="18" y2="14"/>
    </svg>
  ),
  logo: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  ),
};

// Route label map for breadcrumbs
const ROUTE_LABELS = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/tasks": "All Tasks",
  "/board": "Board",
  "/my-tasks": "My Tasks",
  "/activity": "Activity",
  "/alerts": "Alerts",
  "/digest": "Digest",
};

function getBreadcrumb(pathname) {
  if (!pathname) return "";
  // Try exact match first
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  // Try parent
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname.startsWith(route + "/")) return label;
  }
  return "";
}

function NavLink({ href, label, icon, badge }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  return (
    <Link href={href} className={`nav-link ${isActive ? "active" : ""}`}>
      <span className="nav-link-icon">{icon}</span>
      <span className="nav-link-text">{label}</span>
      {badge}
    </Link>
  );
}

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
        <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
        <span style={{ color: "var(--text-dim)", marginLeft: 12, fontSize: 13 }}>Loading…</span>
      </div>
    );
  }

  const breadcrumb = getBreadcrumb(pathname);

  // Generate a deterministic color for avatar from name
  const avatarColors = [
    { bg: "#1e3a5f", fg: "#60a5fa" },
    { bg: "#1a3a2a", fg: "#4ade80" },
    { bg: "#3b1f44", fg: "#c084fc" },
    { bg: "#3a2010", fg: "#fb923c" },
    { bg: "#2d2a10", fg: "#facc15" },
    { bg: "#1a2a3a", fg: "#38bdf8" },
  ];
  const avatarIdx = user.name ? user.name.charCodeAt(0) % avatarColors.length : 0;
  const avatarStyle = {
    background: avatarColors[avatarIdx].bg,
    color: avatarColors[avatarIdx].fg,
    borderColor: "transparent",
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            {icons.logo}
          </div>
          <span className="sidebar-logo-text">ProjectFlow</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Overview</div>
          <NavLink href="/dashboard" label="Dashboard" icon={icons.dashboard} />
          <NavLink href="/projects" label="Projects" icon={icons.projects} />
          <NavLink href="/tasks" label="All Tasks" icon={icons.tasks} />
          <NavLink href="/board" label="Board" icon={icons.board} />

          <div className="nav-section-label" style={{ marginTop: 8 }}>Workspace</div>
          <NavLink href="/my-tasks" label="My Tasks" icon={icons.myTasks} />
          <NavLink href="/activity" label="Activity" icon={icons.activity} />
          <NavLink
            href="/alerts"
            label="Alerts"
            icon={icons.alerts}
            badge={
              alertCount > 0 && (
                <span className="nav-badge">{alertCount > 99 ? "99+" : alertCount}</span>
              )
            }
          />
          <NavLink href="/digest" label="Digest" icon={icons.digest} />
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar lg" style={avatarStyle}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">
                {user.role === "MANAGER" ? "Manager" : "Member"}
              </div>
            </div>
          </div>
          <div className="sidebar-actions">
            <button
              className="ghost icon-btn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ flex: 1 }}
            >
              {theme === "dark" ? icons.sun : icons.moon}
            </button>
            <button
              className="ghost icon-btn"
              onClick={() => document.getElementById("kb-help-modal")?.classList.toggle("visible")}
              title="Keyboard shortcuts (?)"
              style={{ flex: 1 }}
            >
              {icons.keyboard}
            </button>
            <button
              className="ghost icon-btn"
              onClick={handleLogout}
              title="Log out"
              style={{ flex: 1 }}
            >
              {icons.logout}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="top-header-left">
            {breadcrumb && (
              <div className="breadcrumb">
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>ProjectFlow</span>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">{breadcrumb}</span>
              </div>
            )}
          </div>
          <div className="top-header-right">
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                padding: "3px 7px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-xs)",
                cursor: "default",
                letterSpacing: "0.04em",
              }}
              title="Press ? for keyboard shortcuts"
            >
              ?
            </span>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-scroll">
          {children}
        </div>
      </main>

      <KeyboardShortcutsModal />
    </div>
  );
}
