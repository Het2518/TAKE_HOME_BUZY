"use client";
import { useEffect, useState, useRef } from "react";

// Format seconds as "2h 34m 12s"
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(" ");
}

// Live counter that counts up from startedAt
function LiveTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const base = Math.floor((Date.now() - new Date(startedAt)) / 1000);
    setElapsed(base);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDuration(elapsed)}</span>;
}

export default function TimeTracker({ taskId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [desc, setDesc] = useState("");

  const load = () =>
    fetch(`/api/tasks/${taskId}/time`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, [taskId]); // eslint-disable-line

  const openEntry = data?.entries?.find((e) => !e.endedAt);

  async function startTimer() {
    await fetch(`/api/tasks/${taskId}/time`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: desc }) });
    setDesc("");
    load();
  }

  async function stopTimer() {
    await fetch(`/api/tasks/${taskId}/time/${openEntry.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: desc }),
    });
    setDesc("");
    load();
  }

  async function deleteEntry(id) {
    if (!confirm("Delete this time entry?")) return;
    await fetch(`/api/tasks/${taskId}/time/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading time log…</div>;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="flex-between">
        <h3 style={{ margin: 0 }}>⏱ Time Tracking</h3>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
          Total: <strong>{formatDuration(data?.totalSeconds || 0)}</strong>
        </span>
      </div>

      {/* Timer controls */}
      <div className="flex" style={{ marginTop: 12, gap: 8 }}>
        <input
          placeholder={openEntry ? "Update description…" : "What are you working on?"}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{ flex: 1 }}
        />
        {openEntry ? (
          <button onClick={stopTimer} style={{ background: "var(--danger)", color: "#fff", border: "none" }}>
            ⏹ Stop (<LiveTimer startedAt={openEntry.startedAt} />)
          </button>
        ) : (
          <button onClick={startTimer} style={{ background: "var(--success)", color: "#fff", border: "none" }}>
            ▶ Start
          </button>
        )}
      </div>

      {/* Entries list */}
      {data?.entries?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {data.entries.filter((e) => e.endedAt).map((e) => (
            <div key={e.id} className="flex-between" style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span>
                {e.user.name} · {formatDuration(Math.round((new Date(e.endedAt) - new Date(e.startedAt)) / 1000))}
                {e.description && <span style={{ color: "var(--text-dim)" }}> — {e.description}</span>}
              </span>
              <span style={{ color: "var(--text-dim)" }}>
                {new Date(e.startedAt).toLocaleDateString()}
                <button
                  className="secondary"
                  style={{ marginLeft: 8, padding: "2px 6px", fontSize: 12 }}
                  onClick={() => deleteEntry(e.id)}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
