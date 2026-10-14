import { AbsoluteFill, Series, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { domainOf, fillPlaceholders } from "@/lib/video/format";
import { FPS, type Fact, type Scene, type ScenePlan, type SourcedQuote } from "@/lib/video/schema";
import { SCENE_COMPONENTS } from "./scenes";
import { VIDEO_THEME as T } from "./theme";

export interface CompositionProps extends Record<string, unknown> {
  plan: ScenePlan;
  facts: Fact[];
  quotes: SourcedQuote[];
  demo: boolean;
}

export function PoliVidComposition({ plan, facts, quotes, demo }: CompositionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const vertical = height > width;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 0% 0%, #17203A 0%, ${T.background} 60%)`,
        color: T.text,
        fontFamily: T.fontFamily,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 10,
          width: `${(frame / durationInFrames) * 100}%`,
          background: T.accent,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 72,
          right: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 800, letterSpacing: 4 }}>
          <div style={{ width: 28, height: 28, background: T.accent, borderRadius: 6 }} />
          POLIVID
        </div>
        {demo && (
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 3,
              color: T.accent,
              border: `3px solid ${T.accent}`,
              borderRadius: 999,
              padding: "8px 22px",
            }}
          >
            SAMPLE DATA
          </div>
        )}
      </div>

      <Series>
        {plan.scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={Math.round(scene.durationSec * FPS)}>
            <SceneFrame scene={scene} facts={facts} quotes={quotes} vertical={vertical} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

function SceneFrame({
  scene,
  facts,
  quotes,
  vertical,
}: {
  scene: Scene;
  facts: Fact[];
  quotes: SourcedQuote[];
  vertical: boolean;
}) {
  const Component = SCENE_COMPONENTS[scene.type];
  const source = facts.find((f) => scene.factIds.includes(f.id));
  const sourceLabel = scene.quote
    ? domainOf(scene.quote.sourceUrl)
    : source
      ? `${domainOf(source.sourceUrl)} · ${source.asOf}`
      : null;

  return (
    <AbsoluteFill
      style={{
        padding: vertical ? "200px 80px 440px" : "170px 140px 250px",
        justifyContent: "center",
      }}
    >
      <Component scene={scene} facts={facts} quotes={quotes} />
      <Caption
        text={fillPlaceholders(scene.narration, facts)}
        durationInFrames={Math.round(scene.durationSec * FPS)}
        vertical={vertical}
      />
      {sourceLabel && (
        <div
          style={{
            position: "absolute",
            left: vertical ? 80 : 140,
            bottom: vertical ? 120 : 60,
            fontSize: 28,
            color: T.muted,
            letterSpacing: 1,
          }}
        >
          Source: {sourceLabel}
        </div>
      )}
    </AbsoluteFill>
  );
}

/** Narration as a caption, words lighting up as they would be spoken. */
function Caption({
  text,
  durationInFrames,
  vertical,
}: {
  text: string;
  durationInFrames: number;
  vertical: boolean;
}) {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean);
  const end = Math.max(durationInFrames * 0.8, 7);
  const spoken =
    durationInFrames <= 6
      ? words.length
      : interpolate(frame, [6, end], [0, words.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? 80 : 140,
        right: vertical ? 80 : 140,
        bottom: vertical ? 200 : 120,
        fontSize: vertical ? 50 : 44,
        fontWeight: 700,
        lineHeight: 1.3,
      }}
    >
      {words.map((word, i) => (
        <span key={i} style={{ opacity: i < spoken ? 1 : 0.3 }}>
          {word}{" "}
        </span>
      ))}
    </div>
  );
}
