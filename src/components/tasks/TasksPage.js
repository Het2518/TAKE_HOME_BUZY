"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";

const STATUSES = ["BACKLOG", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SEARCH_DEBOUNCE_MS = 350;

// ── Icons ─────────────────────────────────────────────────────
const IconSearch = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconFilter = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const IconX = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconDownload = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconSave = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const IconCheckEmpty = (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IconChevronLeft = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconChevronRight = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// Status/priority label helpers
const STATUS_LABELS = {
  BACKLOG: "Backlog",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  BLOCKED: "Blocked",
};
const PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function PriorityPip({ priority }) {
  return (
    <span
      className="flex gap-4"
      style={{ fontSize: 12, fontWeight: 500, color: `var(--priority-${priority?.toLowerCase() || "medium"})` }}
    >
      <span className={`priority-bar ${priority}`}>
        <span /><span /><span />
      </span>
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

function StatusIndicator({ status }) {
  return (
    <span className="status-indicator">
      <span className={`status-dot ${status}`} />
      <span style={{ color: `var(--status-${status?.toLowerCase().replace("_", "") || "backlog"})`, fontSize: 12.5 }}>
        {STATUS_LABELS[status] || status}
      </span>
    </span>
  );
}

function DueDateCell({ dueDate }) {
  if (!dueDate) return <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>;
  const d = new Date(dueDate);
  const now = new Date();
  const isOverdue = d < now;
  const formatted = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <span style={{ fontSize: 12.5, color: isOverdue ? "var(--danger)" : "var(--text-secondary)", fontWeight: isOverdue ? 500 : 400 }}>
      {formatted}
    </span>
  );
}

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
    const successes = data.results.filter((r) => r.success).length;
    const failures = data.results.length - successes;
    if (failures === 0) {
      addToast(`Updated ${successes} task${successes !== 1 ? "s" : ""}`, "success");
    } else {
      addToast(`Updated ${successes}. ${failures} failed.`, "warning");
    }
    setSelected(new Set());
    load(pagination.page);
  }

  function exportCsv() {
    window.open(`/api/tasks/export?${buildQuery()}`, "_blank");
    addToast("Exporting CSV…", "info");
  }

  function clearFilters() {
    setSearchInput("");
    setFilters({ search: "", projectId: "", status: "", assigneeId: "", priority: "", overdue: false, sortBy: "updatedAt", sortDir: "desc" });
  }

  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.projectId ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.assigneeId ? 1 : 0) +
    (filters.priority ? 1 : 0) +
    (filters.overdue ? 1 : 0);

  return (
    <div className="container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: selected.size > 0 ? 100 : 40 }}>

      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-title">
          <h1>All Tasks</h1>
          <div className="page-header-subtitle">
            {!isLoading && `${pagination.total} task${pagination.total !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={exportCsv} style={{ fontSize: 12 }}>
            {IconDownload} Export CSV
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Row 1: Search + filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", display: "flex" }}>
              {IconSearch}
            </span>
            <input
              placeholder="Search tasks…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: isLoading ? 32 : 10 }}
              id="task-search"
            />
            {isLoading && (
              <span className="spinner" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
            )}
          </div>

          {/* Project filter */}
          <select
            value={filters.projectId}
            onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
            style={{ width: "auto", flex: "0 0 auto" }}
            id="filter-project"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={{ width: "auto", flex: "0 0 auto" }}
            id="filter-status"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          {/* Priority filter */}
          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            style={{ width: "auto", flex: "0 0 auto" }}
            id="filter-priority"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>

          {/* Assignee filter */}
          <select
            value={filters.assigneeId}
            onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}
            style={{ width: "auto", flex: "0 0 auto" }}
            id="filter-assignee"
          >
            <option value="">All Assignees</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          {/* Overdue toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: filters.overdue ? "var(--danger)" : "var(--text-dim)", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })}
              id="filter-overdue"
            />
            Overdue only
          </label>

          {activeFilterCount > 0 && (
            <button className="ghost danger-ghost" onClick={clearFilters} style={{ fontSize: 12, padding: "4px 10px", gap: 4 }}>
              {IconX} Clear {activeFilterCount > 1 ? `(${activeFilterCount})` : ""}
            </button>
          )}
        </div>

        {/* Row 2: Saved views + sort */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border)", alignItems: "center" }}>
          {/* Saved views */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              {IconFilter} Views:
            </span>

            {savedFilters.length === 0 && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>None saved</span>
            )}

            {savedFilters.map((f) => (
              <span
                key={f.id}
                className="filter-pill"
              >
                <button
                  onClick={() => applySavedFilter(f)}
                  style={{ background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}
                >
                  {f.name}
                </button>
                <button
                  onClick={() => deleteSavedFilter(f.id)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", lineHeight: 1 }}
                  title="Delete view"
                >
                  {IconX}
                </button>
              </span>
            ))}

            {isSavingFilterMode ? (
              <span className="flex animate-fade-in" style={{ gap: 6 }}>
                <input
                  placeholder="View name…"
                  value={newFilterName}
                  onChange={(e) => setNewFilterName(e.target.value)}
                  style={{ fontSize: 12, padding: "4px 8px", width: 130 }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Escape" && setIsSavingFilterMode(false)}
                />
                <button
                  className="primary"
                  onClick={saveCurrentFilter}
                  disabled={isSavingFilter || !newFilterName.trim()}
                  style={{ fontSize: 11, padding: "4px 10px" }}
                >
                  Save
                </button>
                <button
                  className="ghost"
                  onClick={() => setIsSavingFilterMode(false)}
                  style={{ fontSize: 11, padding: "4px 8px" }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                className="ghost"
                onClick={() => setIsSavingFilterMode(true)}
                style={{ fontSize: 11.5, padding: "3px 8px", gap: 4 }}
              >
                {IconSave} Save view
              </button>
            )}
          </div>

          {/* Sort controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sort:</span>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              style={{ width: "auto", fontSize: 12, padding: "4px 8px" }}
              id="sort-by"
            >
              <option value="updatedAt">Last updated</option>
              <option value="dueDate">Due date</option>
              <option value="priority">Priority</option>
            </select>
            <select
              value={filters.sortDir}
              onChange={(e) => setFilters({ ...filters, sortDir: e.target.value })}
              style={{ width: "auto", fontSize: 12, padding: "4px 8px" }}
              id="sort-dir"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Task table ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        {/* Loading overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "var(--panel)",
          zIndex: 5,
          opacity: isLoading && tasks.length > 0 ? 0.5 : 0,
          pointerEvents: "none",
          transition: "opacity 200ms ease",
        }} />

        {isLoading && tasks.length === 0 ? (
          <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="skeleton" style={{ height: 38, borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44, padding: "9px 0 9px 14px" }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      title="Select all"
                      id="select-all"
                    />
                  </th>
                  <th>Task</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 110 }}>Priority</th>
                  <th style={{ width: 100 }}>Due</th>
                  <th style={{ width: 100 }}>Assignees</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      background: selected.has(t.id) ? "var(--panel-highlight)" : "",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleSelect(t.id)}
                  >
                    <td style={{ padding: "10px 0 10px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/tasks/${t.id}`}
                        style={{ display: "flex", flexDirection: "column", gap: 2, color: "inherit" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", lineHeight: 1.4 }}>
                          {t.title}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {t.project?.key}-{t.id.substring(0, 6)}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <StatusIndicator status={t.status} />
                    </td>
                    <td>
                      <PriorityPip priority={t.priority} />
                    </td>
                    <td>
                      <DueDateCell dueDate={t.dueDate} />
                    </td>
                    <td>
                      {t.assignees.length > 0 ? (
                        <div className="avatar-group">
                          {t.assignees.slice(0, 3).map((a) => (
                            <div key={a.id} className="avatar sm" title={a.user.name}>
                              {a.user.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {t.assignees.length > 3 && (
                            <div className="avatar sm" style={{ color: "var(--text-muted)" }}>
                              +{t.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {!isLoading && tasks.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0, border: "none" }}>
                      <div className="empty-state">
                        <div className="empty-state-icon">{IconCheckEmpty}</div>
                        <h3>No tasks found</h3>
                        <p>Try adjusting your filters or search query.</p>
                        {activeFilterCount > 0 && (
                          <button className="secondary" onClick={clearFilters} style={{ marginTop: 4, fontSize: 12 }}>
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!isLoading && tasks.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
            {pagination.total} result{pagination.total !== 1 ? "s" : ""}
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
              · Page {pagination.page} of {pagination.totalPages || 1}
            </span>
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="secondary"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => load(pagination.page - 1)}
              style={{ padding: "5px 10px" }}
              id="prev-page"
            >
              {IconChevronLeft} Prev
            </button>
            <button
              className="secondary"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => load(pagination.page + 1)}
              style={{ padding: "5px 10px" }}
              id="next-page"
            >
              Next {IconChevronRight}
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk action floating toolbar ── */}
      {selected.size > 0 && (
        <div
          className="animate-slide-up"
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            background: "var(--panel-raised)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-xl)",
            borderRadius: "var(--radius-full)",
            padding: "10px 20px",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          {/* Selection count */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--text)", color: "var(--bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              {selected.size}
            </span>
            <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap" }}>
              selected
            </span>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: "var(--border-strong)" }} />

          {/* Action controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              style={{ width: 140, borderRadius: "var(--radius-full)", padding: "5px 10px", fontSize: 12 }}
              id="bulk-action-select"
            >
              <option value="STATUS">Set status…</option>
              <option value="ASSIGNEE">Assign to…</option>
              <option value="DUE_DATE">Set due date…</option>
            </select>

            {bulkAction === "STATUS" && (
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                style={{ width: 140, borderRadius: "var(--radius-full)", padding: "5px 10px", fontSize: 12 }}
                id="bulk-status-select"
              >
                <option value="">Choose status…</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            )}
            {bulkAction === "ASSIGNEE" && (
              <select
                value={bulkAssigneeId}
                onChange={(e) => setBulkAssigneeId(e.target.value)}
                style={{ width: 140, borderRadius: "var(--radius-full)", padding: "5px 10px", fontSize: 12 }}
                id="bulk-assignee-select"
              >
                <option value="">Choose user…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {bulkAction === "DUE_DATE" && (
              <input
                type="date"
                value={bulkDueDate}
                onChange={(e) => setBulkDueDate(e.target.value)}
                style={{ width: 140, borderRadius: "var(--radius-full)", padding: "5px 10px", fontSize: 12 }}
                id="bulk-due-date"
              />
            )}

            <button
              className="primary"
              onClick={applyBulk}
              disabled={isApplyingBulk}
              style={{ borderRadius: "var(--radius-full)", padding: "5px 16px", fontSize: 12 }}
              id="apply-bulk"
            >
              {isApplyingBulk ? <span className="spinner" style={{ width: 12, height: 12, borderTopColor: "var(--accent-contrast)" }} /> : "Apply"}
            </button>
            <button
              className="ghost"
              onClick={() => setSelected(new Set())}
              style={{ borderRadius: "var(--radius-full)", padding: "5px 12px", fontSize: 12 }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
