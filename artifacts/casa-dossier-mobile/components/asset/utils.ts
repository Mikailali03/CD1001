// ── Category normaliser ────────────────────────────────────────────────────────
export function normCategory(cat: string): string {
  const map: Record<string, string> = {
    hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
    roof: "Roof", roofing: "Roof", appliance: "Appliance", appliances: "Appliance",
    structural: "Structural", other: "Other",
  };
  return map[cat?.toLowerCase()] ?? cat;
}
