import type { CSSProperties } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { domainOf, fillPlaceholders, formatValue } from "@/lib/video/format";
import type { Fact, Scene, SourcedQuote } from "@/lib/video/schema";
import { BAR_COLORS, VIDEO_THEME as T } from "./theme";

export interface SceneProps {
  scene: Scene;
  facts: Fact[];
  quotes: SourcedQuote[];
}

const useEnter = (delay = 0, durationInFrames?: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames });
};

const useLayout = () => {
  const { width, height } = useVideoConfig();
  return { width, height, vertical: height > width };
};

const factsFor = (scene: Scene, facts: Fact[]) =>
  scene.factIds
    .map((id) => facts.find((f) => f.id === id))
    .filter((f): f is Fact => f !== undefined);

/** Counts up to the source value, keeping the source's decimal places. */
const countUp = (value: number, progress: number) => {
  const decimals = (String(value).split(".")[1] ?? "").length;
  return Number((value * progress).toFixed(decimals));
};

const kicker: CSSProperties = {
  color: T.accent,
  fontSize: 30,
  fontWeight: 700,
  letterSpacing: 6,
  textTransform: "uppercase",
};

export function HookScene({ scene, facts }: SceneProps) {
  const enter = useEnter();
  const bar = useEnter(10, 30);
  const { vertical } = useLayout();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <div
        style={{
          fontSize: vertical ? 104 : 92,
          fontWeight: 800,
          lineHeight: 1.04,
          letterSpacing: -2,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px)`,
        }}
      >
        {fillPlaceholders(scene.headline, facts)}
      </div>
      <div style={{ height: 10, width: 220 * bar, background: T.accent, borderRadius: 5 }} />
    </div>
  );
}

export function TextScene({ scene, facts }: SceneProps) {
  const enter = useEnter();
  const { vertical } = useLayout();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div
        style={{
          fontSize: vertical ? 80 : 68,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: -1.5,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 28}px)`,
        }}
      >
        {fillPlaceholders(scene.headline, facts)}
      </div>
    </div>
  );
}

export function BigNumberScene({ scene, facts }: SceneProps) {
  const [fact] = factsFor(scene, facts);
  const enter = useEnter();
  const count = useEnter(6, 45);
  const { vertical } = useLayout();
  if (!fact || fact.value === null) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ ...kicker, opacity: enter }}>{fillPlaceholders(scene.headline, facts)}</div>
      <div
        style={{
          fontSize: vertical ? 230 : 200,
          fontWeight: 800,
          color: T.accent,
          lineHeight: 1,
          letterSpacing: -6,
          fontVariantNumeric: "tabular-nums",
          opacity: enter,
        }}
      >
        {formatValue(countUp(fact.value, count), fact)}
      </div>
      <div style={{ fontSize: 44, color: T.muted, opacity: enter }}>
        {fact.label} · {fact.asOf}
      </div>
    </div>
  );
}

interface BarItem {
  label: string;
  value: number;
  fact: Fact;
}

const barItems = (scene: Scene, facts: Fact[]): BarItem[] => {
  const used = factsFor(scene, facts);
  if (used.length === 1 && used[0].kind === "series") {
    return (used[0].points ?? []).map((p) => ({ label: p.label, value: p.value, fact: used[0] }));
  }
  return used.flatMap((f) => (f.value === null ? [] : [{ label: f.label, value: f.value, fact: f }]));
};

