import "server-only";
import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isAdminEmail, readViewAs, VIEW_AS_COOKIE } from "./view-as";

export interface ViewAsSession extends Session {
  /** Set while an admin is viewing as this user: who is really signed in. */
  viewAs?: { adminId: string; adminEmail: string };
}

/**
 * The session the app acts on. For an admin with a valid view-as cookie it is the viewed user's,
 * with `viewAs` naming the admin; for everyone else it is unchanged.
 */
export const applyViewAs = async (session: Session | null): Promise<ViewAsSession | null> => {
  if (!session?.user?.id || !isAdminEmail(session.user.email)) return session;
  const admin = session.user;
  let value: string | undefined;
  try {
    value = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  } catch {
    // Outside a request (a script or the worker): nothing to apply.
    return session;
  }
  const userId = readViewAs(value, admin.id!);
  if (!userId || userId === admin.id) return session;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true } });
  if (!user) return session;
  return {
    ...session,
    user: { ...admin, id: user.id, name: user.name, email: user.email, image: user.image },
    viewAs: { adminId: admin.id!, adminEmail: admin.email ?? "" },
  };
};
