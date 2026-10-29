import type { MaintenanceInboxTask } from "@workspace/api-client-react";

export type InboxTask = MaintenanceInboxTask;

export type AssetOption = {
  id: string;
  name: string;
  category: string;
};

export const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};

/** Recurrence choices; labels live under `maintenance.interval.<days>`. */
export const INBOX_INTERVAL_VALUES = ["30", "60", "90", "180", "365"] as const;

// Stored on the service record as the technician for DIY work. This is data,
// not UI copy, so it stays in English like existing records.
export const DIY_TECHNICIAN_NAME = "Homeowner (DIY)";

export type CompletePayload = {
  notes?: string;
  isDiy: boolean;
  cost?: number;
  technicianName?: string;
  companyName?: string;
  receiptUrl?: string;
};

export type TaskFormPayload = {
  title: string;
  description?: string;
  intervalDays: number;
  nextDueDate: string;
  estimatedCost?: number;
  isDiy: boolean;
};
