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
  const [users, setUsers] = useState([]);

  function load() {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }
  useEffect(load, []);

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

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>Projects</h1>
        {user?.role === "MANAGER" && (
          <button className={showForm ? "ghost" : "primary"} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ New project"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card grid animate-slide-down" style={{ gap: 16, maxWidth: 600 }}>
          <h3 style={{ margin: 0 }}>Create a new project</h3>
          <div className="grid" style={{ gridTemplateColumns: "120px 1fr", gap: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Key (e.g. ACM)
              <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} required maxLength={5} style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ marginTop: 6 }} />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Owner
            <select
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              required
              style={{ marginTop: 6 }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role === "MANAGER" ? "Manager" : "Member"})
                </option>
              ))}
            </select>
          </label>
          {error && <p style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="primary">Create Project</button>
          </div>
        </form>
      )}

      {!projects ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height="160px" className="card" />)}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {projects.map((p, i) => (
            <a key={p.id} href={`/projects/${p.id}`} className="card animate-slide-up" style={{ color: "inherit", animationDelay: `${i * 50}ms`, display: "flex", flexDirection: "column", height: "100%" }}>
              <div className="flex-between" style={{ alignItems: "flex-start", marginBottom: 12 }}>
                <span className="badge" style={{ background: "var(--panel-hover)", border: "none" }}>{p.key}</span>
                {p.archived && <span className="badge BACKLOG">Archived</span>}
              </div>
              <h3 style={{ margin: "0 0 8px" }}>{p.name}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "0 0 16px", flex: 1 }}>{p.description || "No description."}</p>
              
              <div className="flex-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div className="flex" style={{ gap: 16 }}>
                  <div className="flex" style={{ gap: 4, color: "var(--text-dim)", fontSize: 13 }}>
                    <span>📋</span> {p._count?.tasks ?? 0}
                  </div>
                  <div className="flex" style={{ gap: 4, color: "var(--text-dim)", fontSize: 13 }}>
                    <span>👥</span> {p._count?.members ?? 0}
                  </div>
                </div>
                
                {user?.role === "MANAGER" && (
                  <button
                    className="ghost"
                    style={{ padding: "4px 8px", fontSize: 12 }}
                    onClick={(e) => toggleArchive(e, p)}
                  >
                    {p.archived ? "Restore" : "Archive"}
                  </button>
                )}
              </div>
            </a>
          ))}
          {projects.length === 0 && <p style={{ color: "var(--text-dim)" }}>No projects found.</p>}
        </div>
      )}
    </div>
  );
}
