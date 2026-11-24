import "server-only";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { backgroundById } from "@/lib/video/backgrounds";
import { saveFootage } from "@/lib/video/footage";
import { markVideoJobProgress } from "@/lib/video/jobs";
import { assetUrlMap } from "./asset-url";
import { publicAppUrl, signAssetToken } from "./asset-token";
import { chromeForRender } from "./chrome-executable";
import { directAssetUrl } from "./render-assets";
import type { Timeline } from "./schema";

/** Maps a render fraction onto a band of the job's progress bar. */
export const renderProgress = (from: number, to: number, done: number) =>
  Math.round(from + (to - from) * Math.min(1, Math.max(0, done)));

let bundleLocation: Promise<string> | null = null;

const remotionBundle = () => {
  if (!bundleLocation) {
    bundleLocation = bundle({
      entryPoint: path.join(process.cwd(), "remotion/index.ts"),
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias as Record<string, string> | undefined),
            "@": process.cwd(),
          },
        },
      }),
    }).catch((error: unknown) => {
      bundleLocation = null;
      throw error;
    });
  }
  return bundleLocation;
};

/** Builds the Remotion bundle ahead of time, so the first export after a restart doesn't wait for it. */
export const warmRemotionBundle = () =>
  remotionBundle().then(
    () => console.info("Remotion bundle ready"),
    (error: unknown) => console.error("Could not build the Remotion bundle ahead of time", error),
  );

/**
 * Renders a timeline to the job's video file.
 * `progress` is the band of the job's progress bar the render fills. An export owns the whole bar.
 */
export const renderEditProject = async (
  userId: string,
  jobId: string,
  timeline: Timeline,
  progress: { from: number; to: number } = { from: 10, to: 85 },
) => {
  const serveUrl = await remotionBundle();
  const origin = publicAppUrl();
  // Clips are read straight from S3 where possible; the website's asset route is the fallback.
  const direct = new Map(
    await Promise.all(
      timeline.assets.map(async (asset) => [asset.id, await directAssetUrl(userId, asset.source).catch(() => null)] as const),
    ),
  );
  const inputProps = {
    timeline,
    assetUrls: assetUrlMap(timeline, (asset) => {
      // Built-in clips are public files. Everything else is the person's own and needs a signed link.
      if (asset.source.type === "library") {
        const file = backgroundById(asset.source.id)?.file;
        return file ? `${origin}${file}` : null;
      }
      const url = direct.get(asset.id);
      if (url) return url;
      const token = signAssetToken(userId, asset.source);
      return `${origin}/api/editor/assets/${encodeURIComponent(token)}`;
    }),
  };
  const browserExecutable = await chromeForRender();
  const composition = await selectComposition({
    serveUrl,
    id: "Timeline",
    inputProps,
    browserExecutable,
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
      browserExecutable,
      onProgress: ({ progress: done }) => {
        void markVideoJobProgress(jobId, "render", renderProgress(progress.from, progress.to, done));
      },
    });
    // Past the frames: the file is saved next, which the progress page shows as its own step.
    await markVideoJobProgress(jobId, "finalize", 92);
    await saveFootage(jobId, new Uint8Array(await readFile(outputLocation)));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
