/**
 * Date-only columns (install dates, due dates, service dates) are text in the
 * schema and must hold plain "YYYY-MM-DD" so string comparisons like
 * `nextDueDate < today` work. The generated zod schemas coerce these fields to
 * Date objects, which node-postgres would otherwise write as full timestamps.
 */
export function toDateOnly(d: Date): string;
export function toDateOnly(d: Date | null | undefined): string | null | undefined;
export function toDateOnly(d: Date | null | undefined): string | null | undefined {
  return d == null ? d : d.toISOString().split("T")[0]!;
}
