import { sql } from 'drizzle-orm';
import {
  index,
  sqliteTable,
  integer,
  text,
} from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: integer("expire", { mode: 'timestamp' }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  allergies: text("allergies"), // stored as JSON string
  dietaryPreferences: text("dietary_preferences"), // stored as JSON string
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
