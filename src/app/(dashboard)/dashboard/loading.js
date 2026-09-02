// Dashboard page loading skeleton.
import { Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <Skeleton height="32px" width="200px" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Skeleton height="100px" />
        <Skeleton height="100px" />
        <Skeleton height="100px" />
      </div>
      <Skeleton height="200px" />
    </div>
  );
}
