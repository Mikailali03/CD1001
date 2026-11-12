// Normalises a US street address so the same home matches however it was typed:
// "123 North Oak Street, Apt 4" and "123 N Oak St #4" both become "123 n oak st unit 4".
// Used to match a new owner's property to an unclaimed dossier at that address.

const SUFFIXES: Record<string, string> = {
  street: "st", avenue: "ave", av: "ave", road: "rd", drive: "dr", lane: "ln",
  court: "ct", boulevard: "blvd", place: "pl", circle: "cir", parkway: "pkwy",
  highway: "hwy", terrace: "ter", trail: "trl", square: "sq", way: "way",
  crossing: "xing", point: "pt", cove: "cv", ridge: "rdg", run: "run",
};

const DIRECTIONS: Record<string, string> = {
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};

const UNIT_WORDS = new Set(["apt", "apartment", "unit", "suite", "ste", "#", "no", "number"]);

function normaliseStreet(street: string): string {
  const tokens = street
    .toLowerCase()
    .replace(/#/g, " # ")
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (UNIT_WORDS.has(tok)) {
      out.push("unit");
      continue;
    }
    out.push(SUFFIXES[tok] ?? DIRECTIONS[tok] ?? tok);
  }
  // "unit unit 4" (e.g. "Apt #4") collapses to one marker.
  return out.join(" ").replace(/\b(unit )+/g, "unit ").trim();
}

export function normalizeAddress(parts: {
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): string {
  const street = normaliseStreet(parts.address);
  const zip5 = parts.zipCode?.match(/\d{5}/)?.[0];
  // ZIP pins the location; without one, fall back to city + state.
  if (zip5) return `${street}|${zip5}`;
  const city = (parts.city ?? "").toLowerCase().replace(/[^a-z ]/g, "").trim();
  const state = (parts.state ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return `${street}|${city}|${state}`;
}
