"use client";

import { Popover } from "@base-ui/react/popover";
import { Check, ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LibraryPicture = {
  key: string;
  url: string;
  uploadedAt: string | null;
};

type ImageLibraryProps = {
  selectedKeys: string[];
  maxSelected: number;
  disabled?: boolean;
  uploading?: boolean;
  triggerLabel: string;
  onToggle: (key: string, url: string) => void;
  onUploadNew: () => void;
  onDeleted: (key: string) => void;
};

const SKELETON_TILES = 5;

const uploadedLabel = (uploadedAt: string | null) =>
  uploadedAt
    ? new Date(uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "earlier";

/** Add tile that opens the user's picture library: reuse an upload, upload a new one, or delete old ones. */
export function ImageLibrary({
  selectedKeys,
  maxSelected,
  disabled,
  uploading,
  triggerLabel,
  onToggle,
  onUploadNew,
  onDeleted,
}: ImageLibraryProps) {
  const [open, setOpen] = useState(false);
  const [pictures, setPictures] = useState<LibraryPicture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const pendingDeletes = useRef(new Set<string>());
  const atLimit = selectedKeys.length >= maxSelected;

  const loadPictures = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/uploads", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { uploads?: LibraryPicture[]; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Couldn't load your pictures.");
      setPictures((body?.uploads ?? []).filter((picture) => !pendingDeletes.current.has(picture.key)));
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load your pictures.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setConfirmingKey(null);
    if (next) void loadPictures();
  };

  const handleUploadNew = () => {
    setOpen(false);
    onUploadNew();
  };

  const handleDelete = (key: string) => {
    const index = pictures.findIndex((item) => item.key === key);
    const picture = pictures[index];
    if (!picture) return;
    const wasSelected = selectedKeys.includes(key);
    pendingDeletes.current.add(key);
    setPictures((current) => current.filter((item) => item.key !== key));
    setConfirmingKey(null);
    setError(null);
    onDeleted(key);

    void fetch(picture.url, { method: "DELETE" })
      .then(async (response) => {
        if (response.ok) return;
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't delete that picture.");
      })
      .catch((cause: unknown) => {
        pendingDeletes.current.delete(key);
        setPictures((current) => {
          if (current.some((item) => item.key === key)) return current;
          const next = [...current];
          next.splice(Math.min(index, next.length), 0, picture);
          return next;
        });
        if (wasSelected) onToggle(key, picture.url);
        setError(cause instanceof Error ? cause.message : "Couldn't delete that picture.");
      });
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        disabled={disabled || uploading}
        aria-label={triggerLabel}
        className="flex size-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 px-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-primary/40 data-[popup-open]:text-foreground sm:size-32"
      >
        {uploading ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <>
            <ImagePlus className="size-5" aria-hidden />
            <span>Add</span>
          </>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={16} className="z-50">
          <Popover.Popup className="w-[min(24rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-2xl border border-border bg-white p-3 shadow-lg outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <Popover.Title className="text-sm font-semibold">Your pictures</Popover.Title>
              <Popover.Description className="text-xs text-muted-foreground">
                {selectedKeys.length}/{maxSelected} picked
              </Popover.Description>
            </div>

            <div className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-0.5">
              <button
                type="button"
                disabled={atLimit}
                onClick={handleUploadNew}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="size-4" aria-hidden />
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
                  onToggle={() => onToggle(picture.key, picture.url)}
                  onAskDelete={() => setConfirmingKey(picture.key)}
                  onCancelDelete={() => setConfirmingKey(null)}
                  onConfirmDelete={() => void handleDelete(picture.key)}
                />
              ))}
            </div>

            {loaded && pictures.length === 0 && !error && (
              <p className="mt-3 px-1 text-xs text-muted-foreground">
                No pictures yet. Upload one and it stays here for next time.
              </p>
            )}
            {atLimit && (
              <p className="mt-3 px-1 text-xs text-muted-foreground">
                That&apos;s {maxSelected} pictures, the most one video can use. Unpick one to swap it.
              </p>
            )}
            {error && (
              <p className="mt-3 px-1 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
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
  const label = `Picture uploaded ${uploadedLabel(picture.uploadedAt)}`;

  if (confirming) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-xl border border-destructive/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- private upload served by our own route */}
        <img src={picture.url} alt="" className="size-full object-cover opacity-40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/70 p-1.5 text-center">
          <span className="text-[11px] font-medium">Delete for good?</span>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={onConfirmDelete}
            className="w-full"
          >
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
        {/* eslint-disable-next-line @next/next/no-img-element -- private upload served by our own route */}
        <img src={picture.url} alt="" loading="lazy" className="size-full object-cover" />
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
        className="absolute top-1.5 right-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-white/90 text-muted-foreground opacity-100 shadow-sm transition hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
