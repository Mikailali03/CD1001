// Date and score helpers shared by the properties screen pieces
import { intlLocale } from "@/lib/dates";

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toISODate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

export function formatDate(s: string): string {
  return new Date(s + "T00:00:00").toLocaleDateString(intlLocale(), {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function scoreColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 75) return "#3b82f6";
  if (score >= 60) return "#f59e0b";
  if (score >= 45) return "#f97316";
  return "#ef4444";
}

export function scoreBg(score: number): string {
  if (score >= 90) return "#10b98118";
  if (score >= 75) return "#3b82f618";
  if (score >= 60) return "#f59e0b18";
  if (score >= 45) return "#f9731618";
  return "#ef444418";
}

export function scoreBorder(score: number): string {
  if (score >= 90) return "#10b98140";
  if (score >= 75) return "#3b82f640";
  if (score >= 60) return "#f59e0b40";
  if (score >= 45) return "#f9731640";
  return "#ef444440";
}

/** Key suffix under `properties.score.*` */
export function scoreLabel(score: number): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 45) return "poor";
  return "critical";
}
