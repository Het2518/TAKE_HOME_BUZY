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
        <div style={{ color: "var(--text-dim)", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: color || "var(--text)", lineHeight: 1, letterSpacing: "-0.02em" }}>
          {value}
        </div>
      </div>
      {icon && (
        <div style={{ width: 40, height: 40, borderRadius: "8px", background: "var(--panel-hover)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
          {icon}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid" style={{ gap: 24 }}>
      <Skeleton height="32px" width="200px" style={{ marginBottom: 16 }} />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} height="100px" className="card" />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))" }}>
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

  if (!data) return (
    <div className="container animate-fade-in">
      <DashboardSkeleton />
    </div>
  );

  const tooltipStyle = {
    background: "var(--panel)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-md)",
    boxShadow: "var(--shadow-lg)",
    color: "var(--text)",
    fontSize: 13,
    padding: "8px 12px"
  };

  const IconOpen = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
  const IconAlert = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
  const IconCalendar = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
  const IconCheck = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;

  return (
    <div className="container grid animate-fade-in" style={{ gap: 24 }}>
      <h1 style={{ marginBottom: 0 }}>Dashboard</h1>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <StatCard label="Open tasks" value={data.headline.open} icon={IconOpen} />
        <StatCard label="Overdue" value={data.headline.overdue} color="var(--danger)" icon={IconAlert} />
        <StatCard label="Due this week" value={data.headline.dueThisWeek} color="var(--warning)" icon={IconCalendar} />
        <StatCard label="Completed this week" value={data.headline.completedThisWeek} color="var(--success)" icon={IconCheck} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))" }}>
        <div className="card animate-slide-up" style={{ animationDelay: "100ms" }}>
          <h3 style={{ marginBottom: 24 }}>Tasks by Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byStatus} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="status" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--panel-hover)" }} contentStyle={tooltipStyle} itemStyle={{ color: "var(--text)" }} />
              <Bar dataKey="count" fill="var(--text)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card animate-slide-up" style={{ animationDelay: "150ms" }}>
          <h3 style={{ marginBottom: 24 }}>Tasks by Assignee</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.byAssignee} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--panel-hover)" }} contentStyle={tooltipStyle} itemStyle={{ color: "var(--text)" }} />
              <Bar dataKey="count" fill="var(--text-dim)" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card animate-slide-up" style={{ animationDelay: "200ms" }}>
        <h3 style={{ marginBottom: 24 }}>Completions — Last 8 Weeks</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.completionsByWeek} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="weekStart" stroke="var(--text-dim)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
            <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--text)" }} />
            <Line type="monotone" dataKey="count" stroke="var(--text)" strokeWidth={2} dot={{ r: 4, fill: "var(--panel)", strokeWidth: 2 }} activeDot={{ r: 6, fill: "var(--text)", strokeWidth: 0 }} isAnimationActive={true} animationDuration={1000} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
