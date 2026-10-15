import "server-only";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { saveFootage } from "@/lib/video/footage";
import { markVideoJobProgress } from "@/lib/video/jobs";
import { assetUrlMap } from "./asset-url";
import { publicAppUrl, signAssetToken } from "./asset-token";
import type { Timeline } from "./schema";

let bundleLocation: Promise<string> | null = null;

const remotionBundle = () => {
  if (!bundleLocation) {
    bundleLocation = bundle({
      entryPoint: path.join(process.cwd(), "remotion/index.ts"),
    });
  }
  return bundleLocation;
};

export const renderEditProject = async (userId: string, jobId: string, timeline: Timeline) => {
  const serveUrl = await remotionBundle();
  const origin = publicAppUrl();
  const inputProps = {
    timeline,
    assetUrls: assetUrlMap(timeline, (asset) => {
      const token = signAssetToken(userId, asset.source);
      return `${origin}/api/editor/assets/${encodeURIComponent(token)}`;
    }),
  };
  const composition = await selectComposition({
    serveUrl,
    id: "Timeline",
    inputProps,
  });
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-export-"));
  const outputLocation = path.join(dir, `${jobId}.mp4`);
  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      onProgress: ({ progress }) => {
        void markVideoJobProgress(jobId, "render", Math.max(10, Math.round(progress * 90)));
      },
    });
    await saveFootage(jobId, new Uint8Array(await readFile(outputLocation)));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
