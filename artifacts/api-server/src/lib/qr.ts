import { db, assetsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";

/**
 * QR Identity Protocol — the single place that defines how an asset's
 * printable identity is derived. Nothing here is stored; everything is a pure
 * function of the asset's UUID, so labels never go stale and need no schema.
 *
 *   Registry ID:     CDA-<first 8 hex chars of the UUID, uppercased>
 *   Protocol string: CDA|<uuid>|<registryId>   (from the product spec)
 */

export const REGISTRY_PREFIX = "CDA";
const REGISTRY_HEX_LEN = 8;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGISTRY_RE = /^(?:CDA[-\s]?)?([0-9a-f]{8})$/i;

export function registryIdFor(assetId: string): string {
  const compact = assetId.replace(/-/g, "").slice(0, REGISTRY_HEX_LEN).toUpperCase();
  return `${REGISTRY_PREFIX}-${compact}`;
}

export function protocolStringFor(assetId: string): string {
  return `${REGISTRY_PREFIX}|${assetId}|${registryIdFor(assetId)}`;
}

export function isAssetUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type AssetRef =
  | { kind: "uuid"; id: string }
  | { kind: "registry"; prefix: string };

/**
 * Accepts anything a scanner or a person might hand us and narrows it to an
 * asset reference:
 *   - a bare UUID
 *   - a registry ID ("CDA-1A2B3C4D", "cda 1a2b3c4d", or just "1a2b3c4d")
 *   - the protocol string "CDA|<uuid>|<registryId>"
 *   - a label URL ending in /a/<uuid> (optionally with a query string)
 */
export function parseAssetRef(raw: string): AssetRef | null {
  const input = raw.trim();
  if (!input) return null;

  if (input.toUpperCase().startsWith(`${REGISTRY_PREFIX}|`)) {
    const [, uuid, registry] = input.split("|");
    if (uuid && isAssetUuid(uuid)) return { kind: "uuid", id: uuid.toLowerCase() };
    if (registry) return parseAssetRef(registry);
    return null;
  }

  const fromUrl = input.match(/\/a\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  if (fromUrl && isAssetUuid(fromUrl[1])) return { kind: "uuid", id: fromUrl[1].toLowerCase() };

  if (isAssetUuid(input)) return { kind: "uuid", id: input.toLowerCase() };

  const reg = input.match(REGISTRY_RE);
  if (reg) return { kind: "registry", prefix: reg[1].toLowerCase() };

  return null;
}

export type ResolveResult =
  | { status: "found"; assetId: string }
  | { status: "not_found" }
  | { status: "ambiguous" }
  | { status: "invalid" };

/**
 * Resolves a reference to exactly one asset ID. A registry ID is a UUID
 * prefix, so in the (rare) event two assets share the first 8 hex chars we
 * report ambiguity instead of guessing.
 */
export async function resolveAssetRef(raw: string): Promise<ResolveResult> {
  const ref = parseAssetRef(raw);
  if (!ref) return { status: "invalid" };

  if (ref.kind === "uuid") {
    const [row] = await db
      .select({ id: assetsTable.id })
      .from(assetsTable)
      .where(eq(assetsTable.id, ref.id));
    return row ? { status: "found", assetId: row.id } : { status: "not_found" };
  }

  // ref.prefix is validated as exactly 8 hex chars, so it can't carry LIKE
  // wildcards.
  const rows = await db
    .select({ id: assetsTable.id })
    .from(assetsTable)
    .where(like(assetsTable.id, `${ref.prefix}%`))
    .limit(2);
  if (rows.length === 0) return { status: "not_found" };
  if (rows.length > 1) return { status: "ambiguous" };
  return { status: "found", assetId: rows[0].id };
}
