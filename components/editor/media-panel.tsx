"use client";

import { Type } from "lucide-react";
import { MediaUpload } from "@/components/media-upload";
import { Button } from "@/components/ui/button";
import { browserAssetUrl } from "@/lib/editor/asset-url";
import {
  addAsset,
  addItem,
  createAudioItem,
  createImageItem,
  createTextItem,
  createVideoItem,
} from "@/lib/editor/operations";
import { framesFromSeconds } from "@/lib/editor/timecode";
import type { LibraryVideo } from "@/lib/editor/types";
import { newId, type Asset, type AssetKind } from "@/lib/editor/schema";
import { isAudioKey, isVideoKey } from "@/lib/storage/upload-key";
import { useEditorActions, useEditorTimeline, useGetEditorPlayback } from "./editor-provider";

const durationOf = (url: string, kind: "video" | "audio") =>
  new Promise<number>((resolve, reject) => {
    const element = document.createElement(kind);
    element.preload = "metadata";
    element.src = url;
    element.onloadedmetadata = () => resolve(Number.isFinite(element.duration) ? element.duration : 3);
    element.onerror = () => reject(new Error("Couldn't read that file."));
  });

const imageSize = (url: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    const succeed = () => {
      if (image.naturalWidth > 0) resolve({ width: image.naturalWidth, height: image.naturalHeight });
      else reject(new Error("Couldn't read that picture."));
    };
    image.onload = succeed;
    image.onerror = () => reject(new Error("Couldn't read that picture."));
    image.src = url;
    if (image.complete) succeed();
  });

/** Puts an upload or a library video on the timeline at the playhead. */
const useAddMedia = () => {
  const timeline = useEditorTimeline();
  const getPlayback = useGetEditorPlayback();
  const actions = useEditorActions();
  const playheadFrame = () => getPlayback().playheadFrame;

  const addAssetItem = (asset: Asset, kind: AssetKind) => {
    let next = addAsset(timeline, asset);
    if (kind === "video") next = addItem(next, createVideoItem(asset, playheadFrame()));
    if (kind === "image") next = addItem(next, createImageItem(asset, playheadFrame()));
    if (kind === "audio") next = addItem(next, createAudioItem(asset, playheadFrame()));
    actions.applyTimeline(next);
  };

  const addUpload = async (key: string | null, expected: AssetKind) => {
    if (!key) return;
    const asset: Asset = {
      id: newId(),
      kind: expected,
      source: { type: "upload", key },
      name: key.slice(key.lastIndexOf("/") + 1),
      durationInFrames: null,
      width: null,
      height: null,
    };
    const url = browserAssetUrl(asset);
    try {
      if (expected === "image") {
        const size = await imageSize(url);
        asset.width = size.width;
        asset.height = size.height;
      } else {
        asset.durationInFrames = framesFromSeconds(await durationOf(url, expected));
      }
    } catch {
      asset.durationInFrames = framesFromSeconds(3);
    }
    addAssetItem(asset, expected);
  };

  const addLibraryVideo = (video: LibraryVideo) =>
    addAssetItem(
      {
        id: newId(),
        kind: "video",
        source: { type: "video", videoId: video.id },
        name: video.title,
        durationInFrames: framesFromSeconds(video.length),
        width: null,
        height: null,
      },
      "video",
    );

  const addTitle = () => actions.applyTimeline(addItem(timeline, createTextItem(playheadFrame())));

  return { addUpload, addLibraryVideo, addTitle };
};

/** Uploads and finished videos, ready to drop on the timeline. */
export function MediaSection({ videos }: { videos: LibraryVideo[] }) {
  const { addUpload, addLibraryVideo } = useAddMedia();
  const playable = videos.filter((video) => video.hasFootage);
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <MediaUpload
          kind="image"
          librarySource="visual"
          libraryLayout="inline"
          label="Add picture or video"
          hint="JPEG, PNG, WebP, MP4, or WebM"
          mediaKey={null}
          onChange={(key) => {
            if (!key) return;
            const kind = isVideoKey(key) ? "video" : isAudioKey(key) ? "audio" : "image";
            void addUpload(key, kind);
          }}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your videos</h3>
        {playable.length === 0 ? (
          <p className="text-xs text-muted-foreground">Finished videos show up here.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {playable.map((video) => (
              <li key={video.id}>
                <button
                  type="button"
                  onClick={() => addLibraryVideo(video)}
                  className="flex w-full flex-col items-start rounded-xl border border-border px-3 py-2 text-left transition hover:border-foreground/30 hover:bg-muted"
                >
                  <span className="line-clamp-2 text-xs font-medium">{video.title}</span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {video.format} · {video.length}s
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Titles. Captions have their own section. */
export function TextSection() {
  const { addTitle } = useAddMedia();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">A title is added at the playhead. Select it on the timeline to change its words and look.</p>
      <Button type="button" variant="outline" className="w-full" onClick={addTitle}>
        <Type data-icon="inline-start" />
        Add title
      </Button>
    </div>
  );
}

/** Music, sound effects, and voice files. */
export function AudioSection() {
  const { addUpload } = useAddMedia();
  return <MediaUpload kind="audio" label="Add audio" hint="MP3 or WAV" mediaKey={null} onChange={(key) => void addUpload(key, "audio")} />;
}
