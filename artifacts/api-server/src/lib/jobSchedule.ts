import { localParts } from "./timezones.js";

/** A schedule time from the client, or null if it isn't a real date. */
export function parseScheduleDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Guard against typos like year 20255 that still parse.
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return date;
}

/** Whether two instants fall on the same calendar day in `timeZone`. */
export function isSameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  return localParts(a, timeZone).date === localParts(b, timeZone).date;
}
