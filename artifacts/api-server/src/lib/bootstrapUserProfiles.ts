import { db, userProfilesTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * On first server start against an empty user_profiles table, fetches every
 * user from Clerk and upserts them as homeowners.  The account whose email
 * matches ADMIN_EMAIL (env var) is given the admin role instead.
 *
 * This is a no-op once the table has any rows.
 */
export async function bootstrapUserProfiles(): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return;

  const [{ count }] = (await db.execute(sql`SELECT COUNT(*)::int AS count FROM user_profiles`)).rows as any[];
  if (count > 0) return;

  logger.info("user_profiles is empty — bootstrapping from Clerk");

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();

  let allUsers: any[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const resp = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" } },
    );
    if (!resp.ok) {
      logger.error({ status: resp.status }, "Clerk fetch failed during bootstrap");
      return;
    }
    const page = (await resp.json()) as any[];
    if (!page.length) break;
    allUsers = allUsers.concat(page);
    if (page.length < limit) break;
    offset += limit;
  }

  let inserted = 0;
  let errors = 0;

  for (const u of allUsers) {
    const primaryEmail =
      u.email_addresses?.find((e: any) => e.id === u.primary_email_address_id)?.email_address ??
      u.email_addresses?.[0]?.email_address ??
      null;

    const role =
      adminEmail && primaryEmail?.toLowerCase() === adminEmail ? "admin" : "homeowner";

    try {
      await db.insert(userProfilesTable).values({
        userId: u.id,
        firstName: (u.first_name ?? "").trim() || "User",
        lastName: (u.last_name ?? "").trim(),
        email: primaryEmail,
        role,
      }).onConflictDoNothing();
      inserted++;
    } catch (err: any) {
      logger.error({ userId: u.id, err: err.message }, "Bootstrap insert failed");
      errors++;
    }
  }

  logger.info({ inserted, errors, total: allUsers.length }, "user_profiles bootstrap complete");
}
