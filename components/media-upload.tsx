"use client";

import { FileAudio, FileVideo, Image, ImagePlus, LoaderCircle, Music, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ImageLibrary, type LibrarySource } from "@/components/image-library";
import { VideoStage } from "@/components/video/video-stage";
import { Button } from "@/components/ui/button";
import { isAudioKey, isImageKey, uploadFileUrl } from "@/lib/storage/upload-key";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useUploadFileMutation } from "@/lib/store/endpoints/uploads";
import { cn } from "@/lib/utils";
import type { ModeUpload } from "@/lib/video/modes";
import { MAX_REFERENCE_IMAGES } from "@/lib/video/schema";

const ACCEPT: Record<Exclude<ModeUpload, "none">, string> = {
  image: "image/jpeg,image/png,image/webp",
  audio: "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac",
  video: "video/mp4,video/webm,video/quicktime",
  media: "audio/mpeg,audio/mp3,audio/wav,video/mp4,video/webm",
};

const HINT: Record<Exclude<ModeUpload, "none">, string> = {
  image: "JPEG, PNG, or WebP · under 4 MB",
  audio: "MP3 or WAV · under 20 MB",
  video: "MP4 or WebM · under 20 MB",
  media: "Audio or video · under 20 MB",
};

/** Short name on a compact chip. */
const SHORT_LABEL: Record<Exclude<ModeUpload, "none">, string> = {
  image: "Photo",
  audio: "Song",
  video: "Video",
  media: "Song/clip",
};

const LABEL: Record<Exclude<ModeUpload, "none">, string> = {
  image: "Starting picture",
  audio: "Song",
  video: "Video",
  media: "Audio or video",
};

type PreviewKind = "image" | "audio" | "video";

type PreviewItem = {
  key: string;
  preview: string | null;
  kind: PreviewKind;
  fileName: string;
};

const revokePreview = (preview: string | null) => {
  if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
};

const previewKindFor = (type: string): PreviewKind =>
  type.startsWith("audio/") ? "audio" : type.startsWith("video/") ? "video" : "image";

const UPLOAD_FAILED = "Couldn't save that file.";

type MediaUploadProps = {
  kind: Exclude<ModeUpload, "none">;
  disabled?: boolean;
  label?: string;
  hint?: string;
  compact?: boolean;
  /** Visible name on the compact chip. Defaults to a short kind label. */
  compactLabel?: string;
  librarySide?: "top" | "bottom";
  onBusyChange?: (busy: boolean) => void;
  librarySource?: LibrarySource;
  libraryLayout?: "popover" | "inline";
  /** How many files a multi-upload can hold. Defaults to the reference-picture cap. */
  max?: number;
} & (
  | {
      multiple?: false;
      mediaKey: string | null;
      onChange: (mediaKey: string | null) => void;
      mediaKeys?: never;
      onChangeKeys?: never;
    }
  | {
      multiple: true;
      mediaKeys: string[];
      onChangeKeys: (mediaKeys: string[]) => void;
      mediaKey?: never;
      onChange?: never;
    }
);

