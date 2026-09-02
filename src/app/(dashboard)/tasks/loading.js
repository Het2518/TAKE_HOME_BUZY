// Tasks page loading skeleton — shown during route navigation to /tasks.
// Uses the same Skeleton component and spinner already in the codebase.
import { Skeleton } from "@/components/Skeleton";

export default function TasksLoading() {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <Skeleton height="36px" width="240px" />
      <Skeleton height="48px" />
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} height="52px" />
      ))}
    </div>
  );
}
