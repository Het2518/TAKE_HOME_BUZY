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

// ── SVG Icons ─────────────────────────────────────────────────
const IconOpenTasks = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconOverdue = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconCalendar = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconCheck = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

function StatCard({ label, value, color, bgColor, icon, delay = 0 }) {
  return (
    <div
      className="stat-card animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="stat-card-icon"
        style={{ background: bgColor, color: color }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value" style={{ color }}>
          {value ?? "—"}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--radius-md)" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        <div className="skeleton card" style={{ height: 300 }} />
        <div className="skeleton card" style={{ height: 300 }} />
      </div>
      <div className="skeleton card" style={{ height: 300 }} />
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      color: "var(--text-dim)",
      marginBottom: 12,
    }}>
      {title}
    </div>
  );
}

const customTooltipStyle = {
  background: "var(--panel-raised)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-lg)",
  color: "var(--text)",
  fontSize: 12,
  padding: "8px 12px",
};

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="container animate-fade-in">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-header-title">
          <h1>Dashboard</h1>
          <div className="page-header-subtitle">
            Your workspace at a glance
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <StatCard
          label="Open Tasks"
          value={data.headline.open}
          color="var(--text)"
          bgColor="var(--panel-hover)"
          icon={IconOpenTasks}
          delay={0}
        />
        <StatCard
          label="Overdue"
          value={data.headline.overdue}
          color="var(--danger)"
          bgColor="var(--danger-bg)"
          icon={IconOverdue}
          delay={60}
        />
        <StatCard
          label="Due This Week"
          value={data.headline.dueThisWeek}
          color="var(--warning)"
          bgColor="var(--warning-bg)"
          icon={IconCalendar}
          delay={120}
        />
        <StatCard
          label="Completed This Week"
          value={data.headline.completedThisWeek}
          color="var(--success)"
          bgColor="var(--success-bg)"
          icon={IconCheck}
          delay={180}
        />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        {/* Tasks by Status */}
        <div className="card animate-slide-up" style={{ animationDelay: "100ms" }}>
          <SectionHeader title="Tasks by Status" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.byStatus}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              barSize={22}
            >
              <CartesianGrid
                strokeDasharray="none"
                vertical={false}
                stroke="var(--border)"
                opacity={0.7}
              />
              <XAxis
                dataKey="status"
                stroke="transparent"
                tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval={0}
                tickFormatter={(v) => v.replace("_", " ")}
              />
              <YAxis
                stroke="transparent"
                tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--panel-hover)" }}
                contentStyle={customTooltipStyle}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}
              />
              <Bar
                dataKey="count"
                fill="var(--text)"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={700}
                opacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tasks by Assignee */}
        <div className="card animate-slide-up" style={{ animationDelay: "160ms" }}>
          <SectionHeader title="Tasks by Assignee" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.byAssignee}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              barSize={22}
            >
              <CartesianGrid
                strokeDasharray="none"
                vertical={false}
                stroke="var(--border)"
                opacity={0.7}
              />
              <XAxis
                dataKey="name"
                stroke="transparent"
                tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                dy={8}
                tickFormatter={(v) => v.split(" ")[0]}
              />
              <YAxis
                stroke="transparent"
                tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--panel-hover)" }}
                contentStyle={customTooltipStyle}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}
              />
              <Bar
                dataKey="count"
                fill="var(--text-secondary)"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={700}
                opacity={0.7}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Completion trend ── */}
      <div className="card animate-slide-up" style={{ animationDelay: "220ms" }}>
        <SectionHeader title="Task Completions — Last 8 Weeks" />
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={data.completionsByWeek}
            margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="none"
              vertical={false}
              stroke="var(--border)"
              opacity={0.7}
            />
            <XAxis
              dataKey="weekStart"
              stroke="transparent"
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="transparent"
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={customTooltipStyle}
              itemStyle={{ color: "var(--text)" }}
              labelStyle={{ color: "var(--text-dim)", fontSize: 11, marginBottom: 4 }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--text)"
              strokeWidth={1.5}
              dot={{ r: 3, fill: "var(--panel)", strokeWidth: 1.5, stroke: "var(--text)" }}
              activeDot={{ r: 5, fill: "var(--text)", strokeWidth: 0 }}
              isAnimationActive
              animationDuration={900}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
