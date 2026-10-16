import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const url = new URL(connectionString);
const sslMode = url.searchParams.get("sslmode");
if (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca") {
  url.searchParams.set("uselibpqcompat", "true");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });

const tableExists = async (name: string) => {
  const rows = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
    name,
  );
  return Boolean(rows[0]?.exists);
};

const columnExists = async (table: string, column: string) => {
  const rows = await db.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS exists`,
    table,
    column,
  );
  return Boolean(rows[0]?.exists);
};

const main = async () => {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      name TEXT NOT NULL,
      "imageKey" TEXT,
      "imagePrompt" TEXT,
      "providerVoiceId" TEXT,
      "voiceSource" TEXT,
      "voiceDescription" TEXT,
      "sampleCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS characters_userId_createdAt_idx ON characters ("userId", "createdAt")`);

  if (await tableExists("voice_settings")) {
    await db.$executeRawUnsafe(`
      INSERT INTO characters (id, "userId", name, "providerVoiceId", "voiceSource", "sampleCount", "createdAt", "updatedAt")
      SELECT id, "userId", name, "providerVoiceId", 'recorded', "sampleCount", "createdAt", "createdAt"
      FROM voice_settings
      ON CONFLICT (id) DO NOTHING
    `);
  }

  if (await columnExists("productions", "characterId") === false) {
    await db.$executeRawUnsafe(`ALTER TABLE productions ADD COLUMN "characterId" TEXT`);
  }
  if (await columnExists("productions", "voiceSettingId")) {
    await db.$executeRawUnsafe(`
      UPDATE productions
      SET "characterId" = "voiceSettingId"
      WHERE "voiceSettingId" IS NOT NULL AND "characterId" IS NULL
    `);
  }

  console.log("Copied saved voices onto characters.");
  await db.$disconnect();
};

void main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
