"use client";

import type { UIMessage } from "ai";
import { useState } from "react";
import { CoachMessage, type CoachPictureControls } from "@/components/coach/coach-message";
import { CoachPicture, type PictureLibraryState } from "@/components/coach/coach-picture";

const photo = "/presets/photography.png";
const sourceKey = "uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";

const noop = () => undefined;

const done = {
  id: "done",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Your LinkedIn headshot is done and saved to your uploads. It cost 1 credit.",
    },
    {
      type: "tool-edit_image",
      toolCallId: "edit-done",
      state: "output-available",
      input: { prompt: "Big smile", format: "1:1", sourceKey },
      output: {
        imageKey: "uploads/user_abc/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee.png",
        url: "/api/uploads/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee.png",
        prompt: "Big smile",
      },
    },
  ],
} as UIMessage;

const editing = {
  id: "editing",
  role: "assistant",
  parts: [
    {
      type: "tool-edit_image",
      toolCallId: "edit-work",
      state: "approval-responded",
      input: { prompt: "Big smile", sourceKey },
      approval: { id: "a1", approved: true },
    },
  ],
} as UIMessage;

const generating = {
  id: "generating",
  role: "assistant",
  parts: [
    {
      type: "tool-generate_image",
      toolCallId: "gen-work",
      state: "approval-responded",
      input: { prompt: "A red coat", format: "9:16" },
      approval: { id: "a2", approved: true },
    },
  ],
} as UIMessage;

const song = {
  id: "song",
  role: "assistant",
  parts: [
    {
      type: "tool-compose_song",
      toolCallId: "song-1",
      state: "output-available",
      input: {},
      output: { songId: "song_1", url: "/api/songs/song_1" },
    },
  ],
} as UIMessage;

const failed = {
  id: "failed",
  role: "assistant",
  parts: [
    { type: "text", text: "That picture didn't come back." },
    {
      type: "tool-edit_image",
      toolCallId: "edit-fail",
      state: "output-available",
      input: { sourceKey },
      output: { error: "Couldn't make that picture." },
    },
  ],
} as UIMessage;

export default function PicturePreviewPage() {
  const [library, setLibrary] = useState<PictureLibraryState>("add");
  const [notice, setNotice] = useState<string | null>(null);
  const controls: CoachPictureControls = {
    libraryState: () => library,
    onAddToLibrary: () => {
      setNotice(null);
      setLibrary("added");
    },
    onRetry: () => undefined,
    retryingToolCallId: null,
    retryDisabled: false,
    errorFor: () => notice,
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 bg-background px-4 py-8 text-foreground">
      <section className="flex flex-col gap-4">
        <h1 className="font-heading text-xl">App icon — dark purple</h1>

        {/* Home-screen mock: wallpaper, iOS mask + label, dock */}
        <div className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-[radial-gradient(120%_120%_at_20%_0%,#3b1470_0%,#1d0a3e_48%,#0a0317_100%)] p-6">
          <div className="flex items-start gap-6">
            <figure className="flex w-[104px] flex-col items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/polivid-icon-1024.png"
                alt="PoliVid app icon"
                width={88}
                height={88}
                className="size-[88px] rounded-[22.5%] shadow-[0_10px_28px_-8px_rgb(0_0_0/0.65)] ring-1 ring-white/20"
              />
              <figcaption className="text-xs font-medium text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]">PoliVid</figcaption>
            </figure>
            <div className="grid grid-cols-3 gap-4 pt-1" aria-hidden>
              {["bg-sky-400/70", "bg-emerald-400/70", "bg-amber-400/70", "bg-rose-400/70", "bg-white/25", "bg-indigo-400/70"].map(
                (tone) => (
                  <span key={tone} className={`size-[52px] rounded-[22.5%] ${tone}`} />
                ),
              )}
            </div>
          </div>
          <div className="flex justify-center rounded-[1.6rem] bg-white/10 px-4 py-3 backdrop-blur">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/polivid-icon-1024.png"
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-[22.5%] ring-1 ring-white/20"
            />
          </div>
        </div>

        {/* Browser tab mock at true favicon size */}
        <div className="max-w-sm">
          <div className="flex w-64 items-center gap-2 rounded-t-xl bg-[#2b2733] px-3 py-2 text-xs text-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/polivid-icon-1024.png" alt="" width={16} height={16} className="size-4 rounded-[4px]" />
            <span className="flex-1 truncate">PoliVid: short videos from a prompt</span>
            <span aria-hidden className="text-zinc-400">×</span>
          </div>
          <div className="h-2 rounded-b-xl bg-[#1c1a21]" />
        </div>

        {/* True sizes, dark and light surfaces */}
        {[
          { label: "On dark", className: "bg-[#12101a] text-zinc-300" },
          { label: "On light", className: "bg-zinc-100 text-zinc-600" },
        ].map((surface) => (
          <div key={surface.label} className={`flex items-end gap-6 rounded-2xl px-5 py-4 ${surface.className}`}>
            {[64, 48, 32, 16].map((size) => (
              <figure key={size} className="flex flex-col items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/polivid-icon-1024.png"
                  alt=""
                  width={size}
                  height={size}
                  style={{ width: size, height: size }}
                  className="rounded-[22.5%] ring-1 ring-black/10"
                />
                <figcaption className="text-[10px]">{size}px</figcaption>
              </figure>
            ))}
            <span className="pb-5 text-xs">{surface.label}</span>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-4">
        <h1 className="font-heading text-xl">Picture states</h1>
        <CoachPicture phase="edit" src={photo} label="Editing picture" />
        <CoachPicture phase="generate" format="1:1" label="Generating picture" />
        <CoachPicture phase="generate" format="9:16" label="Generating portrait" />
        <CoachPicture
          phase="done"
          src={photo}
          label="Edited picture: big smile"
          actions={{
            library: { state: library, onAdd: () => setLibrary("added") },
            retry: { onRetry: () => undefined },
            error: notice,
          }}
        />
      </section>
      <section className="flex flex-col gap-6">
        <CoachMessage message={done} pictureControls={controls} onApprove={noop} onDeny={noop} onAnswer={noop} />
        <CoachMessage message={editing} pictureKeys={[sourceKey]} onApprove={noop} onDeny={noop} onAnswer={noop} />
        <CoachMessage message={generating} onApprove={noop} onDeny={noop} onAnswer={noop} />
        <CoachMessage message={song} onApprove={noop} onDeny={noop} onAnswer={noop} />
        <CoachMessage message={failed} onApprove={noop} onDeny={noop} onAnswer={noop} />
      </section>
    </main>
  );
}
