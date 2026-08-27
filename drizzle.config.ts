import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL || "./local.db";

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbUrl,
  },
});
