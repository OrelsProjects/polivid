import { auth } from "@/auth";
import { cancelOpenSteps, getProductionForUser, updateProduction } from "@/lib/production/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  await cancelOpenSteps(id);
  await updateProduction(id, { status: "canceled", error: "You canceled this production." });
  return Response.json({ ok: true });
}
