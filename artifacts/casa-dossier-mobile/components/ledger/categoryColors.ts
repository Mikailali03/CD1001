// ── Category colours ───────────────────────────────────────────────────────────
export const CAT_COLORS: Record<string, string> = {
  HVAC: "#3b82f6", Plumbing: "#06b6d4", Electrical: "#eab308",
  Roof: "#78716c", Appliance: "#8b5cf6", Structural: "#22c55e", Other: "#94a3b8",
};
export function catColor(cat: string) { return CAT_COLORS[cat] ?? "#94a3b8"; }

export function fmt$(n: number) {
  return n === 0 ? "$0" : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
