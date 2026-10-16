"use client";

import { Type } from "lucide-react";
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { useEditorActions, useEditorTimeline, useGetEditorPlayback } from "./editor-provider";

type Tab = "uploads" | "videos" | "text" | "audio";

const TABS: { id: Tab; label: string }[] = [
  { id: "uploads", label: "Uploads" },
  { id: "videos", label: "Videos" },
  { id: "text", label: "Text" },
  { id: "audio", label: "Audio" },
];

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

export function MediaPanel({ videos }: { videos: LibraryVideo[] }) {
  const [tab, setTab] = useState<Tab>("uploads");
  const timeline = useEditorTimeline();
  const getPlayback = useGetEditorPlayback();
  const actions = useEditorActions();
  const playheadFrame = () => getPlayback().playheadFrame;

  const handleAddAsset = async (asset: Asset, kind: AssetKind) => {
    let next = addAsset(timeline, asset);
    if (kind === "video") next = addItem(next, createVideoItem(asset, playheadFrame()));
    if (kind === "image") next = addItem(next, createImageItem(asset, playheadFrame()));
    if (kind === "audio") next = addItem(next, createAudioItem(asset, playheadFrame()));
    actions.applyTimeline(next);
  };

  const handleUploadKey = async (key: string | null, expected: AssetKind) => {
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
        const seconds = await durationOf(url, expected);
        asset.durationInFrames = framesFromSeconds(seconds);
      }
    } catch {
      asset.durationInFrames = framesFromSeconds(3);
    }
    await handleAddAsset(asset, expected);
  };

  const handleLibraryVideo = (video: LibraryVideo) => {
    const asset: Asset = {
      id: newId(),
      kind: "video",
      source: { type: "video", videoId: video.id },
      name: video.title,
      durationInFrames: framesFromSeconds(video.length),
      width: null,
      height: null,
    };
    void handleAddAsset(asset, "video");
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
      <div className="flex gap-1 border-b border-border p-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              "flex-1 rounded-lg px-1.5 py-1 text-[11px] font-medium",
              tab === entry.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "uploads" && (
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
              void handleUploadKey(key, kind);
            }}
          />
        )}
        {tab === "videos" && (
          <ul className="flex flex-col gap-1">
            {videos.filter((video) => video.hasFootage).map((video) => (
              <li key={video.id}>
                <button
                  type="button"
                  onClick={() => handleLibraryVideo(video)}
                  className="flex w-full flex-col items-start rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="truncate text-xs font-medium">{video.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {video.format} · {video.length}s
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {tab === "text" && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => actions.applyTimeline(addItem(timeline, createTextItem(playheadFrame())))}
          >
            <Type data-icon="inline-start" />
            Add title
          </Button>
        )}
        {tab === "audio" && (
          <MediaUpload kind="audio" label="Add audio" hint="MP3 or WAV" mediaKey={null} onChange={(key) => void handleUploadKey(key, "audio")} />
        )}
      </div>
    </aside>
  );
}
