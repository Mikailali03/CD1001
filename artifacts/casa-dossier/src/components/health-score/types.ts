export type AssetScore = {
  assetId: string;
  assetName: string;
  category: string;
  score: number;
  ageYears: number;
  lifespanYears: number;
};

export type OverdueTask = {
  id: string;
  title: string;
  nextDueDate: string;
  isDiy?: boolean;
  assetId?: string;
  assetName?: string;
  estimatedCost?: string | number | null;
};

export type CompletePayload = {
  notes?: string;
  isDiy: boolean;
  cost?: number;
  technicianName?: string;
  companyName?: string;
  receiptUrl?: string;
  completedDate: string;
};

export const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200"    },
  C: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  D: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
  F: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
};
