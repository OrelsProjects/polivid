import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startVideoWorker } from "@/lib/video/worker";

/** Test control. Films queued videos and keeps waiting on ones already at OpenRouter. */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to start the worker." }, { status: 401 });

  try {
    const waiting = await db.videoJob.count({
      where: { userId, status: { in: ["queued", "running"] } },
    });
    if (waiting === 0) return Response.json({ error: "No videos are waiting." }, { status: 409 });
    const run = startVideoWorker(userId);
    after(() => run);
    return Response.json({ started: waiting }, { status: 202 });
  } catch (error) {
    console.error("Could not start the video worker", error);
    return Response.json({ error: "Couldn't start the worker. Try again." }, { status: 500 });
  }
}
