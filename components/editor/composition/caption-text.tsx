import { activeWordIndex, captionWords, isWordByWord } from "@/lib/editor/caption-words";
import { highlightParts } from "@/lib/editor/layout-box";
import type { TextItem } from "@/lib/editor/schema";

type CaptionLike = Pick<TextItem, "text" | "words" | "durationInFrames" | "style" | "highlight">;

/**
 * The words of a text clip at `frame` (from the clip's start). Plain text draws as one run, with a
 * highlighted word in its own color. A word-by-word style draws each word, so the one being said
 * can change color, gain a box, or grow, and words not yet said can be dimmed or hidden.
 */
export function CaptionText({ item, frame }: { item: CaptionLike; frame: number }) {
  if (!isWordByWord(item)) {
    const parts = highlightParts(item.text, item.highlight);
    if (parts.length === 1 && !parts[0].color) return <>{item.text}</>;
    return (
      <>
        {parts.map((part, index) =>
          part.color ? (
            <span key={index} style={{ color: part.color }}>
              {part.text}
            </span>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </>
    );
  }
  const words = captionWords(item);
  const active = activeWordIndex(words, frame);
  const highlight = item.highlight?.text.trim().toLowerCase();
  const { activeWord, upcomingOpacity } = item.style;
  return (
    <>
      {words.map((word, index) => {
        const isActive = index === active;
        const upcoming = index > active;
        const marked = highlight && word.text.toLowerCase().replace(/[^\p{L}\p{N}%$']/gu, "") === highlight;
        return (
          <span key={index}>
            <span
              style={{
                display: "inline-block",
                ...(marked && item.highlight ? { color: item.highlight.color } : {}),
                ...(isActive && activeWord?.color ? { color: activeWord.color } : {}),
                ...(isActive && activeWord?.background
                  ? { background: activeWord.background, borderRadius: "0.18em", padding: "0 0.14em", margin: "0 -0.14em" }
                  : {}),
                ...(isActive && activeWord?.scale && activeWord.scale !== 1 ? { transform: `scale(${activeWord.scale})` } : {}),
                ...(upcoming && upcomingOpacity !== undefined ? { opacity: upcomingOpacity } : {}),
              }}
            >
              {word.text}
            </span>
            {index < words.length - 1 ? " " : null}
          </span>
        );
      })}
    </>
  );
}
