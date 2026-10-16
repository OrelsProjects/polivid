const STARTERS = [
  "Plan a 30s Reel about why sleep matters for memory.",
  "Which style fits a kids explainer about composting?",
  "Turn this article into a voiceover video for LinkedIn.",
];

export function CoachEmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">What should we make?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Talk through the idea. I&apos;ll pick a style, write a brief, and generate only when you approve.
        </p>
      </div>
      <div className="flex w-full max-w-lg flex-col gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onPick(starter)}
            className="cursor-pointer rounded-2xl border border-border bg-white px-4 py-3 text-left text-sm shadow-sm hover:border-primary/30"
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
