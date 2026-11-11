import { Fragment } from "react";
import Link from "next/link";
import { parseCoachMarkdown, type CoachInline, type CoachMarkdownLink } from "@/lib/coach/coach-markdown";
import type { CoachPictureRef } from "@/lib/coach/picture-mentions";
import { cn } from "@/lib/utils";

const linkClass =
  "rounded-sm font-medium underline decoration-primary underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50";

function InlineRun({ nodes, pictures }: { nodes: CoachInline[]; pictures: readonly CoachPictureRef[] }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.text}</Fragment>;
      case "bold":
        return (
          <strong key={index} className="font-semibold">
            <InlineRun nodes={node.children} pictures={pictures} />
          </strong>
        );
      case "italic":
        return (
          <em key={index}>
            <InlineRun nodes={node.children} pictures={pictures} />
          </em>
        );
      case "code":
        return (
          <code key={index} className="rounded bg-foreground/10 px-1 py-px font-mono text-[0.9em]">
            {node.text}
          </code>
        );
      case "link":
        return (
          <Link key={index} href={node.href} className={linkClass}>
            {node.text}
          </Link>
        );
      case "image":
        return (
          // eslint-disable-next-line @next/next/no-img-element -- frame the Coach already saved
          <img
            key={index}
            src={node.url}
            alt={node.alt}
            className="mt-2 block h-48 w-auto max-w-full rounded-lg border border-border object-cover"
          />
        );
      default:
        return null;
    }
  });
}

/** Assistant prose. Bold, italics, lists, and inline code. A cited frame shows the picture. */
export function CoachProse({
  text,
  links = [],
  pictures = [],
}: {
  text: string;
  links?: readonly CoachMarkdownLink[];
  pictures?: readonly CoachPictureRef[];
}) {
  const blocks = parseCoachMarkdown(text, links, pictures);
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index}>
              <InlineRun nodes={block.children} pictures={pictures} />
            </p>
          );
        }
        const ListTag = block.ordered ? "ol" : "ul";
        return (
          <ListTag
            key={index}
            className={cn(
              "space-y-1.5 pl-5 marker:text-muted-foreground",
              block.ordered ? "list-decimal" : "list-disc",
            )}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <InlineRun nodes={item} pictures={pictures} />
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
