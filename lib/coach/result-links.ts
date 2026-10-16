export type CoachResultLink = {
  id: string;
  href: string;
  label: string;
};

type ToolPart = {
  type: string;
  state?: string;
  output?: unknown;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export type CoachTextPiece = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const outputRecord = (output: unknown) =>
  output && typeof output === "object" ? (output as { error?: unknown; jobId?: unknown; productionId?: unknown }) : null;

export const resultLinksFromParts = (parts: readonly ToolPart[]): CoachResultLink[] => {
  const links: CoachResultLink[] = [];
  for (const part of parts) {
    if (part.state !== "output-available") continue;
    const output = outputRecord(part.output);
    if (!output || output.error) continue;
    if (part.type === "tool-create_video" && typeof output.jobId === "string" && output.jobId) {
      links.push({ id: output.jobId, href: `/videos/${output.jobId}`, label: "Open video" });
    }
    if (part.type === "tool-start_production" && typeof output.productionId === "string" && output.productionId) {
      links.push({
        id: output.productionId,
        href: `/productions/${output.productionId}`,
        label: "Open production",
      });
    }
  }
  return links;
};

/** Turns a known job or production id inside coach prose into a link target. */
export const linkKnownIds = (text: string, links: readonly Pick<CoachResultLink, "id" | "href">[]): CoachTextPiece[] => {
  const hrefById = new Map(links.map((link) => [link.id.toLowerCase(), link.href]));
  const pieces: CoachTextPiece[] = [];
  let cursor = 0;

  for (const match of text.matchAll(UUID)) {
    const href = hrefById.get(match[0].toLowerCase());
    const start = match.index ?? 0;
    if (!href) continue;
    if (start > cursor) pieces.push({ kind: "text", text: text.slice(cursor, start) });
    pieces.push({ kind: "link", text: match[0], href });
    cursor = start + match[0].length;
  }

  if (cursor === 0) return [{ kind: "text", text }];
  if (cursor < text.length) pieces.push({ kind: "text", text: text.slice(cursor) });
  return pieces;
};
