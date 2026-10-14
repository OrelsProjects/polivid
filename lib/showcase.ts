import type { VideoFormat, VideoLength } from "@/lib/video/schema";

export type VisualStyle = "bold" | "minimal" | "editorial";

export interface ShowcaseVideo {
  title: string;
  style: VisualStyle;
  kind: string;
  format: VideoFormat;
  length: VideoLength;
  prompt: string;
}

/** Marketing examples. Create similar opens the generator with the prompt and settings filled in. */
export const SHOWCASE: ShowcaseVideo[] = [
  {
    title: "Why sleep matters for memory",
    style: "bold",
    kind: "Topic",
    format: "9:16",
    length: 60,
    prompt: "Why sleep matters for memory",
  },
  {
    title: "5 habits of consistent writers",
    style: "minimal",
    kind: "Topic",
    format: "9:16",
    length: 30,
    prompt: "Five habits of consistent writers",
  },
  {
    title: "How compound interest works",
    style: "editorial",
    kind: "Data story",
    format: "1:1",
    length: 60,
    prompt: "Explain how compound interest works, with sourced numbers",
  },
  {
    title: "What is a transformer?",
    style: "bold",
    kind: "Topic",
    format: "9:16",
    length: 60,
    prompt: "What is a transformer, in 60 seconds",
  },
  {
    title: "Our October newsletter, as a video",
    style: "minimal",
    kind: "Article",
    format: "16:9",
    length: 90,
    prompt: "Turn this month's newsletter into a short video. Lead with the one idea worth remembering.",
  },
  {
    title: "A short history of the espresso",
    style: "editorial",
    kind: "Topic",
    format: "9:16",
    length: 60,
    prompt: "A short history of the espresso",
  },
];

export const showcaseHref = (video: ShowcaseVideo) => {
  const params = new URLSearchParams({
    prompt: video.prompt,
    format: video.format,
    length: String(video.length),
    style: video.style,
  });
  return `/create?${params.toString()}`;
};

export const showcaseMeta = (video: ShowcaseVideo) =>
  `${video.kind} · ${video.length}s · ${video.format}`;
