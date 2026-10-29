import type { AssetScanResult } from "@workspace/api-client-react";

export const CATEGORIES = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;
export type Category = typeof CATEGORIES[number];

export const CATEGORY_EMOJIS: Record<Category, string> = {
  HVAC: "❄️", Plumbing: "🔧", Electrical: "⚡",
  Roof: "🏠", Appliance: "🫙", Structural: "🏗️", Other: "📦",
};

export type ScanResult = AssetScanResult;

export interface AssetForm {
  name: string;
  category: Category;
  brand: string;
  model: string;
  serialNumber: string;
  /** YYYY-MM */
  installDate: string;
  replacementCost: string;
  /** YYYY-MM */
  warrantyExpiry: string;
}

export const BLANK_FORM: AssetForm = {
  name: "", category: "HVAC", brand: "", model: "", serialNumber: "",
  installDate: "", replacementCost: "", warrantyExpiry: "",
};

export type Step = "method" | "lens" | "review" | "generating" | "done";
