"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { SourceView } from "@/lib/studio/source-types";
import { btn, Kicker, PageHeader, SectionTitle, TONE, type Tone } from "./studio-ui";

type Concept = { id: string; title: string; shape: string; angle: string; passage: string };

type Source = {
  id: string;
  title: string;
  meta: string;
  status: string;
  tone: Tone;
  excerpt: string;
  conceptCount?: string;
  conceptNote?: string;
  words?: number;
  empty?: boolean;
  concepts: Concept[];
};

const toSource = (row: SourceView): Source => {
  const pending = row.concepts.filter((concept) => !concept.videoId).length;
  const made = row.concepts.length - pending;
  return {
    id: row.id,
    title: row.title,
    meta: `${row.words} words · saved ${new Date(row.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}`,
    status: row.concepts.length === 0 ? (row.words < 80 ? "Too short" : "Saved") : pending ? `${pending} to make` : `${made} videos`,
    tone: row.concepts.length === 0 ? "neutral" : pending ? "attention" : "ready",
    excerpt: row.body,
    conceptCount: String(row.concepts.length),
    conceptNote: row.concepts.length ? "Taken from this source. A third idea is only included when the writing supports it." : undefined,
    words: row.words,
    empty: row.concepts.length === 0,
    concepts: row.concepts.map((concept) => ({
      id: concept.id,
      title: concept.videoId ? `${concept.title} · video started` : concept.title,
      shape: concept.shape,
      angle: concept.angle,
      passage: concept.passage,
    })),
  };
};

