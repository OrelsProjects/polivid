"use client";

import { Popover } from "@base-ui/react/popover";
import { Check, FileVideo, Image as ImageIcon, ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useDeleteUploadMutation, useGetUploadsQuery, type LibraryUpload } from "@/lib/store/endpoints/uploads";
import { cn } from "@/lib/utils";

export type LibraryMediaKind = "image" | "video";
export type LibrarySource = "image" | "video" | "visual";

type LibraryPicture = LibraryUpload;

type ImageLibraryProps = {
  selectedKeys: string[];
  maxSelected: number;
  disabled?: boolean;
  uploading?: boolean;
  triggerLabel: string;
  tileClassName?: string;
  /** Horizontal dashed chip instead of a square add tile. */
  chip?: boolean;
  /** Accessible name when the visible chip label is shorter than the control's purpose. */
  ariaLabel?: string;
  title?: string;
  side?: "top" | "bottom";
  source?: LibrarySource;
  layout?: "popover" | "inline";
  onToggle: (key: string, url: string, kind: LibraryMediaKind) => void;
  onUploadNew: () => void;
  onDeleted: (key: string) => void;
};

const SKELETON_TILES = 5;

const TITLE: Record<LibrarySource, string> = {
  image: "Your pictures",
  video: "Your videos",
  visual: "Your library",
};

const EMPTY: Record<LibrarySource, string> = {
  image: "No pictures yet. Upload one and it stays here for next time.",
  video: "No videos yet. Upload one and it stays here for next time.",
  visual: "Nothing here yet. Upload a picture or video and it stays for next time.",
};

