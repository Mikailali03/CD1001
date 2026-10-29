export type Urgency = "critical" | "warning" | "good" | "unknown";

// Labels: capitalOutlook.urgency.<key>
export const URGENCY_CONFIG: Record<Urgency, { textColor: string; bg: string; borderColor: string; barColor: string }> = {
  critical: { textColor: "#dc2626", bg: "#fef2f2", borderColor: "#fca5a5", barColor: "#ef4444" },
  warning:  { textColor: "#d97706", bg: "#fffbeb", borderColor: "#fcd34d", barColor: "#f59e0b" },
  good:     { textColor: "#059669", bg: "#d1fae5", borderColor: "#6ee7b7", barColor: "#22c55e" },
  unknown:  { textColor: "#6b7280", bg: "#f3f4f6", borderColor: "#e5e7eb", barColor: "#94a3b8" },
};
