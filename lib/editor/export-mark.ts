export interface ExportMark {
  videoId: string | null;
  version: number | null;
}

/** The finished MP4 when it was rendered from the timeline that is saved now. */
export const currentExportVideoId = (mark: ExportMark, version: number, saved: boolean): string | null => {
  if (!saved || !mark.videoId || mark.version !== version) return null;
  return mark.videoId;
};

/**
 * The mark to store after a render. A late write for an older cut must not
 * replace a newer one. A second render of the same version replaces the file.
 */
export const nextExportMark = (
  current: { version: number | null },
  incoming: { videoId: string; version: number },
): { videoId: string; version: number } | null => {
  if (current.version != null && current.version > incoming.version) return null;
  return incoming;
};
