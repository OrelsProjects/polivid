import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { db } from "@/lib/db";
import { assetUrlMap } from "@/lib/editor/asset-url";
import { publicAppUrl, signAssetToken } from "@/lib/editor/asset-token";
import { TimelineSchema } from "@/lib/editor/schema";

const main = async () => {
  const project = await db.editProject.findUniqueOrThrow({ where: { id: "39d75dcd-4b4c-48e0-b330-ecfcc775b1e2" } });
  const timeline = TimelineSchema.parse(project.timeline);
  console.log("TIMELINE", JSON.stringify(timeline).slice(0, 1500));
  const origin = publicAppUrl();
  const inputProps = {
    timeline,
    assetUrls: assetUrlMap(timeline, (asset) => `${origin}/api/editor/assets/${encodeURIComponent(signAssetToken(project.userId, asset.source))}`),
  };
  console.log("ASSETS", inputProps.assetUrls);
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "remotion/index.ts"),
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...(config.resolve?.alias as Record<string, string>), "@": process.cwd() } },
    }),
  });
  const gl = (process.env.GL || null) as "angle" | "swangle" | "swiftshader" | null;
  const chromiumOptions = { gl };
  console.log("GL", gl);
  const browserExecutable = process.env.BROWSER || null;
  const composition = await selectComposition({ serveUrl, id: "Timeline", inputProps, logLevel: "verbose", chromiumOptions, browserExecutable });
  console.log("SELECTED", composition.width, composition.height, composition.durationInFrames);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: "/tmp/render-check.mp4",
    inputProps,
    logLevel: "info",
    chromiumOptions,
    browserExecutable,
  });
  console.log("RENDERED");
};

main()
  .catch((error) => {
    console.error("FAILED", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
