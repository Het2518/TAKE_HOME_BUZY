"use client";
import { useEffect, useState } from "react";

export default function CustomFieldValues({ taskId }) {
  const [fields, setFields] = useState([]);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/custom-fields`)
      .then((r) => r.json())
      .then(setFields)
      .catch(() => {});
  }, [taskId]);

  if (!fields.length) return null;

  function handleChange(fieldId, value) {
    setDirty((d) => ({ ...d, [fieldId]: value }));
    setSaved(false);
  }

  async function saveAll(e) {
    e.preventDefault();
    if (!Object.keys(dirty).length) return;
    setSaving(true);
    await fetch(`/api/tasks/${taskId}/custom-fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dirty),
    });
    // Refresh
    const updated = await fetch(`/api/tasks/${taskId}/custom-fields`).then((r) => r.json());
    setFields(updated);
    setDirty({});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function renderInput(f) {
    const value = dirty[f.id] !== undefined ? dirty[f.id] : f.value;
    const common = { value, onChange: (e) => handleChange(f.id, e.target.value), style: { width: "100%" } };
    if (f.type === "SELECT") {
      return (
        <select {...common}>
          <option value="">— select —</option>
          {(f.options || []).map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === "NUMBER") return <input type="number" {...common} />;
    if (f.type === "DATE") return <input type="date" {...common} />;
    return <input type="text" placeholder={`Enter ${f.name}`} {...common} />;
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex-between">
        <h3 style={{ margin: 0 }}>📋 Custom Fields</h3>
        {saved && <span style={{ color: "var(--success)", fontSize: 13 }}>✓ Saved</span>}
      </div>
      <form onSubmit={saveAll} style={{ marginTop: 12 }}>
        <div className="grid" style={{ gap: 10 }}>
          {fields.map((f) => (
            <div key={f.id}>
              <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>{f.name}</label>
              {renderInput(f)}
            </div>
          ))}
        </div>
        {Object.keys(dirty).length > 0 && (
          <button type="submit" className="primary" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? <span className="spinner" /> : "Save custom fields"}
          </button>
        )}
      </form>
    </div>
  );
}
