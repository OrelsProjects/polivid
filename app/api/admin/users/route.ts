import { realAuth } from "@/auth";
import { isAdminEmail } from "@/lib/auth/view-as";
import { db } from "@/lib/db";

/** Admins only: people to view the app as, newest first, filtered by name or email. */
export async function GET(request: Request) {
  const session = await realAuth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) return Response.json({ error: "Not found." }, { status: 404 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const users = await db.user.findMany({
    where: query
      ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      plan: true,
      createdAt: true,
      _count: { select: { videos: true, characters: true } },
    },
  });
  return Response.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      plan: user.plan,
      joined: user.createdAt.toISOString(),
      videos: user._count.videos,
      characters: user._count.characters,
      you: user.id === session.user!.id,
    })),
  });
}
