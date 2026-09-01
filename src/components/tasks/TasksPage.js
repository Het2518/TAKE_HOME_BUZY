"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";

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
      setIsLoading(true);
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

  useEffect(() => { load(1); }, [filters, load]);

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
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'sortBy' && k !== 'sortDir' && k !== 'search' && v).length + (filters.search ? 1 : 0);

  const IconFilter = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>;
  const IconSearch = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;

  return (
    <div className="grid container animate-fade-in" style={{ gap: 24, paddingBottom: selected.size > 0 ? 120 : 40 }}>
      <div className="flex-between">
        <h1 style={{ margin: 0 }}>All Tasks</h1>
        <div className="flex">
          <button className="secondary" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card grid" style={{ gap: 20 }}>
        
        {/* Search Bar & Primary Filters */}
        <div className="flex" style={{ flexWrap: "wrap", gap: 16 }}>
          <div className="flex" style={{ flex: "1 1 240px", position: "relative" }}>
            <span style={{ position: "absolute", left: 12, color: "var(--text-muted)", pointerEvents: "none" }}>{IconSearch}</span>
            <input
              placeholder="Search by title or ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: "100%", paddingLeft: 36, paddingRight: isLoading ? 36 : 12 }}
            />
            {isLoading && <span className="spinner" style={{ position: "absolute", right: 12 }} />}
          </div>
          
          <select value={filters.projectId} onChange={(e) => setFilters({ ...filters, projectId: e.target.value })} style={{ width: "auto" }}>
            <option value="">Project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ width: "auto" }}>
            <option value="">Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })} style={{ width: "auto" }}>
            <option value="">Assignee</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} style={{ width: "auto" }}>
            <option value="">Priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          
          <label className="flex" style={{ fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} />
            Overdue
          </label>
          
          {activeFilterCount > 0 && (
            <button className="ghost" onClick={() => {
              setSearchInput("");
              setFilters({ search: "", projectId: "", status: "", assigneeId: "", priority: "", overdue: false, sortBy: "updatedAt", sortDir: "desc" });
            }}>
              Clear filters
            </button>
          )}
        </div>
        
        {/* Saved Views & Sorting */}
        <div className="flex-between" style={{ flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="flex" style={{ gap: 12 }}>
            <span className="flex" style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>{IconFilter} Saved views:</span>
            {savedFilters.length === 0 && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>None</span>}
            {savedFilters.map((f) => (
              <span key={f.id} className="badge flex" style={{ gap: 6, padding: "2px 8px", background: "var(--panel-hover)" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); applySavedFilter(f); }} style={{ color: "var(--text)", textDecoration: "none" }}>
                  {f.name}
                </a>
                <button className="ghost" style={{ padding: 2, height: 16, width: 16, minWidth: 16, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => deleteSavedFilter(f.id)}>×</button>
              </span>
            ))}
            
            {isSavingFilterMode ? (
              <div className="flex animate-fade-in" style={{ gap: 8 }}>
                <input
                  placeholder="View name..."
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  style={{ fontSize: 13, padding: "4px 8px", width: 140 }}
                  autoFocus
                />
                <button className="primary" onClick={saveCurrentFilter} disabled={isSavingFilter || !newFilterName.trim()} style={{ fontSize: 12, padding: "4px 12px" }}>
                  Save
                </button>
                <button className="ghost" onClick={() => setIsSavingFilterMode(false)} style={{ fontSize: 12, padding: "4px 12px" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="ghost" onClick={() => setIsSavingFilterMode(true)} style={{ fontSize: 12, padding: "4px 8px", marginLeft: 8 }}>
                + Save current
              </button>
            )}
          </div>
          
          <div className="flex" style={{ gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Sort by:</span>
            <select value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })} style={{ width: "auto" }}>
              <option value="updatedAt">Last updated</option>
              <option value="dueDate">Due date</option>
              <option value="priority">Priority</option>
            </select>
            <select value={filters.sortDir} onChange={(e) => setFilters({ ...filters, sortDir: e.target.value })} style={{ width: "auto" }}>
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
          opacity: isLoading ? 0.4 : 0, pointerEvents: "none", transition: "opacity 200ms ease",
        }} />
        
        {isLoading && tasks.length === 0 ? (
          <div style={{ padding: 24 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height="40px" style={{ marginBottom: 12 }} />)}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48, textAlign: "center", padding: "12px 0 12px 16px" }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Select all on this page" />
                  </th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th>Assignees</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} style={{ background: selected.has(t.id) ? "var(--panel-highlight)" : "" }}>
                    <td style={{ textAlign: "center", padding: "12px 0 12px 16px" }}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} />
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <Link href={`/tasks/${t.id}`} className="flex flex-column" style={{ alignItems: "flex-start", gap: 4 }}>
                        <span>{t.title}</span>
                        <span className="badge" style={{ fontSize: 11, background: "transparent", padding: 0, border: "none", color: "var(--text-muted)" }}>{t.project?.key}-{t.id.substring(0, 4)}</span>
                      </Link>
                    </td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td className={`priority-${t.priority}`}>{t.priority}</td>
                    <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                    <td>
                      <div className="avatar-group">
                        {t.assignees.length > 0 
                          ? t.assignees.map(a => (
                              <div key={a.id} className="avatar" title={a.user.name}>
                                {a.user.name.charAt(0)}
                              </div>
                            ))
                          : <span style={{ color: "var(--text-dim)", fontSize: 13 }}>—</span>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && tasks.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 64 }}>
                      <div style={{ color: "var(--text-dim)", fontSize: 48, marginBottom: 16 }}>🔍</div>
                      <h3 style={{ marginBottom: 8, color: "var(--text)" }}>No tasks found</h3>
                      <p style={{ color: "var(--text-dim)", fontSize: 14, margin: 0 }}>Try adjusting your filters or search query.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      <div className="flex-between">
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
          {pagination.total} result{pagination.total !== 1 ? 's' : ''} — Page {pagination.page} of {pagination.totalPages || 1}
        </span>
        <div className="flex">
          <button className="secondary" disabled={pagination.page <= 1 || isLoading} onClick={() => load(pagination.page - 1)}>Previous</button>
          <button className="secondary" disabled={pagination.page >= pagination.totalPages || isLoading} onClick={() => load(pagination.page + 1)}>Next</button>
        </div>
      </div>

      {/* ── Bulk action toolbar (Floating Pill) ── */}
      {selected.size > 0 && (
        <div className="animate-slide-up" style={{
          position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)", zIndex: 100,
          background: "var(--panel)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-lg)",
          borderRadius: 999, padding: "12px 24px", display: "flex", gap: 24, alignItems: "center",
        }}>
          <div className="flex" style={{ gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--text)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
              {selected.size}
            </span>
            <span style={{ fontWeight: 500, color: "var(--text)", fontSize: 14 }}>Selected</span>
          </div>
          
          <div style={{ width: 1, height: 24, background: "var(--border)" }} />
          
          <div className="flex" style={{ gap: 12 }}>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} style={{ width: 140, borderRadius: 999, padding: "6px 12px" }}>
              <option value="STATUS">Set status...</option>
              <option value="ASSIGNEE">Assign to...</option>
              <option value="DUE_DATE">Set due date...</option>
            </select>

            {bulkAction === "STATUS" && (
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={{ width: 140, borderRadius: 999, padding: "6px 12px" }}>
                <option value="">Choose status...</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {bulkAction === "ASSIGNEE" && (
              <select value={bulkAssigneeId} onChange={(e) => setBulkAssigneeId(e.target.value)} style={{ width: 140, borderRadius: 999, padding: "6px 12px" }}>
                <option value="">Choose user...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {bulkAction === "DUE_DATE" && (
              <input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} style={{ width: 140, borderRadius: 999, padding: "6px 12px" }} />
            )}

            <button className="primary" onClick={applyBulk} disabled={isApplyingBulk} style={{ borderRadius: 999, padding: "6px 16px" }}>
              {isApplyingBulk ? <span className="spinner" /> : "Apply"}
            </button>
            <button className="ghost" onClick={() => setSelected(new Set())} style={{ borderRadius: 999, padding: "6px 16px" }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
