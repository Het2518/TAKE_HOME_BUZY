"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ProjectsPage() {
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState([]);
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

  // Default the owner picker to yourself once your own id is known, without overriding
  // a choice already made.
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
    load();
  }

  async function toggleArchive(project) {
    await fetch(`/api/projects/${project.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project.archived }),
    });
    load();
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="flex-between">
        <h1>Projects</h1>
        {user?.role === "MANAGER" && (
          <button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "New project"}</button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card grid" style={{ gap: 10, maxWidth: 480 }}>
          <input placeholder="Key (e.g. ACME)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Owner
            <select
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              required
              style={{ width: "100%", marginTop: 4 }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role === "MANAGER" ? "Manager" : "Member"})
                </option>
              ))}
            </select>
          </label>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit">Create</button>
        </form>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {projects.map((p) => (
          <a key={p.id} href={`/projects/${p.id}`} className="card" style={{ color: "inherit" }}>
            <div className="flex-between">
              <strong>{p.key}</strong>
              {p.archived && <span className="badge">Archived</span>}
            </div>
            <h3 style={{ margin: "6px 0" }}>{p.name}</h3>
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>{p.description}</p>
            <div className="flex" style={{ fontSize: 12, color: "var(--text-dim)" }}>
              <span>{p._count?.tasks ?? 0} tasks</span>
              <span>·</span>
              <span>{p._count?.members ?? 0} members</span>
            </div>
            {user?.role === "MANAGER" && (
              <button
                className="secondary"
                style={{ marginTop: 10 }}
                onClick={(e) => {
                  e.preventDefault();
                  toggleArchive(p);
                }}
              >
                {p.archived ? "Restore" : "Archive"}
              </button>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