const uploadedLabel = (uploadedAt: string | null) =>
  uploadedAt
    ? new Date(uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "earlier";

const matchesSource = (kind: LibraryPicture["kind"], source: LibrarySource) => {
  if (source === "image") return kind === "image";
  if (source === "video") return kind === "video";
  return kind === "image" || kind === "video";
};

const asMediaKind = (kind: LibraryPicture["kind"]): LibraryMediaKind => (kind === "video" ? "video" : "image");

/** Add tile that opens the user's library: reuse an upload, upload a new one, or delete old ones. */
export function ImageLibrary({
  selectedKeys,
  maxSelected,
  disabled,
  uploading,
  triggerLabel,
  tileClassName,
  chip = false,
  ariaLabel,
  title,
  side = "bottom",
  source = "image",
  layout = "popover",
  onToggle,
  onUploadNew,
  onDeleted,
}: ImageLibraryProps) {
  const [open, setOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const atLimit = selectedKeys.length >= maxSelected;
  const {
    data: uploads,
    isFetching: loading,
    error: loadError,
  } = useGetUploadsQuery(source === "image" ? "image" : "all", {
    skip: layout !== "inline" && !open,
    refetchOnMountOrArgChange: true,
  });
  const [deleteUpload] = useDeleteUploadMutation();
  const loaded = uploads !== undefined;
  const pictures = useMemo(
    () => (uploads ?? []).filter((item) => matchesSource(item.kind, source)),
    [uploads, source],
  );
  const error = deleteError ?? (loadError ? apiErrorMessage(loadError, "Couldn't load your library.") : null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setConfirmingKey(null);
    if (next) setDeleteError(null);
  };

  const handleUploadNew = () => {
    setOpen(false);
    onUploadNew();
  };

  const handleDelete = (key: string) => {
    const picture = pictures.find((item) => item.key === key);
    if (!picture) return;
    const wasSelected = selectedKeys.includes(key);
    setConfirmingKey(null);
    setDeleteError(null);
    onDeleted(key);

    void deleteUpload(key)
      .unwrap()
      .catch((cause: unknown) => {
        if (wasSelected) onToggle(key, picture.url, asMediaKind(picture.kind));
        setDeleteError(apiErrorMessage(cause, "Couldn't delete that file."));
      });
  };

  const grid = (
    <>
      <div className={cn("grid grid-cols-3 gap-2 p-0.5", layout === "inline" ? "" : "mt-3 max-h-80 overflow-y-auto")}>
        <button
          type="button"
          disabled={atLimit || disabled || uploading}
          onClick={handleUploadNew}
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          Upload new
        </button>

        {!loaded &&
          loading &&
          Array.from({ length: SKELETON_TILES }, (_, index) => (
            <Skeleton key={index} className="aspect-square rounded-xl" />
          ))}

        {pictures.map((picture) => (
          <LibraryTile
            key={picture.key}
            picture={picture}
            selected={selectedKeys.includes(picture.key)}
            blocked={atLimit && !selectedKeys.includes(picture.key)}
            confirming={confirmingKey === picture.key}
            onToggle={() => onToggle(picture.key, picture.url, asMediaKind(picture.kind))}
            onAskDelete={() => setConfirmingKey(picture.key)}
            onCancelDelete={() => setConfirmingKey(null)}
            onConfirmDelete={() => void handleDelete(picture.key)}
          />
        ))}
      </div>

      {loaded && pictures.length === 0 && !error && (
        <p className="mt-3 px-1 text-xs text-muted-foreground">{EMPTY[source]}</p>
      )}
      {atLimit && layout === "popover" && (
        <p className="mt-3 px-1 text-xs text-muted-foreground">
          That&apos;s {maxSelected} pictures, the most one video can use. Unpick one to swap it.
        </p>
      )}
      {error && (
        <p className="mt-3 px-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );

  if (layout === "inline") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{TITLE[source]}</p>
        {grid}
      </div>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        disabled={disabled || uploading}
        aria-label={ariaLabel ?? triggerLabel}
        title={title}
        className={cn(
          "cursor-pointer border border-dashed border-border text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-primary/40 data-[popup-open]:text-foreground",
          chip
            ? "inline-flex h-10 items-center gap-2 rounded-xl px-3"
            : "flex flex-col items-center justify-center gap-1 rounded-xl bg-muted/40 px-2",
          chip ? undefined : (tileClassName ?? "size-28 sm:size-32"),
        )}
      >
        {uploading ? (
          <LoaderCircle className={cn("animate-spin", chip ? "size-4" : "size-5")} aria-hidden />
        ) : chip ? (
          <>
            <ImageIcon className="size-4" aria-hidden />
            <span>{triggerLabel}</span>
          </>
        ) : (
          <>
            <ImagePlus className="size-5" aria-hidden />
            <span>Add</span>
          </>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} align="start" sideOffset={8} collisionPadding={16} className="z-50">
          <Popover.Popup className="w-[min(24rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-2xl border border-border bg-card p-3 shadow-lg outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <Popover.Title className="text-sm font-semibold">{TITLE[source]}</Popover.Title>
              <Popover.Description className="text-xs text-muted-foreground">
                {selectedKeys.length}/{maxSelected} picked
              </Popover.Description>
            </div>
            {grid}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

type LibraryTileProps = {
  picture: LibraryPicture;
  selected: boolean;
  blocked: boolean;
  confirming: boolean;
  onToggle: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

function LibraryTile({
  picture,
  selected,
  blocked,
  confirming,
  onToggle,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: LibraryTileProps) {
  const noun = picture.kind === "video" ? "Video" : "Picture";
  const label = `${noun} uploaded ${uploadedLabel(picture.uploadedAt)}`;

  if (confirming) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-xl border border-destructive/40">
        <LibraryThumb picture={picture} faded />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/80 p-1.5 text-center">
          <span className="text-[11px] font-medium">Delete for good?</span>
          <Button type="button" variant="destructive" size="xs" onClick={onConfirmDelete} className="w-full">
            Delete
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={onCancelDelete} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-square">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={selected ? `${label}, picked` : label}
        disabled={blocked}
        onClick={onToggle}
        className={cn(
          "size-full cursor-pointer overflow-hidden rounded-xl border transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          selected ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/40",
        )}
      >
        <LibraryThumb picture={picture} />
      </button>
      {selected && (
        <span className="pointer-events-none absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Check className="size-3" aria-hidden />
        </span>
      )}
      <button
        type="button"
        aria-label={`Delete ${label.toLowerCase()}`}
        onClick={onAskDelete}
        className="absolute top-1.5 right-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-background/85 text-muted-foreground opacity-100 shadow-sm transition hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

const LibraryThumb = ({ picture, faded = false }: { picture: LibraryPicture; faded?: boolean }) => {
  const dim = faded ? "opacity-40" : "";
  if (picture.kind === "video") {
    return (
      <video src={picture.url} muted playsInline preload="metadata" className={cn("size-full object-cover", dim)} />
    );
  }
  if (picture.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private upload served by our own route
      <img src={picture.url} alt="" loading="lazy" className={cn("size-full object-cover", dim)} />
    );
  }
  return (
    <div className={cn("flex size-full items-center justify-center bg-muted", dim)}>
      <FileVideo className="size-5 text-muted-foreground" aria-hidden />
    </div>
  );
};