export function BarsScene({ scene, facts }: SceneProps) {
  const items = barItems(scene, facts).slice(0, 8);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useEnter();
  const { vertical } = useLayout();
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const rowGap = vertical ? 44 : 26;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      <div style={{ fontSize: vertical ? 76 : 64, fontWeight: 800, letterSpacing: -1, opacity: enter }}>
        {fillPlaceholders(scene.headline, facts)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: rowGap }}>
        {items.map((item, i) => {
          const grow = spring({ frame: frame - 8 - i * 6, fps, config: { damping: 200 } });
          const color = BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)];
          return (
            <div key={`${item.label}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 40 }}>
                <span style={{ color: T.text, fontWeight: 600 }}>{item.label}</span>
                <span
                  style={{
                    color: i === 0 ? T.accent : T.text,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    opacity: grow,
                  }}
                >
                  {formatValue(item.value, item.fact)}
                </span>
              </div>
              <div style={{ height: vertical ? 40 : 30, background: T.panel, borderRadius: 10 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(Math.abs(item.value) / max) * 100 * grow}%`,
                    background: color,
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineScene({ scene, facts }: SceneProps) {
  const [fact] = factsFor(scene, facts);
  const { width, vertical } = useLayout();
  const enter = useEnter();
  const draw = useEnter(8, 50);
  const points = fact?.points ?? [];
  if (!fact || points.length < 2) return null;

  const chartW = width - 2 * (vertical ? 80 : 140);
  const chartH = vertical ? 760 : 460;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  const min = lo - pad;
  const max = hi + pad;
  const xy = points.map((p, i) => ({
    x: (i / (points.length - 1)) * chartW,
    y: chartH - ((p.value - min) / (max - min)) * chartH,
  }));
  const d = xy.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
  const length = xy.slice(1).reduce((sum, pt, i) => sum + Math.hypot(pt.x - xy[i].x, pt.y - xy[i].y), 0);
  const showLabel = (i: number) =>
    points.length <= 7 || i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2);
  const first = xy[0];
  const last = xy[xy.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div style={{ fontSize: vertical ? 76 : 64, fontWeight: 800, letterSpacing: -1, opacity: enter }}>
        {fillPlaceholders(scene.headline, facts)}
      </div>
      <div style={{ fontSize: 36, color: T.muted, opacity: enter }}>
        {fact.label} · {fact.asOf}
      </div>
      <svg width={chartW} height={chartH + 80} style={{ overflow: "visible" }}>
        <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke={T.grid} strokeWidth={3} />
        <path
          d={d}
          fill="none"
          stroke={T.accent}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - draw)}
        />
        {xy.map((pt, i) => {
          const shown = draw >= i / (points.length - 1) - 0.001;
          return (
            <g key={i} opacity={shown ? 1 : 0}>
              <circle cx={pt.x} cy={pt.y} r={14} fill={T.background} stroke={T.accent} strokeWidth={6} />
              {showLabel(i) && (
                <text x={pt.x} y={chartH + 60} fill={T.muted} fontSize={32} textAnchor="middle">
                  {points[i].label}
                </text>
              )}
            </g>
          );
        })}
        <text x={first.x} y={first.y - 36} fill={T.muted} fontSize={40} fontWeight={700} textAnchor="start" opacity={enter}>
          {formatValue(points[0].value, fact)}
        </text>
        <text
          x={last.x}
          y={last.y - 36}
          fill={T.accent}
          fontSize={56}
          fontWeight={800}
          textAnchor="end"
          opacity={draw > 0.97 ? 1 : 0}
        >
          {formatValue(points[points.length - 1].value, fact)}
        </text>
      </svg>
    </div>
  );
}

export function QuoteScene({ scene }: SceneProps) {
  const enter = useEnter();
  const { vertical } = useLayout();
  if (!scene.quote) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ fontSize: 200, lineHeight: 0.6, color: T.accent, fontWeight: 800, opacity: enter }}>“</div>
      <div
        style={{
          fontSize: vertical ? 72 : 60,
          fontWeight: 700,
          lineHeight: 1.18,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 30}px)`,
        }}
      >
        {scene.quote.text}
      </div>
      <div style={{ fontSize: 40, color: T.muted, opacity: enter }}>
        {scene.quote.speaker} · {domainOf(scene.quote.sourceUrl)}
      </div>
    </div>
  );
}

export function SourcesScene({ facts, quotes }: SceneProps) {
  const enter = useEnter();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seen = new Set<string>();
  const sources = [
    ...facts.map((f) => ({ title: f.sourceTitle, url: f.sourceUrl })),
    ...quotes.map((q) => ({ title: domainOf(q.sourceUrl), url: q.sourceUrl })),
  ].filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div style={{ ...kicker, opacity: enter }}>Sources</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {sources.slice(0, 5).map((s, i) => {
          const show = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 200 } });
          return (
            <div
              key={s.url}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "24px 30px",
                background: T.panel,
                borderLeft: `8px solid ${T.accent}`,
                borderRadius: 12,
                opacity: show,
                transform: `translateX(${(1 - show) * 40}px)`,
              }}
            >
              <span style={{ fontSize: 38, fontWeight: 700 }}>{s.title}</span>
              <span style={{ fontSize: 30, color: T.muted }}>{domainOf(s.url)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FootageScene(props: SceneProps) {
  return <TextScene {...props} />;
}

export const SCENE_COMPONENTS = {
  hook: HookScene,
  text: TextScene,
  footage: FootageScene,
  big_number: BigNumberScene,
  bars: BarsScene,
  line: LineScene,
  quote: QuoteScene,
  sources: SourcesScene,
} satisfies Record<Scene["type"], (props: SceneProps) => React.ReactNode>;
