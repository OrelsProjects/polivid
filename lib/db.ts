import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per server process. In dev, hot reloads would otherwise
 * open a new connection pool on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const toPoolConfig = (connectionString: string): PoolConfig => {
  const url = new URL(connectionString);
  const connectionLimit = Number(url.searchParams.get("connection_limit"));
  const poolTimeoutSeconds = Number(url.searchParams.get("pool_timeout"));

  // These are Prisma engine settings. node-postgres does not understand them.
  url.searchParams.delete("connection_limit");
  url.searchParams.delete("pool_timeout");

  // pg treats sslmode=require as verify-full. Prisma 6 used it to encrypt only,
  // which is what this app's RDS URL is written for.
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca") {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return {
    connectionString: url.toString(),
    ...(Number.isInteger(connectionLimit) && connectionLimit > 0
      ? { max: connectionLimit }
      : {}),
    ...(Number.isInteger(poolTimeoutSeconds) && poolTimeoutSeconds > 0
      ? { connectionTimeoutMillis: poolTimeoutSeconds * 1000 }
      : {}),
  };
};

const createDb = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({
    adapter: new PrismaPg(toPoolConfig(connectionString)),
  });
};

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
