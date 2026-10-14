import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// .env holds the full connection string. .env.local fills anything missing
// and does not replace keys already set.
config({ path: ".env", quiet: true });
config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
