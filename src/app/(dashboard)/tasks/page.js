"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

const STATUSES = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SEARCH_DEBOUNCE_MS = 350;

export default function TasksPage() {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    search: "", projectId: "", status: "", assigneeId: "", priority: "",
    overdue: false, sortBy: "updatedAt", sortDir: "desc",
  });
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("STATUS");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [savedFilters, setSavedFilters] = useState([]);
  const [newFilterName, setNewFilterName] = useState("");
  const [isSavingFilterMode, setIsSavingFilterMode] = useState(false);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [isSavingFilter, setIsSavingFilter] = useState(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects).catch(() => {});
    fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
  }, []);

  function loadSavedFilters() {
    fetch("/api/saved-filters").then((r) => r.json()).then(setSavedFilters);
  }
  useEffect(loadSavedFilters, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchInput !== filters.search) {
      setIsLoading(true); // immediately show loading on type
      debounceRef.current = setTimeout(() => {
        setFilters((f) => ({ ...f, search: searchInput }));
      }, SEARCH_DEBOUNCE_MS);
    }
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, filters.search]);

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
    setIsSavingFilterMode(false);
    addToast("Filter view saved", "success");
    loadSavedFilters();
  }

  function applySavedFilter(f) {
    const applied = JSON.parse(f.filterJson);
    setFilters({ ...filters, ...applied });
    setSearchInput(applied.search ?? "");
  }

  async function deleteSavedFilter(id) {
    await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });
    addToast("Filter view deleted", "info");
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
    
    const successes = data.results.filter(r => r.success).length;
    const failures = data.results.length - successes;
    
    if (failures === 0) {
      addToast(`Successfully updated ${successes} tasks`, "success");
    } else {
      addToast(`Updated ${successes} tasks. ${failures} failed.`, "warning");
    }
    
    setSelected(new Set());
    load(pagination.page);
  }

  function exportCsv() {
    window.open(`/api/tasks/export?${buildQuery()}`, "_blank");
    addToast("Exporting CSV...", "info");
  }

  const allSelected = tasks.length > 0 && selected.size === tasks.length;

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24, paddingBottom: selected.size > 0 ? 100 : 24 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>All Tasks</h1>
        <button className="secondary" onClick={exportCsv}>Export CSV</button>
      </div>

      {/* ── Filters ── */}
      <div className="card grid" style={{ gap: 16 }}>
        <div className="flex" style={{ flexWrap: "wrap", gap: 12 }}>
          <input
            placeholder="Search title/description"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: "1 1 200px" }}
          />
          <select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}
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
        </div>
        
        <div className="flex-between" style={{ flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="flex" style={{ gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>Saved views:</span>
            {savedFilters.map((f) => (
              <span key={f.id} className="badge flex" style={{ gap: 6, padding: "4px 8px" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); applySavedFilter(f); }} style={{ color: "inherit", textDecoration: "none" }}>
                  {f.name}
                </a>
                <button className="ghost" style={{ padding: 2, height: 16, width: 16, minWidth: 16, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => deleteSavedFilter(f.id)}>×</button>
              </span>
            ))}
            
            {isSavingFilterMode ? (
              <div className="flex animate-fade-in" style={{ gap: 4 }}>
                <input
                  placeholder="View name..."
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  style={{ fontSize: 12, padding: "4px 8px", minHeight: 24, height: 28 }}
                  autoFocus
                />
                <button className="primary" onClick={saveCurrentFilter} disabled={isSavingFilter || !newFilterName.trim()} style={{ fontSize: 12, padding: "4px 10px", height: 28 }}>
                  Save
                </button>
                <button className="ghost" onClick={() => setIsSavingFilterMode(false)} style={{ fontSize: 12, padding: "4px 8px", height: 28 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="secondary" onClick={() => setIsSavingFilterMode(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999 }}>
                + Save current
              </button>
            )}
          </div>
          
          <div className="flex" style={{ gap: 12 }}>
            <label className="flex" style={{ fontSize: 13, color: "var(--text-dim)" }}>
              <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} />
              Overdue only
            </label>
            <select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })} style={{ fontSize: 13, padding: "4px 8px" }}>
              <option value="updatedAt">Sort: last updated</option>
              <option value="dueDate">Sort: due date</option>
              <option value="priority">Sort: priority</option>
            </select>
            <select value={filters.sortDir} onChange={(e) => setFilters({ ...filters, sortDir: e.target.value })} style={{ fontSize: 13, padding: "4px 8px" }}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Task table ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        {/* Shimmer overlay for loading */}
        <div style={{
          position: "absolute", inset: 0, background: "var(--panel)", zIndex: 5,
          opacity: isLoading ? 0.7 : 0, pointerEvents: "none", transition: "opacity 200ms ease",
        }} />
        
        {isLoading && tasks.length === 0 ? (
          <div style={{ padding: 24 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="40px" style={{ marginBottom: 12 }} />)}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Select all on this page" />
                  </th>
                  <th>Title</th><th>Project</th><th>Status</th>
                  <th>Priority</th><th>Due</th><th>Assignees</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} style={{ background: selected.has(t.id) ? "var(--panel-highlight)" : "" }}>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} />
                    </td>
                    <td style={{ fontWeight: 500 }}><a href={`/tasks/${t.id}`}>{t.title}</a></td>
                    <td><span className="badge" style={{ background: "transparent" }}>{t.project?.key}</span></td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td className={`priority-${t.priority}`}>{t.priority}</td>
                    <td style={{ color: "var(--text-dim)" }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                    <td>
                      <div className="flex">
                        {t.assignees.length > 0 
                          ? t.assignees.map(a => (
                              <div key={a.id} title={a.user.name} style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, marginLeft: -8, border: "2px solid var(--panel)" }}>
                                {a.user.name.charAt(0)}
                              </div>
                            ))
                          : <span style={{ color: "var(--text-dim)" }}>—</span>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && tasks.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-dim)", padding: 48 }}>No tasks match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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

      {/* ── Bulk action toolbar (Fixed at bottom) ── */}
      {selected.size > 0 && (
        <div className="animate-slide-up" style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 100,
          background: "var(--panel)", border: "1px solid var(--accent)", boxShadow: "var(--shadow-lg)",
          borderRadius: "var(--radius-lg)", padding: "16px 24px", display: "flex", gap: 24, alignItems: "center",
        }}>
          <span style={{ fontWeight: 600, color: "var(--accent)" }}>{selected.size} selected</span>
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          <div className="flex" style={{ flexWrap: "wrap", gap: 12 }}>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option value="STATUS">Change status</option>
              <option value="ASSIGNEE">Assign user</option>
              <option value="DUE_DATE">Set due date</option>
            </select>

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
              <input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} />
            )}

            <button className="primary" onClick={applyBulk} disabled={isApplyingBulk}>
              {isApplyingBulk ? <span className="spinner" /> : "Apply"}
            </button>
            <button className="ghost" onClick={() => setSelected(new Set())}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
