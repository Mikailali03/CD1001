import type { TFunction } from "i18next";
import { format } from "@/lib/date";

/** "3d overdue" / "Due today" / "Due tomorrow" / "Due Mar 4, 2026". */
export function dueLabel(t: TFunction, diff: number, nextDueDate: string, withWasDue = false): string {
  const date = format(new Date(nextDueDate), "MMM d, yyyy");
  if (diff < 0) {
    return withWasDue
      ? t("assetDetail.due.overdueWasDue", { days: Math.abs(diff), date })
      : t("assetDetail.due.overdue", { days: Math.abs(diff) });
  }
  if (diff === 0) return t("assetDetail.due.today");
  if (diff === 1) return t("assetDetail.due.tomorrow");
  return t("assetDetail.due.on", { date });
}
