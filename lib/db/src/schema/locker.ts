import { pgTable, index, text, integer, timestamp } from "drizzle-orm/pg-core";

export const lockerFoldersTable = pgTable("locker_folders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("locker_folders_user_id_idx").on(t.userId),
]);

export const lockerFilesTable = pgTable("locker_files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  folderId: text("folder_id").references(() => lockerFoldersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull().default("image/jpeg"),
  size: integer("size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("locker_files_user_id_idx").on(t.userId),
  index("locker_files_object_path_idx").on(t.objectPath),
]);

export type LockerFolder = typeof lockerFoldersTable.$inferSelect;
export type LockerFile = typeof lockerFilesTable.$inferSelect;
