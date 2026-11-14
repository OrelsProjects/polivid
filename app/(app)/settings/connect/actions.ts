"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createApiKey, disconnectApp, revokeApiKey } from "@/lib/mcp/auth/store";

const signedInUser = async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sign in first.");
  return userId;
};

/** Returns the key once. Only its hash is kept. */
export const createKeyAction = async (name: string) => {
  const userId = await signedInUser();
  try {
    const created = await createApiKey(userId, name);
    revalidatePath("/settings/connect");
    return { key: created.key, prefix: created.prefix };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't create the key." };
  }
};

export const revokeKeyAction = async (id: string) => {
  const userId = await signedInUser();
  await revokeApiKey(userId, id);
  revalidatePath("/settings/connect");
};

export const disconnectAppAction = async (clientId: string) => {
  const userId = await signedInUser();
  await disconnectApp(userId, clientId);
  revalidatePath("/settings/connect");
};
