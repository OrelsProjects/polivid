import { cookies } from "next/headers";
import { realAuth } from "@/auth";
import { db } from "@/lib/db";
import { isAdminEmail, signViewAs, VIEW_AS_COOKIE, VIEW_AS_TTL_MS } from "@/lib/auth/view-as";

/** Who is really signed in, when they are an admin. "View as" never makes anyone an admin. */
const realAdmin = async () => {
  const session = await realAuth();
  const user = session?.user;
  return user?.id && isAdminEmail(user.email) ? { id: user.id, email: user.email ?? "" } : null;
};

/** Start viewing the app as another user. Body: { userId }. */
export async function POST(request: Request) {
  const admin = await realAdmin();
  if (!admin) return Response.json({ error: "Not found." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const user = userId ? await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }) : null;
  if (!user) return Response.json({ error: "That user doesn't exist." }, { status: 404 });
  if (user.id === admin.id) {
    (await cookies()).delete(VIEW_AS_COOKIE);
    return Response.json({ viewing: null });
  }
  (await cookies()).set(VIEW_AS_COOKIE, signViewAs(admin.id, user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(VIEW_AS_TTL_MS / 1000),
  });
  console.info("View as started", { admin: admin.email, userId: user.id, email: user.email });
  return Response.json({ viewing: { id: user.id, email: user.email } });
}

/** Stop viewing as another user and go back to your own account. */
export async function DELETE() {
  const session = await realAuth();
  if (!session?.user?.id) return Response.json({ error: "Sign in first." }, { status: 401 });
  (await cookies()).delete(VIEW_AS_COOKIE);
  console.info("View as stopped", { admin: session.user.email });
  return new Response(null, { status: 204 });
}
