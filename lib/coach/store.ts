import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { UIMessage } from "ai";
import { db } from "@/lib/db";

export const listCoachThreads = async (userId: string) => {
  return db.coachThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });
};

export const createCoachThread = async (userId: string, title = "New chat") => {
  return db.coachThread.create({
    data: { userId, title },
  });
};

export const getCoachThread = async (userId: string, threadId: string) => {
  return db.coachThread.findFirst({
    where: { id: threadId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
};

export const linkThreadVideo = async (userId: string, threadId: string, videoJobId: string) => {
  await db.coachThread.updateMany({ where: { id: threadId, userId }, data: { videoJobId } });
};

export const linkThreadProject = async (userId: string, threadId: string, editProjectId: string) => {
  await db.coachThread.updateMany({ where: { id: threadId, userId }, data: { editProjectId } });
};

export const deleteCoachThread = async (userId: string, threadId: string) => {
  const result = await db.coachThread.deleteMany({ where: { id: threadId, userId } });
  return result.count === 1;
};

export const loadCoachMessages = async (userId: string, threadId: string): Promise<UIMessage[]> => {
  const thread = await getCoachThread(userId, threadId);
  if (!thread) return [];
  return thread.messages.map((message) => ({
    id: message.id,
    role: message.role as UIMessage["role"],
    parts: message.parts as UIMessage["parts"],
  }));
};

export const saveCoachMessages = async (userId: string, threadId: string, messages: UIMessage[]) => {
  const thread = await db.coachThread.findFirst({ where: { id: threadId, userId } });
  if (!thread) throw new Error("Chat not found.");
  await db.$transaction(async (tx) => {
    await tx.coachMessage.deleteMany({ where: { threadId } });
    if (messages.length > 0) {
      await tx.coachMessage.createMany({
        data: messages.map((message) => ({
          id: message.id,
          threadId,
          role: message.role,
          parts: message.parts as Prisma.InputJsonValue,
          status: "complete",
        })),
      });
    }
    const firstUser = messages.find((message) => message.role === "user");
    const titleFrom = firstUser?.parts.find((part) => part.type === "text" && "text" in part);
    const title =
      titleFrom && titleFrom.type === "text"
        ? titleFrom.text.trim().slice(0, 72) || thread.title
        : thread.title;
    await tx.coachThread.update({
      where: { id: threadId },
      data: { title, updatedAt: new Date() },
    });
  });
};
