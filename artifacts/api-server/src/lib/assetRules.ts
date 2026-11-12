// Rules for removing and editing assets. Kept free of I/O so they can be tested
// directly; routes/assets.ts applies them.

// Owners can remove an asset added by mistake within this window, if it has no
// history. Everything else is retired so the report keeps it.
export const MISTAKE_REMOVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const ASSET_REMOVAL_BLOCKED_ERROR =
  "Assets with service history, or added more than 7 days ago, can't be removed. Retire it instead so its history stays on your report.";

/**
 * Why the asset can't be deleted, or null if it can. Admins can remove anything
 * (support and abuse cases); owners only an asset added by mistake.
 */
export function assetRemovalBlockReason(input: {
  isAdmin: boolean;
  serviceRecordCount: number;
  createdAt: Date;
  now?: number;
}): string | null {
  if (input.isAdmin) return null;
  const isRecent = (input.now ?? Date.now()) - input.createdAt.getTime() < MISTAKE_REMOVAL_WINDOW_MS;
  if (input.serviceRecordCount > 0 || !isRecent) return ASSET_REMOVAL_BLOCKED_ERROR;
  return null;
}

export type AssetUpdateIntent = { retiring: boolean; reactivating: boolean };

/** Whether a PATCH retires or reactivates the asset. */
export function assetUpdateIntent(
  existing: { retiredAt: Date | null },
  body: { retiredAt?: Date | string | null },
): AssetUpdateIntent {
  const touchesRetired = "retiredAt" in body;
  return {
    retiring: touchesRetired && body.retiredAt != null && !existing.retiredAt,
    reactivating: touchesRetired && body.retiredAt == null && !!existing.retiredAt,
  };
}

/** Error for a PATCH that isn't allowed, with its HTTP status, or null if it's fine. */
export function assetUpdateBlockReason(
  existing: { retiredAt: Date | null },
  body: { retiredAt?: Date | string | null; retiredReason?: string | null },
): { status: 400 | 409; error: string } | null {
  const { retiring, reactivating } = assetUpdateIntent(existing, body);
  // A retired asset is read-only apart from being reactivated.
  if (existing.retiredAt && !reactivating) {
    return { status: 409, error: "This asset is retired. Reactivate it to make changes." };
  }
  if (retiring && !body.retiredReason) {
    return { status: 400, error: "A reason is required to retire an asset." };
  }
  return null;
}

/** Retired assets take no new service records or maintenance tasks. */
export function assetIsReadOnly(asset: { retiredAt: Date | null }): boolean {
  return asset.retiredAt != null;
}
