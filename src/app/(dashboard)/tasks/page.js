"use client";
import { useEffect, useState, useCallback, useRef } from "react";

const STATUSES = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SEARCH_DEBOUNCE_MS = 350;

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [searchInput, setSearchInput] = useState(""); // what the user is typing, right now
  const [filters, setFilters] = useState({
    search: "", projectId: "", status: "", assigneeId: "", priority: "",
    overdue: false, sortBy: "updatedAt", sortDir: "desc",
  });
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("STATUS");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkResults, setBulkResults] = useState(null);
  const [savedFilters, setSavedFilters] = useState([]);
  const [newFilterName, setNewFilterName] = useState("");
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [isSavingFilter, setIsSavingFilter] = useState(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0); // guards against an in-flight older request overwriting a newer result

  // Load reference data for filter dropdowns (projects + users)
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects).catch(() => {});
    fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
  }, []);

  function loadSavedFilters() {
    fetch("/api/saved-filters").then((r) => r.json()).then(setSavedFilters);
  }
  useEffect(loadSavedFilters, []);

  // Debounce: typing in the search box updates `searchInput` instantly (so the input feels
  // responsive), but only pushes into `filters` — which triggers the actual network request —
  // after the user pauses typing for SEARCH_DEBOUNCE_MS.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  async function saveCurrentFilter() {
    if (!newFilterName.trim()) return;
    setIsSavingFilter(true);
    await fetch("/api/saved-filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFilterName, filterJson: filters }),
    });
    setIsSavingFilter(false);
    setNewFilterName("");
    loadSavedFilters();
  }

  function applySavedFilter(f) {
    const applied = JSON.parse(f.filterJson);
    setFilters({ ...filters, ...applied });
    setSearchInput(applied.search ?? "");
  }

  async function deleteSavedFilter(id) {
    await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });
    loadSavedFilters();
  }

  const buildQuery = useCallback((page = 1) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.status) params.set("status", filters.status);
    if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.overdue) params.set("overdue", "true");
    params.set("sortBy", filters.sortBy);
    params.set("sortDir", filters.sortDir);
    params.set("page", String(page));
    params.set("pageSize", "20");
    return params.toString();
  }, [filters]);

  const load = useCallback((page = 1) => {
    setIsLoading(true);
    const thisRequestId = ++requestIdRef.current;
    fetch(`/api/tasks?${buildQuery(page)}`)
      .then((r) => r.json())
      .then((d) => {
        // If a newer request has started since this one fired, discard stale response.
        if (thisRequestId !== requestIdRef.current) return;
        setTasks(d.tasks || []);
        setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 });
      })
      .finally(() => {
        if (thisRequestId === requestIdRef.current) setIsLoading(false);
      });
  }, [buildQuery]);

  useEffect(() => { load(1); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSelect(id) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === tasks.length && tasks.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tasks.map((t) => t.id)));
    }
  }

  async function applyBulk() {
    if (selected.size === 0) return;
    let action, value;
    if (bulkAction === "STATUS") {
      if (!bulkStatus) return;
      action = "STATUS"; value = bulkStatus;
    } else if (bulkAction === "ASSIGNEE") {
      if (!bulkAssigneeId) return;
      action = "ASSIGNEE"; value = bulkAssigneeId;
    } else if (bulkAction === "DUE_DATE") {
      if (!bulkDueDate) return;
      action = "DUE_DATE"; value = new Date(bulkDueDate).toISOString();
    } else return;

    setIsApplyingBulk(true);
    const res = await fetch("/api/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: Array.from(selected), action, value }),
    });
    const data = await res.json();
    setIsApplyingBulk(false);
    setBulkResults(data.results);
    setSelected(new Set());
    load(pagination.page);
  }

  function exportCsv() {
    window.open(`/api/tasks/export?${buildQuery()}`, "_blank");
  }

  const allSelected = tasks.length > 0 && selected.size === tasks.length;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="flex-between">
        <h1>All Tasks</h1>
        <button onClick={exportCsv}>Export CSV</button>
      </div>

      {/* ── Filters ── */}
      <div className="card flex" style={{ flexWrap: "wrap" }}>
        <input
          placeholder="Search title/description"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}>
          <option value="">All assignees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="flex">
          <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} />
          Overdue only
        </label>
        <select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}>
          <option value="updatedAt">Sort: last updated</option>
          <option value="dueDate">Sort: due date</option>
          <option value="priority">Sort: priority</option>
        </select>
        <select value={filters.sortDir} onChange={(e) => setFilters({ ...filters, sortDir: e.target.value })}>
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        {isLoading && <span className="spinner" aria-label="Loading" />}
      </div>

      {/* ── Saved filter views ── */}
      <div className="card flex" style={{ flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Saved views:</span>
        {savedFilters.map((f) => (
          <span key={f.id} className="badge flex" style={{ gap: 6, paddingRight: 4 }}>
            <button
              className="secondary"
              style={{ padding: "0 4px", border: "none", fontSize: 12 }}
              onClick={() => applySavedFilter(f)}
            >
              {f.name}
            </button>
            <button
              className="secondary"
              style={{ padding: "0 4px", border: "none", fontSize: 12, color: "var(--danger)" }}
              onClick={() => deleteSavedFilter(f.id)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          placeholder="Save current filters as..."
          value={newFilterName}
          onChange={(e) => setNewFilterName(e.target.value)}
          style={{ fontSize: 12, padding: "4px 8px" }}
        />
        <button onClick={saveCurrentFilter} disabled={isSavingFilter} style={{ fontSize: 12, padding: "4px 10px" }}>
          {isSavingFilter ? "Saving…" : "Save"}
        </button>
      </div>

      {/* ── Bulk action toolbar — appears when rows are selected ── */}
      {selected.size > 0 && (
        <div className="card flex-between" style={{ background: "var(--panel-highlight)" }}>
          <span>{selected.size} selected</span>
          <div className="flex" style={{ flexWrap: "wrap", gap: 8 }}>
            {/* Action type switcher */}
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option value="STATUS">Change status</option>
              <option value="ASSIGNEE">Assign user</option>
              <option value="DUE_DATE">Set due date</option>
            </select>

            {/* Context-sensitive value picker — goal 7 requires all three actions */}
            {bulkAction === "STATUS" && (
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                <option value="">Move to status...</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {bulkAction === "ASSIGNEE" && (
              <select value={bulkAssigneeId} onChange={(e) => setBulkAssigneeId(e.target.value)}>
                <option value="">Pick assignee...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {bulkAction === "DUE_DATE" && (
              <input
                type="date"
                value={bulkDueDate}
                onChange={(e) => setBulkDueDate(e.target.value)}
                style={{ padding: "4px 8px" }}
              />
            )}

            <button onClick={applyBulk} disabled={isApplyingBulk}>
              {isApplyingBulk ? "Applying…" : "Apply"}
            </button>
            <button className="secondary" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {/* ── Per-task bulk results ── */}
      {bulkResults && (
        <div className="card">
          <div className="flex-between">
            <strong>Bulk action results</strong>
            <button className="secondary" onClick={() => setBulkResults(null)}>Dismiss</button>
          </div>
          <ul style={{ fontSize: 13 }}>
            {bulkResults.map((r) => (
              <li key={r.taskId} style={{ color: r.success ? "var(--success)" : "var(--danger)" }}>
                {r.taskId}: {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Task table ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  title="Select all on this page"
                />
              </th>
              <th>Title</th><th>Project</th><th>Status</th>
              <th>Priority</th><th>Due</th><th>Assignees</th>
            </tr>
          </thead>
          <tbody style={{ opacity: isLoading ? 0.5 : 1, transition: "opacity 120ms ease" }}>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                <td><a href={`/tasks/${t.id}`}>{t.title}</a></td>
                <td>{t.project?.key}</td>
                <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                <td className={`priority-${t.priority}`}>{t.priority}</td>
                <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                <td>{t.assignees.map((a) => a.user.name).join(", ") || "—"}</td>
              </tr>
            ))}
            {!isLoading && tasks.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-dim)", padding: 24 }}>No tasks match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex-between">
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
          {pagination.total} total matches — page {pagination.page} of {pagination.totalPages || 1}
        </span>
        <div className="flex">
          <button className="secondary" disabled={pagination.page <= 1 || isLoading} onClick={() => load(pagination.page - 1)}>Prev</button>
          <button className="secondary" disabled={pagination.page >= pagination.totalPages || isLoading} onClick={() => load(pagination.page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
