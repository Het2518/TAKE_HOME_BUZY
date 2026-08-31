"use client";
import { useEffect, useState } from "react";

const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "SELECT"];

export default function CustomFieldsPanel({ projectId, isManager }) {
  const [fields, setFields] = useState([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("TEXT");
  const [newOptions, setNewOptions] = useState(""); // comma-separated for SELECT
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch(`/api/projects/${projectId}/fields`)
      .then((r) => r.json())
      .then(setFields);

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line

  async function addField(e) {
    e.preventDefault();
    setError("");
    setAdding(true);
    const body = { name: newName, type: newType };
    if (newType === "SELECT") {
      body.options = newOptions.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const res = await fetch(`/api/projects/${projectId}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Error adding field");
    } else {
      setNewName(""); setNewType("TEXT"); setNewOptions("");
      load();
    }
    setAdding(false);
  }

  async function deleteField(id) {
    if (!confirm("Delete this custom field and all its values?")) return;
    await fetch(`/api/projects/${projectId}/fields/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h3>Custom Fields</h3>
      {fields.length === 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No custom fields defined for this project.</p>
      )}
      {fields.map((f) => (
        <div key={f.id} className="flex-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
          <span>
            <strong>{f.name}</strong>
            <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>{f.type}</span>
            {f.options && (
              <span style={{ color: "var(--text-dim)", marginLeft: 8, fontSize: 12 }}>
                {JSON.parse(f.options).join(", ")}
              </span>
            )}
          </span>
          {isManager && (
            <button className="secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => deleteField(f.id)}>
              Remove
            </button>
          )}
        </div>
      ))}
      {isManager && (
        <form onSubmit={addField} className="flex" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Field name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            style={{ flex: 1, minWidth: 120 }}
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {newType === "SELECT" && (
            <input
              placeholder="Options (comma separated)"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              style={{ flex: 2, minWidth: 160 }}
            />
          )}
          <button type="submit" disabled={adding || !newName.trim()}>
            {adding ? <span className="spinner" /> : "Add Field"}
          </button>
          {error && <span style={{ color: "var(--danger)", fontSize: 13, width: "100%" }}>{error}</span>}
        </form>
      )}
    </div>
  );
}
