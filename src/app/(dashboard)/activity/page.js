"use client";
import { useEffect, useState } from "react";

function describeEvent(e) {
  switch (e.type) {
    case "CREATED": return "created the task";
    case "STATUS_CHANGE": return `changed status: ${e.oldValue} → ${e.newValue}`;
    case "FIELD_CHANGE": return `updated ${e.field}`;
    case "ASSIGNED": return "assigned someone";
    case "UNASSIGNED": return "unassigned someone";
    case "COMMENT": return `commented: "${e.commentText}"`;
    default: return e.type;
  }
}

export default function ActivityPage() {
  const [data, setData] = useState({ events: [], pagination: { page: 1, totalPages: 1 } });

  function load(page = 1) {
    fetch(`/api/activity?page=${page}`).then((r) => r.json()).then(setData);
  }
  useEffect(load, []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1>Activity</h1>
      <div className="grid" style={{ gap: 8 }}>
        {data.events.map((e) => (
          <div key={e.id} className="card" style={{ padding: 12, fontSize: 14 }}>
            <strong>{e.user.name}</strong> {describeEvent(e)} on{" "}
            <a href={`/tasks/${e.task.id}`}>{e.task.title}</a>
            <span style={{ color: "var(--text-dim)" }}> ({e.task.project.key})</span>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {new Date(e.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
        {data.events.length === 0 && <p style={{ color: "var(--text-dim)" }}>No activity yet.</p>}
      </div>
      <div className="flex-between">
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
          Page {data.pagination.page} of {data.pagination.totalPages || 1}
        </span>
        <div className="flex">
          <button className="secondary" disabled={data.pagination.page <= 1} onClick={() => load(data.pagination.page - 1)}>Prev</button>
          <button className="secondary" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => load(data.pagination.page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