export function SourcesView() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/studio/sources");
    const payload = (await response.json().catch(() => null)) as { sources?: SourceView[] } | null;
    const next = (payload?.sources ?? []).map(toSource);
    setSources(next);
    setSelected((current) => current || next[0]?.id || "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sel = sources.find((source) => source.id === selected) ?? sources[0];
  const hasConcepts = (sel?.concepts.length ?? 0) > 0;
  const selectedCount = sel?.concepts.filter((concept) => checked[concept.id]).length ?? 0;

  async function save() {
    setNotice("");
    setBusy(true);
    try {
      const created = await fetch("/api/studio/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const saved = (await created.json().catch(() => null)) as { source?: SourceView; error?: string } | null;
      if (!created.ok || !saved?.source) throw new Error(saved?.error || "Couldn't save that source.");
      const suggested = await fetch(`/api/studio/sources/${saved.source.id}/concepts`, { method: "POST" });
      const concepts = (await suggested.json().catch(() => null)) as { error?: string } | null;
      setDraft("");
      setSelected(saved.source.id);
      setNotice(suggested.ok ? "Saved. Concepts are on the right." : concepts?.error || "Saved.");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Couldn't save that source.");
    } finally {
      setBusy(false);
    }
  }

  async function makeSelected() {
    if (!sel) return;
    const conceptIds = sel.concepts.filter((concept) => checked[concept.id]).map((concept) => concept.id);
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/studio/sources/${sel.id}/videos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conceptIds }),
      });
      const payload = (await response.json().catch(() => null)) as { jobIds?: (string | null)[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Couldn't start those videos.");
      const first = payload?.jobIds?.find(Boolean);
      if (first) router.push(`/studio/projects/${first}`);
      else await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Couldn't start those videos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sources"
        lede="Writing you already have. Each source suggests up to three concepts, never more than it can support."
      />

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Your sources" className="flex max-w-[420px] flex-[1_1_320px] flex-col gap-3">
          <div className="flex flex-col gap-2.5 rounded-[20px] border border-[#E4E4EC] bg-white px-[18px] py-4">
            <Kicker>Add a source</Kicker>
            <label htmlFor="paste" className="sr-only">
              Paste writing or a link
            </label>
            <textarea
              id="paste"
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Paste a post, a newsletter issue, notes, or a public link."
              className="w-full resize-y rounded-[12px] border border-[#E4E4EC] bg-[#FAFAFC] px-3.5 py-3 text-[14px] text-[#141321]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy || !draft.trim()} onClick={() => void save()} className={cn(btn.primary, "h-[38px] cursor-pointer px-4 disabled:cursor-not-allowed disabled:opacity-50")}>
                Save & suggest concepts
              </button>
              <button type="button" disabled title="Later phase" className={cn(btn.quiet, "h-[38px] px-3")}>
                RSS feed · later
              </button>
              <button type="button" disabled title="Later phase" className={cn(btn.quiet, "h-[38px] px-3")}>
                Substack import · later
              </button>
            </div>
            {notice ? <p className="m-0 text-[13px] text-[#3F3D4F]">{notice}</p> : null}
          </div>

          <SectionTitle size={18} className="mt-2">
            Saved
          </SectionTitle>
          {sources.length === 0 ? <p className="m-0 text-[13px] text-[#6B6A7B]">Nothing saved yet.</p> : null}
          {sources.map((source) => {
            const on = selected === source.id;
            return (
              <button
                key={source.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(source.id)}
                className={cn(
                  "flex cursor-pointer flex-col gap-1.5 rounded-[16px] border-2 bg-white px-4 py-3.5 text-left text-[#141321]",
                  on ? "border-[#5B2EE6]" : "border-[#E4E4EC]",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{source.title}</span>
                  <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap", TONE[source.tone])}>
                    {source.status}
                  </span>
                </span>
                <span className="text-[12px] text-[#6B6A7B]">{source.meta}</span>
              </button>
            );
          })}
        </section>

        {sel ? (
          <section aria-label="Source detail" className="flex min-w-0 flex-[999_1_460px] flex-col gap-3.5">
            <div className="flex flex-col gap-3 rounded-[20px] border border-[#E4E4EC] bg-white px-[22px] py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <SectionTitle>{sel.title}</SectionTitle>
                <span className="text-[12px] text-[#6B6A7B]">{sel.meta}</span>
              </div>
              <p className="m-0 text-[14px] whitespace-pre-line text-[#3F3D4F]">{sel.excerpt}</p>
              <Link
                href={`/studio/create?brief=${encodeURIComponent(sel.excerpt.slice(0, 500))}&input=writing`}
                className="inline-flex h-[34px] w-fit items-center rounded-full border border-[#E4E4EC] px-3 font-medium text-[#3F3D4F]"
              >
                Make one video from it
              </Link>
            </div>

            {sel.empty ? (
              <div className="flex flex-col items-start gap-2 rounded-[20px] border border-dashed border-[#C9C8D6] bg-[#FAFAFC] p-6">
                <h3 className="m-0 text-[15px] font-semibold">No concepts yet</h3>
                <p className="m-0 max-w-[52ch] text-[13px] text-[#3F3D4F]">
                  {sel.words && sel.words < 80
                    ? `This note is ${sel.words} words. That is enough for one short video, not for a set of distinct concepts.`
                    : "Save the source again to ask for concepts, or make one video from the text."}
                </p>
              </div>
            ) : null}

            {hasConcepts ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <SectionTitle as="h3" size={18}>
                    Suggested concepts · {sel.conceptCount}
                  </SectionTitle>
                  <span className="text-[12px] text-[#6B6A7B]">{sel.conceptNote}</span>
                </div>
                {sel.concepts.map((concept) => {
                  const on = !!checked[concept.id];
                  return (
                    <div
                      key={concept.id}
                      className={cn(
                        "flex gap-3.5 rounded-[16px] border px-[18px] py-4",
                        on ? "border-[#5B2EE6] bg-white" : "border-[#E4E4EC] bg-[#FAFAFC]",
                      )}
                    >
                      <input
                        type="checkbox"
                        id={concept.id}
                        checked={on}
                        onChange={() => setChecked((prev) => ({ ...prev, [concept.id]: !prev[concept.id] }))}
                        className="mt-0.5 size-5 flex-[0_0_20px] accent-[#5B2EE6]"
                      />
                      <label htmlFor={concept.id} className="flex flex-auto cursor-pointer flex-col gap-1.5">
                        <span className="flex flex-wrap justify-between gap-2">
                          <span className="text-[15px] font-semibold">{concept.title}</span>
                          <span className="text-[12px] text-[#6B6A7B]">{concept.shape}</span>
                        </span>
                        <span className="text-[13px] text-[#3F3D4F]">{concept.angle}</span>
                        <span className="rounded-[8px] bg-[#F4F1FE] px-2.5 py-1.5 text-[12px] text-[#3F3D4F]">
                          <span className="font-medium text-[#4A23C9]">Source passage</span> · “{concept.passage}”
                        </span>
                      </label>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
                  <span className="text-[13px] text-[#3F3D4F]">{selectedCount} selected · each one becomes its own video job</span>
                  <button type="button" disabled={busy || selectedCount === 0} onClick={() => void makeSelected()} className={cn(btn.primary, "h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50")}>
                    Make {selectedCount} videos
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
