import { auth } from "@/auth";
import { openEditorProjectForProduction } from "@/lib/production/editor";
import { getProductionForUser } from "@/lib/production/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to open this in the editor." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  try {
    const project = await openEditorProjectForProduction(userId, id);
    if (!project) return Response.json({ error: "This production has no timeline yet." }, { status: 409 });
    return Response.json({ project });
  } catch (error) {
    console.error("Could not open production in the editor", error);
    return Response.json({ error: "Couldn't open this in the editor." }, { status: 500 });
  }
};
