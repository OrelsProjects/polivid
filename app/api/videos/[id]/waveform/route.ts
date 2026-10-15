import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasFootage } from "@/lib/video/footage";
import { extractWaveform, readWaveform } from "@/lib/video/waveform";

/** Peak strip for the timeline audio lane. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to preview this video.", { status: 401 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });
  if (!(await hasFootage(id))) return new Response("This video has no filmed clip.", { status: 404 });

  let meta = await readWaveform(id);
  if (!meta) {
    try {
      meta = await extractWaveform(id);
    } catch {
      return new Response("Could not read this clip’s sound.", { status: 500 });
    }
  }
  return Response.json(meta);
}
