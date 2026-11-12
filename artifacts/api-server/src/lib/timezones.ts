// Local time for a home, from its US state. Reminders go out at 8am where the
// home is, not where the server is. States that span two zones use the zone
// most of their population lives in; anything unknown uses SCHEDULE_TIMEZONE.

const DEFAULT_TIMEZONE = process.env.SCHEDULE_TIMEZONE || "America/New_York";

const EASTERN = "America/New_York";
const CENTRAL = "America/Chicago";
const MOUNTAIN = "America/Denver";
const PACIFIC = "America/Los_Angeles";

const STATE_TIMEZONES: Record<string, string> = {
  AL: CENTRAL, AK: "America/Anchorage", AZ: "America/Phoenix", AR: CENTRAL, CA: PACIFIC,
  CO: MOUNTAIN, CT: EASTERN, DE: EASTERN, DC: EASTERN, FL: EASTERN, GA: EASTERN,
  HI: "Pacific/Honolulu", ID: MOUNTAIN, IL: CENTRAL, IN: "America/Indiana/Indianapolis",
  IA: CENTRAL, KS: CENTRAL, KY: EASTERN, LA: CENTRAL, ME: EASTERN, MD: EASTERN,
  MA: EASTERN, MI: "America/Detroit", MN: CENTRAL, MS: CENTRAL, MO: CENTRAL,
  MT: MOUNTAIN, NE: CENTRAL, NV: PACIFIC, NH: EASTERN, NJ: EASTERN, NM: MOUNTAIN,
  NY: EASTERN, NC: EASTERN, ND: CENTRAL, OH: EASTERN, OK: CENTRAL, OR: PACIFIC,
  PA: EASTERN, RI: EASTERN, SC: EASTERN, SD: CENTRAL, TN: CENTRAL, TX: CENTRAL,
  UT: MOUNTAIN, VT: EASTERN, VA: EASTERN, WA: PACIFIC, WV: EASTERN, WI: CENTRAL,
  WY: MOUNTAIN, PR: "America/Puerto_Rico",
};

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "puerto rico": "PR",
};

export function timezoneForState(state: string | null | undefined): string {
  if (!state) return DEFAULT_TIMEZONE;
  const trimmed = state.trim();
  const code = trimmed.length === 2 ? trimmed.toUpperCase() : STATE_NAMES[trimmed.toLowerCase()];
  return (code && STATE_TIMEZONES[code]) || DEFAULT_TIMEZONE;
}

/** The local calendar date (YYYY-MM-DD), hour and weekday (0 = Sunday) in `timeZone`. */
export function localParts(now: Date, timeZone: string): { date: string; hour: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: weekdays.indexOf(parts.weekday ?? ""),
  };
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
