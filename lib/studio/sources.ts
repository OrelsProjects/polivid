import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { parseConcepts, wordCount, type SavedConcept, type SourceView } from "./source-types";

const toView = (row: { id: string; title: string; body: string; concepts: unknown; createdAt: Date }): SourceView => ({
  id: row.id,
  title: row.title,
  body: row.body,
  words: wordCount(row.body),
  createdAt: row.createdAt.toISOString(),
  concepts: parseConcepts(row.concepts),
});

export async function listSources(userId: string): Promise<SourceView[]> {
  const rows = await db.source.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

export async function getSource(userId: string, id: string): Promise<SourceView | null> {
  const row = await db.source.findFirst({ where: { id, userId } });
  return row ? toView(row) : null;
}

export async function createSource(userId: string, input: { title: string; body: string }): Promise<SourceView> {
  const body = input.body.trim();
  const title = input.title.trim() || body.split("\n")[0]?.trim().slice(0, 80) || "Untitled source";
  const row = await db.source.create({
    data: { userId, title, body, concepts: [] as Prisma.InputJsonValue },
  });
  return toView(row);
}

export async function saveSourceConcepts(userId: string, id: string, concepts: SavedConcept[]): Promise<SourceView | null> {
  const existing = await db.source.findFirst({ where: { id, userId } });
  if (!existing) return null;
  const row = await db.source.update({
    where: { id },
    data: { concepts: concepts as unknown as Prisma.InputJsonValue },
  });
  return toView(row);
}
