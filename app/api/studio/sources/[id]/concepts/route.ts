import { suggestForSource } from "../../route";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return suggestForSource(id);
}
