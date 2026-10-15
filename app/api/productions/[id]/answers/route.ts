import { z } from "zod";
import { auth } from "@/auth";
import { startPlanning } from "@/lib/production/jobs/coordinator";
import { getProductionForUser } from "@/lib/production/store";

const Schema = z.object({ answers: z.record(z.string(), z.string()) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid answers." }, { status: 400 });
  const result = await startPlanning(id, userId, { answers: parsed.data.answers });
  return Response.json(result);
}
