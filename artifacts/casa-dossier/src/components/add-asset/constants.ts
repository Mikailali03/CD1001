import type { AssetScanResult } from "@workspace/api-client-react";
import { compressImageToDataUrl } from "@/lib/upload";

export async function compressForScan(file: File): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await compressImageToDataUrl(file, 1600, 0.82);
  return { base64: dataUrl.split(",")[1]!, mimeType: "image/jpeg" };
}

export const CATEGORIES = ["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"] as const;
export type Category = typeof CATEGORIES[number];

export type ScanResult = AssetScanResult;

export type Step = "method" | "lens" | "review" | "generating" | "done";

export const CATEGORY_ICONS: Record<string, string> = {
  HVAC: "❄️",
  Plumbing: "🔧",
  Electrical: "⚡",
  Roof: "🏠",
  Appliance: "🫙",
  Structural: "🏗️",
  Other: "📦",
};
