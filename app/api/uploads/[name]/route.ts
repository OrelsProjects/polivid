import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rangedBytesResponse } from "@/lib/http/range";
import { deleteUpload, getObjectIfExists, hasS3Config } from "@/lib/storage/s3";
import { uploadKeysForName } from "@/lib/storage/upload-key";
import { readJobInput } from "@/lib/video/job-status";

const resolveKeys = async (context: { params: Promise<{ name: string }> }) => {
  const { name } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { userId: null, keys: [] as string[] };
  return { userId, keys: uploadKeysForName(userId, name) };
};

const firstExisting = async (keys: readonly string[]) => {
  for (const key of keys) {
    const upload = await getObjectIfExists(key);
    if (upload) return { key, upload };
  }
  return null;
};

/** Streams one of the signed-in user's pictures. Keys are unique, so the bytes never change. */
export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const { userId, keys } = await resolveKeys(context);
  if (!userId) return new Response("Sign in to see this picture.", { status: 401 });
  if (keys.length === 0 || !hasS3Config()) return new Response("Not found.", { status: 404 });

  try {
    const found = await firstExisting(keys);
    if (!found) return new Response("Not found.", { status: 404 });
    return rangedBytesResponse(
      found.upload.bytes,
      found.upload.contentType,
      request.headers.get("range"),
      "private, max-age=31536000, immutable",
    );
  } catch (error) {
    console.error("Could not read the upload", { keys, error });
    return new Response("Couldn't load this picture.", { status: 500 });
  }
}

/** True when a queued or running job still needs this upload. The worker reads it at filming time. */
const isUploadInActiveJob = async (userId: string, key: string) => {
  const jobs = await db.videoJob.findMany({
    where: { userId, status: { in: ["queued", "running"] } },
    select: { input: true },
  });
  return jobs.some((job) => {
    const input = readJobInput(job.input);
    return input.mediaKey === key || input.imageKey === key || input.referenceKeys.includes(key);
  });
};

/** Removes a picture from the library. Videos that are still being made keep theirs. */
export async function DELETE(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { userId, keys } = await resolveKeys(context);
  if (!userId) return Response.json({ error: "Sign in to delete a picture." }, { status: 401 });
  if (keys.length === 0 || !hasS3Config()) return Response.json({ error: "That picture is not available." }, { status: 404 });

  try {
    const found = await firstExisting(keys);
    if (!found) return Response.json({ error: "That picture is not available." }, { status: 404 });
    const key = found.key;
    if (await isUploadInActiveJob(userId, key)) {
      return Response.json(
        { error: "A video that's still being made uses this picture. Delete it after the video finishes." },
        { status: 409 },
      );
    }
    await deleteUpload(key);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not delete the upload", error);
    const denied = error instanceof Error && (error.name === "AccessDenied" || error.message.includes("Access Denied"));
    return Response.json(
      {
        error: denied
          ? "Storage isn't allowed to delete pictures yet."
          : "Couldn't delete that picture. Try again.",
      },
      { status: 500 },
    );
  }
}
