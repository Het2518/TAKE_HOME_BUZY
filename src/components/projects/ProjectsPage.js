"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

export default function ProjectsPage() {
  const { user } = useCurrentUser();
  const { addToast } = useToast();
  const [projects, setProjects] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", name: "", description: "", ownerId: "" });
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [users, setUsers] = useState([]);

  function load(archived = showArchived) {
    const url = archived ? "/api/projects?includeArchived=true" : "/api/projects";
    fetch(url).then((r) => r.json()).then(setProjects);
  }
  
  useEffect(() => {
    load(showArchived);
  }, [showArchived]);

  useEffect(() => {
    if (user?.role === "MANAGER") {
      fetch("/api/users").then((r) => r.json()).then(setUsers);
    }
  }, [user]);

  useEffect(() => {
    if (user && !form.ownerId) setForm((f) => ({ ...f, ownerId: user.id }));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error);
      return;
    }
    setForm({ key: "", name: "", description: "", ownerId: user.id });
    setShowForm(false);
    addToast("Project created", "success");
    load();
  }

  async function toggleArchive(e, project) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/projects/${project.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project.archived }),
    });
    addToast(project.archived ? "Project restored" : "Project archived", "info");
    load();
  }

  const IconTasks = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>;
  const IconUsers = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;

  return (
    <div className="grid container animate-fade-in" style={{ gap: 32 }}>
      <div className="flex-between">
        <div>
          <h1 style={{ margin: 0 }}>Projects</h1>
          {projects && <p style={{ margin: "4px 0 0 0", color: "var(--text-dim)", fontSize: 14 }}>{projects.filter(p => !p.archived).length} active projects</p>}
        </div>
        
        <div className="flex" style={{ gap: 12 }}>
          <button className="ghost" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
          
          {user?.role === "MANAGER" && (
            <button className={showForm ? "secondary" : "primary"} onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "New project"}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card grid animate-slide-down" style={{ gap: 20, maxWidth: 600 }}>
          <h3 style={{ margin: 0 }}>Create a new project</h3>
          <div className="grid" style={{ gridTemplateColumns: "120px 1fr", gap: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 8 }}>
              Project Key
              <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} required maxLength={5} placeholder="e.g. ACM" />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 8 }}>
              Project Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="My awesome project" />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 8 }}>
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Briefly describe the purpose of this project..." />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 8 }}>
            Project Owner
            <select
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              required
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role === "MANAGER" ? "Manager" : "Member"})
                </option>
              ))}
            </select>
          </label>
          {error && <p style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button type="submit" className="primary">Create Project</button>
          </div>
        </form>
      )}

      {!projects ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height="200px" className="card" />)}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {projects.map((p, i) => (
            <a key={p.id} href={`/projects/${p.id}`} className="card animate-slide-up" style={{ color: "inherit", animationDelay: `${i * 50}ms`, display: "flex", flexDirection: "column", height: "100%", opacity: p.archived ? 0.6 : 1 }}>
              <div className="flex-between" style={{ alignItems: "flex-start", marginBottom: 16 }}>
                <span className="badge" style={{ background: "var(--panel-hover)", border: "1px solid var(--border-strong)" }}>{p.key}</span>
                {p.archived && <span className="badge BACKLOG">Archived</span>}
              </div>
              <h3 style={{ margin: "0 0 8px" }}>{p.name}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "0 0 24px", flex: 1 }}>{p.description || "No description provided."}</p>
              
              <div className="flex-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div className="flex" style={{ gap: 16 }}>
                  <div className="flex" style={{ gap: 6, color: "var(--text-dim)", fontSize: 13 }} title="Total tasks">
                    {IconTasks} <span style={{ fontWeight: 500 }}>{p._count?.tasks ?? 0}</span>
                  </div>
                  <div className="flex" style={{ gap: 6, color: "var(--text-dim)", fontSize: 13 }} title="Team members">
                    {IconUsers} <span style={{ fontWeight: 500 }}>{p._count?.members ?? 0}</span>
                  </div>
                </div>
                
                {user?.role === "MANAGER" && (
                  <button
                    className="ghost"
                    style={{ padding: "4px 8px", fontSize: 12, border: "1px solid transparent" }}
                    onClick={(e) => toggleArchive(e, p)}
                  >
                    {p.archived ? "Restore" : "Archive"}
                  </button>
                )}
              </div>
            </a>
          ))}
          {projects.length === 0 && (
            <div style={{ textAlign: "center", padding: "64px 24px", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-lg)" }}>
              <div style={{ color: "var(--text-dim)", fontSize: 48, marginBottom: 16 }}>📂</div>
              <h3 style={{ marginBottom: 8 }}>No projects found</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Get started by creating a new project workspace.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
