"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

function StatCard({ label, value, color }) {
  return (
    <div className="card">
      <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex" style={{ justifyContent: "center", paddingTop: 60 }}>
        <span className="spinner" /> <span style={{ color: "var(--text-dim)" }}>Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 24 }}>
      <h1>Dashboard</h1>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatCard label="Open tasks" value={data.headline.open} />
        <StatCard label="Overdue" value={data.headline.overdue} color="var(--danger)" />
        <StatCard label="Due this week" value={data.headline.dueThisWeek} color="var(--warning)" />
        <StatCard label="Completed this week" value={data.headline.completedThisWeek} color="var(--success)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h3>By status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="status" stroke="var(--text-dim)" fontSize={12} />
              <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>By assignee</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byAssignee}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} />
              <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }} />
              <Bar dataKey="count" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Completions — last 8 weeks</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.completionsByWeek}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="weekStart" stroke="var(--text-dim)" fontSize={12} />
            <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }} />
            <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
