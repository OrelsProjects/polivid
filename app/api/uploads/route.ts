import { auth } from "@/auth";
import {
  hasS3Config,
  listUploads,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
  putUpload,
  UPLOAD_TYPES,
  uploadObjectKey,
} from "@/lib/storage/s3";
import { AUDIO_EXTS, IMAGE_EXTS, VIDEO_EXTS, isImageKey, isOwnedUploadKey, uploadExtension, uploadFileUrl } from "@/lib/storage/upload-key";

/** The signed-in user's picture library, newest first. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see your pictures." }, { status: 401 });
  if (!hasS3Config()) return Response.json({ uploads: [] });

  const kind = new URL(request.url).searchParams.get("kind");
  const includeAll = kind === "all";

  try {
    const uploads = (await listUploads(userId))
      .filter((upload) => {
        if (!isOwnedUploadKey(userId, upload.key)) return false;
        if (includeAll) return true;
        return isImageKey(upload.key);
      })
      .map((upload) => {
        const ext = uploadExtension(upload.key);
        const mediaKind = IMAGE_EXTS.has(ext) ? "image" : AUDIO_EXTS.has(ext) ? "audio" : VIDEO_EXTS.has(ext) ? "video" : "file";
        return {
          key: upload.key,
          url: uploadFileUrl(upload.key),
          kind: mediaKind,
          uploadedAt: upload.uploadedAt?.toISOString() ?? null,
        };
      });
    return Response.json({ uploads });
  } catch (error) {
    console.error("Could not list uploads", error);
    return Response.json({ error: "Couldn't load your pictures. Try again." }, { status: 500 });
  }
}

/**
 * Stores an image, audio, or video file in S3 under uploads/{userId}/.
 * The object stays private. The video worker reads it back later.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to upload a file." }, { status: 401 });
  if (!hasS3Config()) {
    return Response.json({ error: "Uploads are not configured yet." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose an image, audio, or video file." }, { status: 400 });
  }
  const ext = UPLOAD_TYPES[file.type];
  if (!ext) {
    return Response.json({ error: "Use JPEG, PNG, WebP, MP3, WAV, MP4, or WebM." }, { status: 400 });
  }
  const limit = IMAGE_EXTS.has(ext) ? MAX_IMAGE_BYTES : MAX_MEDIA_BYTES;
  if (file.size <= 0 || file.size > limit) {
    return Response.json(
      { error: IMAGE_EXTS.has(ext) ? "Keep the picture under 4 MB." : "Keep the file under 20 MB." },
      { status: 400 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaKey = uploadObjectKey(userId, ext);
    await putUpload(mediaKey, bytes, file.type);
    return Response.json({ mediaKey, imageKey: mediaKey }, { status: 201 });
  } catch (error) {
    console.error("Could not store the upload", error);
    return Response.json({ error: "Couldn't save that file. Try again." }, { status: 500 });
  }
}
