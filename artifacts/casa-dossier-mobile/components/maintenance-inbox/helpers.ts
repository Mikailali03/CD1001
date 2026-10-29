import { differenceInCalendarDays } from "date-fns";
import type { CompleteMaintenanceTaskBody, MaintenanceInboxTask } from "@workspace/api-client-react";
import i18n from "@/i18n";
import { intlLocale } from "@/lib/dates";

// estimatedCost is a decimal string ("45.00") — read it through Number()
export type InboxTask = MaintenanceInboxTask;

export type CompletePayload = Omit<CompleteMaintenanceTaskBody, "completedDate">;

export const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};

export function dueDateLabel(nextDueDate: string, isOverdue: boolean): string {
  const today = new Date();
  const due = new Date(nextDueDate + "T00:00:00");
  const diff = differenceInCalendarDays(due, today);
  const abs = Math.abs(diff);
  const date = due.toLocaleDateString(intlLocale(), { month: "short", day: "numeric" });
  if (isOverdue) return i18n.t("maintenanceInbox.overdueBy", { count: abs, date });
  if (diff === 0) return i18n.t("maintenanceInbox.dueToday");
  if (diff === 1) return i18n.t("maintenanceInbox.dueTomorrow");
  return i18n.t("maintenanceInbox.dueIn", { count: diff, date });
}
