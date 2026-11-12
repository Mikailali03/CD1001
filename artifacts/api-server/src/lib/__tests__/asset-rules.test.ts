import { describe, it, expect } from "vitest";
import {
  ASSET_REMOVAL_BLOCKED_ERROR,
  MISTAKE_REMOVAL_WINDOW_MS,
  assetIsReadOnly,
  assetRemovalBlockReason,
  assetUpdateBlockReason,
  assetUpdateIntent,
} from "../assetRules";
import { CreateAssetBody, UpdateAssetBody, CreateServiceRecordBody } from "@workspace/api-zod";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000);

describe("assetRemovalBlockReason", () => {
  it("lets an owner remove a fresh asset with no history (added by mistake)", () => {
    expect(assetRemovalBlockReason({ isAdmin: false, serviceRecordCount: 0, createdAt: daysAgo(2), now: NOW })).toBeNull();
  });

  it("makes owners retire assets that have history", () => {
    expect(assetRemovalBlockReason({ isAdmin: false, serviceRecordCount: 1, createdAt: daysAgo(1), now: NOW }))
      .toBe(ASSET_REMOVAL_BLOCKED_ERROR);
  });

  it("makes owners retire assets older than 7 days", () => {
    const createdAt = new Date(NOW - MISTAKE_REMOVAL_WINDOW_MS);
    expect(assetRemovalBlockReason({ isAdmin: false, serviceRecordCount: 0, createdAt, now: NOW }))
      .toBe(ASSET_REMOVAL_BLOCKED_ERROR);
  });

  it("lets admins remove anything (support and abuse cases)", () => {
    expect(assetRemovalBlockReason({ isAdmin: true, serviceRecordCount: 12, createdAt: daysAgo(900), now: NOW })).toBeNull();
  });
});

describe("assetUpdateBlockReason", () => {
  const active = { retiredAt: null };
  const retired = { retiredAt: daysAgo(10) };

  it("allows ordinary edits to an active asset", () => {
    expect(assetUpdateBlockReason(active, {})).toBeNull();
  });

  it("requires a reason to retire", () => {
    expect(assetUpdateBlockReason(active, { retiredAt: new Date(NOW) })).toMatchObject({ status: 400 });
    expect(assetUpdateBlockReason(active, { retiredAt: new Date(NOW), retiredReason: "replaced" })).toBeNull();
  });

  it("makes a retired asset read-only apart from reactivating it", () => {
    expect(assetUpdateBlockReason(retired, {})).toMatchObject({ status: 409 });
    expect(assetUpdateBlockReason(retired, { retiredAt: new Date(NOW), retiredReason: "failed" })).toMatchObject({ status: 409 });
    expect(assetUpdateBlockReason(retired, { retiredAt: null })).toBeNull();
    expect(assetIsReadOnly(retired)).toBe(true);
    expect(assetIsReadOnly(active)).toBe(false);
  });

  it("classifies retire and reactivate", () => {
    expect(assetUpdateIntent(active, { retiredAt: new Date(NOW) })).toEqual({ retiring: true, reactivating: false });
    expect(assetUpdateIntent(retired, { retiredAt: null })).toEqual({ retiring: false, reactivating: true });
    expect(assetUpdateIntent(retired, {})).toEqual({ retiring: false, reactivating: false });
  });
});

describe("verified status can't be set by homeowners", () => {
  it("rejects status 'verified' when creating or editing an asset", () => {
    // New assets can't carry a status at all: it's stripped, so they start unverified.
    expect(CreateAssetBody.parse({ name: "Furnace", category: "HVAC", status: "verified" })).not.toHaveProperty("status");
    expect(UpdateAssetBody.safeParse({ status: "verified" }).success).toBe(false);
    expect(UpdateAssetBody.safeParse({ status: "needs_attention" }).success).toBe(true);
  });

  it("drops 'verified' and technician fields from a homeowner's service record", () => {
    const parsed = CreateServiceRecordBody.parse({
      date: "2026-01-02",
      description: "Tune-up",
      verified: true,
      casaServiceTechId: "tech_1",
    }) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty("verified");
    expect(parsed).not.toHaveProperty("casaServiceTechId");
  });
});