export function MediaUpload({
  kind,
  disabled,
  label,
  hint,
  compact = false,
  compactLabel,
  librarySide = "bottom",
  onBusyChange,
  librarySource,
  libraryLayout = "popover",
  max = MAX_REFERENCE_IMAGES,
  ...props
}: MediaUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const itemsRef = useRef<PreviewItem[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("image");
  const [fileName, setFileName] = useState<string | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile] = useUploadFileMutation();
  const Icon = kind === "audio" ? FileAudio : kind === "image" ? ImagePlus : FileVideo;
  const library = librarySource ?? (kind === "video" ? "video" : kind === "image" ? "image" : null);
  const accept =
    library === "visual" ? `${ACCEPT.image},${ACCEPT.video}` : ACCEPT[kind];
  const multiple = props.multiple === true;
  const parentKeyList = multiple ? props.mediaKeys.join("\0") : "";
  const savedSingleKey = !multiple ? props.mediaKey : null;
  const atLimit = multiple && items.length >= max;
  const singleIsAudio = preview ? previewKind === "audio" : Boolean(savedSingleKey && isAudioKey(savedSingleKey));
  const SingleIcon = singleIsAudio ? FileAudio : kind === "image" ? ImagePlus : FileVideo;
  const singleKindLabel = singleIsAudio ? "Audio" : kind === "image" ? "Photo" : "Video";

  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    return () => {
      revokePreview(previewUrl.current);
      for (const item of itemsRef.current) revokePreview(item.preview);
    };
  }, []);

  useEffect(() => {
    onBusyChangeRef.current?.(uploading);
  }, [uploading]);

  useEffect(() => {
    if (!multiple) return;
    const parentKeys = parentKeyList ? parentKeyList.split("\0") : [];
    const current = itemsRef.current;
    if (current.map((item) => item.key).join("\0") === parentKeyList) return;
    const byKey = new Map(current.map((item) => [item.key, item]));
    const next = parentKeys.map(
      (key) =>
        byKey.get(key) ?? {
          key,
          preview: kind === "image" ? uploadFileUrl(key) : null,
          kind: "image" as const,
          fileName: "Saved picture",
        },
    );
    for (const item of current) {
      if (!parentKeys.includes(item.key)) revokePreview(item.preview);
    }
    itemsRef.current = next;
    setItems(next);
  }, [kind, multiple, parentKeyList]);

  const handlePick = () => {
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  };

  const commitItems = (next: PreviewItem[]) => {
    itemsRef.current = next;
    setItems(next);
    setError(null);
    if (multiple) props.onChangeKeys(next.map((item) => item.key));
  };

  const handleRemoveKey = (key: string) => {
    const current = itemsRef.current.find((item) => item.key === key);
    if (!current) return;
    revokePreview(current.preview);
    commitItems(itemsRef.current.filter((item) => item.key !== key));
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleToggleLibraryPicture = (key: string, url: string, mediaKind: "image" | "video" = "image") => {
    if (multiple) {
      if (itemsRef.current.some((item) => item.key === key)) {
        handleRemoveKey(key);
        return;
      }
      if (itemsRef.current.length >= max) return;
      commitItems([...itemsRef.current, { key, preview: url, kind: mediaKind, fileName: "Library item" }]);
      return;
    }
    if (props.mediaKey === key) {
      props.onChange(null);
      return;
    }
    props.onChange(key);
  };

  const handleClear = () => {
    revokePreview(previewUrl.current);
    previewUrl.current = null;
    setPreview(null);
    setFileName(null);
    setError(null);
    if (!multiple) props.onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled || uploading || multiple) return;
    setUploading(true);
    setError(null);
    if (libraryLayout !== "inline") {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      const nextPreview = URL.createObjectURL(file);
      previewUrl.current = nextPreview;
      setPreview(nextPreview);
      setFileName(file.name);
      setPreviewKind(previewKindFor(file.type));
    }

    try {
      const key = await uploadFile(file).unwrap();
      props.onChange(key);
    } catch (cause) {
      handleClear();
      setError(apiErrorMessage(cause, UPLOAD_FAILED));
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!multiple || disabled || uploading || files.length === 0) return;
    const remaining = max - itemsRef.current.length;
    if (remaining <= 0) return;
    const batch = files.slice(0, remaining);
    setUploading(true);
    setError(null);
    const next = [...itemsRef.current];
    let lastError: string | null = null;

    for (const file of batch) {
      const preview = URL.createObjectURL(file);
      try {
        const key = await uploadFile(file).unwrap();
        next.push({ key, preview, kind: previewKindFor(file.type), fileName: file.name });
        itemsRef.current = next;
        setItems([...next]);
        props.onChangeKeys(next.map((item) => item.key));
      } catch (cause) {
        revokePreview(preview);
        lastError = apiErrorMessage(cause, UPLOAD_FAILED);
      }
    }

    if (lastError) setError(lastError);
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
  };

  const namedLabel = label ?? LABEL[kind];
  const namedHint = hint ?? HINT[kind];
  const chipLabel = compactLabel ?? SHORT_LABEL[kind];
  const ChipIcon = kind === "image" ? Image : kind === "video" ? FileVideo : Music;
  const tileClass = compact ? "size-10 min-h-10 min-w-10 max-w-10 shrink-0" : "size-28 shrink-0 sm:size-32";
  const chipClass =
    "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
  const imageSrc =
    preview && previewKind === "image"
      ? preview
      : savedSingleKey && isImageKey(savedSingleKey)
        ? uploadFileUrl(savedSingleKey)
        : null;

  return (
    <div className={cn("flex flex-col gap-2", compact && "w-max shrink-0")}>
      <span id={`${inputId}-label`} className={libraryLayout === "inline" || compact ? "sr-only" : "text-sm font-medium"}>
        {namedLabel}
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled || uploading || atLimit}
        aria-labelledby={`${inputId}-label`}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (multiple) {
            void handleFiles(files);
            return;
          }
          void handleFile(files[0]);
        }}
      />
      {multiple ? (
        <div className="flex flex-col gap-2">
          <div className={cn("flex gap-2", compact ? "flex-nowrap" : "flex-wrap")}>
            {items.map((item, index) => (
              <div
                key={item.key}
                className={cn("relative overflow-hidden rounded-xl border border-border", tileClass)}
              >
                {item.preview && item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.preview} alt={`Reference picture ${index + 1}`} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted/40 px-2 text-muted-foreground">
                    <Icon className="size-5" aria-hidden />
                    <span className="text-xs">{item.preview ? item.fileName : "Saved"}</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || uploading}
                  aria-label={`Remove picture ${index + 1}`}
                  className={cn(
                    "absolute rounded-full bg-card p-0",
                    compact ? "top-0.5 right-0.5 size-5" : "top-1.5 right-1.5 size-8",
                  )}
                  onClick={() => handleRemoveKey(item.key)}
                >
                  <X />
                </Button>
              </div>
            ))}
            {library ? (
              <ImageLibrary
                source={library}
                layout={libraryLayout}
                selectedKeys={items.map((item) => item.key)}
                maxSelected={max}
                disabled={disabled}
                uploading={uploading}
                triggerLabel={compact ? (items.length ? "Add" : chipLabel) : items.length ? "Add another" : namedLabel}
                ariaLabel={
                  compact
                    ? items.length
                      ? "Add another reference picture"
                      : `${namedLabel}. ${namedHint}`
                    : undefined
                }
                title={compact ? namedHint : undefined}
                chip={compact}
                side={librarySide}
                onToggle={handleToggleLibraryPicture}
                onUploadNew={handlePick}
                onDeleted={handleRemoveKey}
              />
            ) : !atLimit && (
              <button
                type="button"
                disabled={disabled || uploading}
                aria-labelledby={`${inputId}-label`}
                aria-label={items.length ? "Add another reference picture" : namedLabel}
                onClick={handlePick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handlePick();
                  }
                }}
                className={cn(
                  compact
                    ? chipClass
                    : "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                  compact ? undefined : tileClass,
                )}
              >
                {uploading ? (
                  <LoaderCircle className={cn("animate-spin", compact ? "size-4" : "size-5")} aria-hidden />
                ) : (
                  <>
                    {compact ? <ChipIcon className="size-4" aria-hidden /> : <Icon className="size-5" aria-hidden />}
                    <span>{compact ? (items.length ? "Add" : chipLabel) : "Add"}</span>
                  </>
                )}
              </button>
            )}
          </div>
            {!compact && <p className="text-xs text-muted-foreground">{namedHint}</p>}
        </div>
      ) : compact ? (
        preview || savedSingleKey ? (
          <div
            title={(preview && fileName) || namedLabel}
            className="inline-flex h-10 max-w-full items-center gap-2 rounded-xl border border-dashed border-border pr-1 pl-2 text-xs text-muted-foreground"
          >
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- private upload, served from the app
              <img src={imageSrc} alt="" className="size-6 rounded-md object-cover" />
            ) : uploading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <SingleIcon className="size-4 text-primary" aria-hidden />
            )}
            <span className="truncate">{uploading ? "Saving" : singleKindLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || uploading}
              aria-label={`Remove ${namedLabel.toLowerCase()}`}
              className="size-8 shrink-0 rounded-lg p-0"
              onClick={handleClear}
            >
              <X />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || uploading}
            aria-label={`${namedLabel}. ${namedHint}`}
            title={namedHint}
            onClick={handlePick}
            className={chipClass}
          >
            {uploading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <>
                <ChipIcon className="size-4" aria-hidden />
                <span>{chipLabel}</span>
              </>
            )}
          </button>
        )
      ) : library && (libraryLayout === "inline" || (!savedSingleKey && !preview)) ? (
        <ImageLibrary
          source={library}
          layout={libraryLayout}
          selectedKeys={savedSingleKey ? [savedSingleKey] : []}
          maxSelected={1}
          disabled={disabled}
          uploading={uploading}
          triggerLabel={namedLabel}
          onToggle={handleToggleLibraryPicture}
          onUploadNew={handlePick}
          onDeleted={() => props.onChange(null)}
        />
      ) : imageSrc ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={handlePick}
            aria-label={`Replace ${namedLabel}`}
            className="relative size-28 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:size-32"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private upload, served from the app */}
            <img src={imageSrc} alt="" className="size-full object-cover" />
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-background/80">
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
                <span className="sr-only">Uploading</span>
              </span>
            )}
          </button>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              aria-label="Remove upload"
              className="rounded-lg bg-card"
              onClick={handleClear}
            >
              <X data-icon="inline-start" />
              Remove
            </Button>
            <p className="text-xs text-muted-foreground">Click the picture to replace it.</p>
          </div>
        </div>
      ) : preview || savedSingleKey ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {preview && previewKind === "video" ? (
            <VideoStage src={preview} fit="contain" className="aspect-video max-h-56 w-full" title={fileName || "Uploaded video"} />
          ) : (
            <div className="flex items-center gap-3 px-4 py-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm">{preview ? fileName : "Saved. Ready to generate."}</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-background/80 text-sm font-medium">
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Uploading…
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            aria-label="Remove upload"
            className="absolute top-2 right-2 rounded-lg bg-card"
            onClick={handleClear}
          >
            <X data-icon="inline-start" />
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          aria-labelledby={`${inputId}-label`}
          onClick={handlePick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handlePick();
            }
          }}
          className={cn(
            "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          )}
        >
          <Icon className="size-5" aria-hidden />
          {namedHint}
        </button>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {!multiple && !compact && props.mediaKey && !uploading && !error && !imageSrc && (
        <p className="text-xs text-muted-foreground">Saved. Ready to generate.</p>
      )}
      {multiple && !compact && items.length > 0 && !uploading && !error && (
        <p className="text-xs text-muted-foreground">
          {items.length === 1 ? "1 picture saved. Ready to generate." : `${items.length} pictures saved. Ready to generate.`}
        </p>
      )}
    </div>
  );
}
