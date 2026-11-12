import { clerkClient } from "@clerk/express";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

// Every signed-in user needs a user_profiles row: reminder emails, push
// reminders and the weekly summary are sent only to users with one, and
// notification preferences are stored on it. Previously a row was created only
// when the user saved their profile in Settings, so new accounts silently got
// no reminders and couldn't change their notification settings.
//
// Checked once per user per process; a failure is logged and retried on the
// next request rather than failing the request.
const known = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

async function create(userId: string): Promise<void> {
  const [existing] = await db
    .select({ userId: userProfilesTable.userId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (existing) return;

  const user = await clerkClient.users.getUser(userId);
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  // New profiles always start as homeowners; roles are granted by admins.
  await db
    .insert(userProfilesTable)
    .values({
      userId,
      firstName: user.firstName?.trim() || "User",
      lastName: user.lastName?.trim() ?? "",
      email,
      role: "homeowner",
    })
    .onConflictDoNothing();
}

export async function ensureProfile(userId: string): Promise<void> {
  if (known.has(userId)) return;
  let pending = inFlight.get(userId);
  if (!pending) {
    pending = create(userId)
      .then(() => { known.add(userId); })
      .catch((err) => { logger.warn({ err, userId }, "Couldn't create user profile"); })
      .finally(() => { inFlight.delete(userId); });
    inFlight.set(userId, pending);
  }
  await pending;
}

/** Test helper. */
export function resetEnsureProfileCache(): void {
  known.clear();
  inFlight.clear();
}
