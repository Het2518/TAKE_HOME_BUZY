"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
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

function StatCard({ label, value, color, icon }) {
  return (
    <div className="card flex-between animate-slide-up" style={{ padding: "20px 24px" }}>
      <div>
        <div style={{ color: "var(--text-dim)", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: color || "var(--text)", lineHeight: 1 }}>
          {value}
        </div>
      </div>
      {icon && (
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--panel-hover)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 24 }}>
          {icon}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid" style={{ gap: 24 }}>
      <h1>Dashboard</h1>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} height="100px" className="card" />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Skeleton height="300px" className="card" />
        <Skeleton height="300px" className="card" />
      </div>
      <Skeleton height="300px" className="card" />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <DashboardSkeleton />;

  return (
    <div className="grid animate-fade-in" style={{ gap: 24 }}>
      <h1>Dashboard</h1>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatCard label="Open tasks" value={data.headline.open} icon="📋" />
        <StatCard label="Overdue" value={data.headline.overdue} color="var(--danger)" icon="⚠️" />
        <StatCard label="Due this week" value={data.headline.dueThisWeek} color="var(--warning)" icon="📅" />
        <StatCard label="Completed this week" value={data.headline.completedThisWeek} color="var(--success)" icon="✅" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card animate-slide-up" style={{ animationDelay: "100ms" }}>
          <h3>Tasks by Status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byStatus} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="status" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--panel-hover)" }} contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card animate-slide-up" style={{ animationDelay: "150ms" }}>
          <h3>Tasks by Assignee</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byAssignee} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--panel-hover)" }} contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }} />
              <Bar dataKey="count" fill="var(--success)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card animate-slide-up" style={{ animationDelay: "200ms" }}>
        <h3>Completions — Last 8 Weeks</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.completionsByWeek} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="weekStart" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }} />
            <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: "var(--panel)", strokeWidth: 2 }} activeDot={{ r: 6, fill: "var(--accent)" }} isAnimationActive={true} animationDuration={1200} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
