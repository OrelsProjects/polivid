"use client";

import { ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

/** A row of wide cards that runs off the right edge. The round button moves it one card along. */
export function FeatureCarousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);

  const handleNext = () => {
    const row = track.current;
    if (!row) return;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 8;
    row.scrollTo({ left: atEnd ? 0 : row.scrollLeft + 492, behavior: "smooth" });
  };

  return (
    <section aria-label={label} className="relative">
      <div
        ref={track}
        className="flex snap-x gap-[22px] overflow-x-auto scroll-pl-5 px-5 pb-1 [scrollbar-width:none] sm:scroll-pl-[90px] sm:px-[90px] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Next"
        onClick={handleNext}
        className="absolute top-[110px] right-5 hidden size-[46px] cursor-pointer place-items-center rounded-full border border-white/25 bg-neutral-700/90 text-white backdrop-blur hover:bg-neutral-600 sm:grid"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </section>
  );
}
