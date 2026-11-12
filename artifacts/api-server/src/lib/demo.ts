// The read-only demo account: a realistic home seeded on first demo access so
// the demo never shows an empty dossier. Every row has a fixed ID and is
// inserted with ON CONFLICT DO NOTHING, so seeding is idempotent and safe to
// run from several server instances at once.
import { db } from "@workspace/db";
import {
  propertiesTable,
  assetsTable,
  serviceRecordsTable,
  maintenanceTasksTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "./logger.js";

export const DEMO_USER_ID = "demo-user";

export function isDemoUser(userId: string | null | undefined): boolean {
  return userId === DEMO_USER_ID;
}

const PROPERTY_ID = "demo-property";

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function daysFromNow(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** The demo home's rows, with dates relative to `now` so tasks look current when first seeded. */
export function buildDemoSeed(now = new Date()) {
  const year = now.getFullYear();
  const ago = (years: number, month = 5, day = 15) => `${year - years}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const property = {
    id: PROPERTY_ID,
    userId: DEMO_USER_ID,
    name: "Magnolia Avenue",
    address: "1427 Magnolia Ave",
    city: "Decatur",
    state: "GA",
    zipCode: "30030",
    yearBuilt: 1994,
    sqft: 2180,
    bedrooms: 4,
    bathrooms: "2.5",
    lotSize: 9800,
    latitude: 33.7748,
    longitude: -84.2963,
  };

  type Category = (typeof assetsTable.$inferInsert)["category"];
  const asset = (id: string, name: string, category: Category, fields: Partial<typeof assetsTable.$inferInsert> = {}) => ({
    id: `demo-asset-${id}`,
    propertyId: PROPERTY_ID,
    name,
    category,
    status: "unverified" as const,
    ...fields,
  });

  const assets = [
    asset("hvac", "Central air conditioner", "HVAC", { brand: "Trane", model: "XR15", installDate: ago(8, 4, 2), replacementCost: "9500", status: "verified" }),
    asset("furnace", "Gas furnace", "HVAC", { brand: "Trane", model: "S9V2", installDate: ago(8, 4, 2), replacementCost: "5200", status: "verified" }),
    asset("water-heater", "Water heater (50 gal gas)", "Plumbing", { brand: "Rheem", model: "Performance Plus", installDate: ago(11, 9, 20), replacementCost: "1900", warrantyExpiry: ago(5, 9, 20) }),
    asset("roof", "Roof (asphalt shingle)", "Roof", { brand: "GAF", model: "Timberline HDZ", installDate: ago(16, 6, 1), replacementCost: "16500" }),
    asset("panel", "Electrical panel", "Electrical", { brand: "Square D", model: "QO 200A", installDate: "1994-03-01", replacementCost: "2800" }),
    asset("plumbing", "Supply plumbing", "Plumbing", { notes: "Built in 1994: worth confirming whether the supply lines are polybutylene." }),
    asset("fridge", "Refrigerator", "Appliance", { brand: "LG", model: "LRMVS3006S", installDate: ago(5, 11, 28), replacementCost: "2400" }),
    asset("dishwasher", "Dishwasher", "Appliance", { brand: "Bosch", model: "500 Series", installDate: ago(3, 2, 10), replacementCost: "1100" }),
    asset("washer", "Clothes washer", "Appliance", { brand: "Whirlpool", model: "WTW5000DW", installDate: ago(10, 7, 4), replacementCost: "900" }),
    asset("old-water-heater", "Water heater (40 gal gas)", "Plumbing", {
      brand: "A.O. Smith",
      installDate: "2002-08-01",
      retiredAt: new Date(`${ago(11, 9, 20)}T12:00:00Z`),
      retiredReason: "replaced" as const,
    }),
  ];

  type RecordInsert = typeof serviceRecordsTable.$inferInsert;
  const verified = (id: string, assetId: string, date: string, description: string, cost: string): RecordInsert => ({
    id: `demo-record-${id}`,
    assetId: `demo-asset-${assetId}`,
    date,
    description,
    cost,
    companyName: "CasaService",
    technicianName: "CasaService technician",
    verified: true,
    createdAt: new Date(`${date}T18:00:00Z`),
  });
  const selfReported = (id: string, assetId: string, date: string, description: string, fields: Partial<RecordInsert> = {}): RecordInsert => ({
    id: `demo-record-${id}`,
    assetId: `demo-asset-${assetId}`,
    date,
    description,
    verified: false,
    createdByUserId: DEMO_USER_ID,
    createdAt: new Date(`${date}T20:00:00Z`),
    ...fields,
  });

  const records: RecordInsert[] = [
    selfReported("hvac-install", "hvac", ago(8, 4, 2), "New Trane XR15 condenser and coil installed", { companyName: "Peachtree Heating & Air", cost: "8700" }),
    verified("hvac-tuneup-1", "hvac", ago(2, 5, 12), "Spring AC tune-up: coils cleaned, refrigerant checked, capacitor tested", "149"),
    verified("hvac-tuneup-2", "hvac", ago(1, 5, 9), "Spring AC tune-up: condensate line flushed, contactor replaced", "214"),
    verified("furnace-tuneup", "furnace", ago(1, 10, 21), "Fall furnace inspection: burners cleaned, heat exchanger inspected, CO test passed", "129"),
    selfReported("filter-1", "furnace", daysFromNow(-75, now), "Replaced 16x25x1 MERV 8 air filter", { cost: "18" }),
    selfReported("wh-install", "water-heater", ago(11, 9, 20), "Replaced failed 40 gal heater with 50 gal Rheem", { companyName: "Decatur Plumbing Co.", cost: "1650" }),
    selfReported("wh-flush", "water-heater", ago(1, 1, 14), "Drained and flushed tank, tested T&P valve"),
    verified("wh-anode", "water-heater", daysFromNow(-120, now), "Anode rod replaced (heavily corroded), tank flushed", "235"),
    selfReported("roof-install", "roof", ago(16, 6, 1), "Full tear-off and re-roof, GAF Timberline HDZ", { companyName: "Summit Roofing", cost: "11800" }),
    selfReported("roof-repair", "roof", ago(2, 3, 30), "Replaced storm-damaged shingles on north slope", { companyName: "Summit Roofing", cost: "640" }),
    selfReported("old-wh-repair", "old-water-heater", "2011-01-08", "Thermocouple replaced", { cost: "120" }),
    selfReported("dishwasher-install", "dishwasher", ago(3, 2, 10), "New Bosch dishwasher installed", { cost: "980" }),
  ];

  type TaskInsert = typeof maintenanceTasksTable.$inferInsert;
  const task = (id: string, assetId: string, title: string, intervalDays: number, dueInDays: number, fields: Partial<TaskInsert> = {}): TaskInsert => ({
    id: `demo-task-${id}`,
    assetId: `demo-asset-${assetId}`,
    title,
    intervalDays,
    nextDueDate: daysFromNow(dueInDays, now),
    isDiy: true,
    ...fields,
  });

  const tasks: TaskInsert[] = [
    task("filter", "furnace", "Replace air filter", 90, 15, { description: "Swap the 16x25x1 filter at the return.", estimatedCost: "18" }),
    task("ac-tuneup", "hvac", "Annual AC tune-up", 365, 40, { isDiy: false, estimatedCost: "150" }),
    task("condensate", "hvac", "Clean condensate drain line", 90, -6, { description: "Pour a cup of vinegar into the drain line cleanout." }),
    task("wh-flush", "water-heater", "Flush water heater", 365, 60, { estimatedCost: "0" }),
    task("roof-inspect", "roof", "Inspect roof and flashing", 365, 120, { isDiy: false, estimatedCost: "200" }),
    task("fridge-coils", "fridge", "Clean refrigerator coils", 180, 3),
    task("dishwasher-filter", "dishwasher", "Clean dishwasher filter", 90, -2),
    task("washer-hoses", "washer", "Check washer supply hoses", 365, 200, { description: "Replace rubber hoses with braided steel if they're bulging or cracked." }),
    task("plumbing-check", "plumbing", "Identify supply pipe material", 3650, 30, { isDiy: false, description: "Have a plumber confirm whether the supply lines are polybutylene.", estimatedCost: "125" }),
    task("panel-check", "panel", "Test GFCI and AFCI breakers", 365, 90, { completedAt: new Date(`${daysFromNow(-20, now)}T15:00:00Z`) }),
  ];

  return { property, assets, records, tasks };
}

let seeding: Promise<void> | null = null;

/** Seed the demo home if the demo account has none. Runs at most once per process. */
export function ensureDemoSeeded(): Promise<void> {
  seeding ??= seedDemo().catch((err) => {
    seeding = null; // retry on the next demo request
    logger.error({ err }, "Demo seed failed");
  });
  return seeding;
}

async function seedDemo(): Promise<void> {
  const [{ n }] = await db.select({ n: count() }).from(propertiesTable).where(eq(propertiesTable.userId, DEMO_USER_ID));
  if (n > 0) return;

  const { property, assets, records, tasks } = buildDemoSeed();
  await db.transaction(async (tx) => {
    await tx.insert(propertiesTable).values(property).onConflictDoNothing();
    await tx.insert(assetsTable).values(assets).onConflictDoNothing();
    await tx.insert(serviceRecordsTable).values(records).onConflictDoNothing();
    await tx.insert(maintenanceTasksTable).values(tasks).onConflictDoNothing();
  });
  logger.info("Seeded the demo home");
}
