import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

/**
 * Data Access Layer entry point: the signed-in user, or a redirect to /login.
 *
 * It reads the session cookie, so call it inside a <Suspense> boundary (Cache
 * Components rule). React's cache() dedupes it within one request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/login");
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  };
});

/** Only allow same-site relative paths as post-login destinations. */
export const safeCallbackUrl = (value: unknown, fallback = "/dashboard") =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
