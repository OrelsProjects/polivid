"use client";

import { FileAudio, FileVideo, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ImageLibrary, type LibrarySource } from "@/components/image-library";
import { Button } from "@/components/ui/button";
import { uploadFileUrl } from "@/lib/storage/upload-key";
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
  librarySide?: "top" | "bottom";
  onBusyChange?: (busy: boolean) => void;
  librarySource?: LibrarySource;
  libraryLayout?: "popover" | "inline";
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
  librarySide = "bottom",
  onBusyChange,
  librarySource,
  libraryLayout = "popover",
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
  const atLimit = multiple && items.length >= MAX_REFERENCE_IMAGES;

  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;

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
      if (itemsRef.current.length >= MAX_REFERENCE_IMAGES) return;
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
    const remaining = MAX_REFERENCE_IMAGES - itemsRef.current.length;
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
  const tileClass = compact ? "size-14" : "size-28 sm:size-32";

  return (
    <div className="flex flex-col gap-2">
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
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <div
                key={item.key}
                className={cn("relative overflow-hidden rounded-xl border border-border", tileClass)}
              >
                {item.preview && item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.preview} alt={`Reference picture ${index + 1}`} className="size-full object-cover" />
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
                    "absolute rounded-full bg-white p-0",
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
                maxSelected={MAX_REFERENCE_IMAGES}
                disabled={disabled}
                uploading={uploading}
                triggerLabel={items.length ? "Add another" : namedLabel}
                tileClassName={compact ? tileClass : undefined}
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
                  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                  tileClass,
                )}
              >
                {uploading ? (
                  <LoaderCircle className="size-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Icon className="size-5" aria-hidden />
                    <span>Add</span>
                  </>
                )}
              </button>
            )}
          </div>
          {!compact && <p className="text-xs text-muted-foreground">{namedHint}</p>}
        </div>
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
      ) : preview || savedSingleKey ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {preview && previewKind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Upload preview" className="max-h-56 w-full object-cover" />
          ) : preview && previewKind === "video" ? (
            <video src={preview} controls className="max-h-56 w-full bg-black" />
          ) : (
            <div className="flex items-center gap-3 px-4 py-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm">{preview ? fileName : "Saved. Ready to generate."}</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-medium">
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
            className="absolute top-2 right-2 rounded-lg bg-white"
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
      {!multiple && props.mediaKey && !uploading && !error && (
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
