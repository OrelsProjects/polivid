import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Sketch } from "@/lib/video/layout/sketch";

/** Two inks on paper. */
const INK = "#1F2937";
const ACCENT = "#E4572E";
const HAND = "'Permanent Marker', cursive";
const BODY = "'Lexend', sans-serif";

const useDraw = (delay: number, length = 18) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: length });
};

/** A wobbly underline, drawn in as the headline lands. */
function Scribble({ width, delay }: { width: number; delay: number }) {
  const draw = useDraw(delay, 16);
  const d = `M4,14 C${width * 0.25},4 ${width * 0.5},20 ${width * 0.75},8 S${width - 6},14 ${width - 4},10`;
  return (
    <svg width={width} height={24} style={{ overflow: "visible" }} aria-hidden>
      <path d={d} fill="none" stroke={ACCENT} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    </svg>
  );
}

function Box({ children, delay, accent = false }: { children: React.ReactNode; delay: number; accent?: boolean }) {
  const show = useDraw(delay);
  return (
    <div
      style={{
        border: `5px solid ${accent ? ACCENT : INK}`,
        borderRadius: "18px 26px 20px 24px",
        padding: "22px 30px",
        fontFamily: BODY,
        fontWeight: 700,
        fontSize: 46,
        color: INK,
        background: "rgba(255,255,255,0.55)",
        textAlign: "center",
        opacity: show,
        transform: `scale(${0.85 + 0.15 * show}) rotate(${accent ? 1 : -1}deg)`,
      }}
    >
      {children}
    </div>
  );
}

function Arrow({ delay, vertical }: { delay: number; vertical: boolean }) {
  const draw = useDraw(delay, 12);
  return (
    <svg width={vertical ? 40 : 90} height={vertical ? 70 : 40} aria-hidden style={{ flexShrink: 0 }}>
      <path
        d={vertical ? "M20,4 L20,58 M8,46 L20,62 L32,46" : "M4,20 L78,20 M64,8 L82,20 L64,32"}
        fill="none"
        stroke={ACCENT}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
}

const numeric = (value: string | undefined) => Number((value ?? "").replace(/[^\d.-]/g, "")) || 0;

/**
 * One sketch-explainer beat: a hand-lettered headline and a simple drawing on paper, in two inks.
 * Everything shown comes from the sketch, which only carries words and numbers the person wrote.
 */
export function SketchFrame({ sketch, vertical }: { sketch: Sketch; vertical: boolean }) {
  const title = useDraw(0);
  const figure = useDraw(12);
  const versus = useDraw(18);
  const max = Math.max(1, ...sketch.items.map((item) => Math.abs(numeric(item.value))));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        padding: vertical ? "220px 70px 460px" : "120px 160px 260px",
        color: INK,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontFamily: HAND, fontSize: vertical ? 112 : 96, lineHeight: 1.05, textAlign: "center", opacity: title, transform: `translateY(${(1 - title) * 24}px) rotate(-2deg)` }}>
          {sketch.headline}
        </div>
        <Scribble width={vertical ? 420 : 380} delay={8} />
      </div>

      {sketch.kind === "number" && sketch.items[0] ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: HAND, fontSize: vertical ? 220 : 180, color: ACCENT, lineHeight: 1, opacity: figure }}>{sketch.items[0].value}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 48, textAlign: "center" }}>{sketch.items[0].label}</div>
        </div>
      ) : null}

      {sketch.kind === "bars" ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: vertical ? 36 : 56, height: vertical ? 520 : 360 }}>
          {sketch.items.map((item, index) => (
            <Bar key={index} label={item.label} value={item.value ?? ""} share={Math.abs(numeric(item.value)) / max} delay={12 + index * 6} accent={index === 0} vertical={vertical} />
          ))}
        </div>
      ) : null}

      {sketch.kind === "steps" ? (
        <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 14 }}>
          {sketch.items.map((item, index) => (
            <div key={index} style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 14 }}>
              {index > 0 ? <Arrow delay={10 + index * 8} vertical={vertical} /> : null}
              <Box delay={12 + index * 8} accent={index === sketch.items.length - 1}>
                {item.label}
              </Box>
            </div>
          ))}
        </div>
      ) : null}

      {sketch.kind === "compare" && sketch.items.length >= 2 ? (
        <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 28 }}>
          <Box delay={12}>{sketch.items[0].label}</Box>
          <div style={{ fontFamily: HAND, fontSize: 64, color: ACCENT, opacity: versus }}>vs</div>
          <Box delay={22} accent>
            {sketch.items[1].label}
          </Box>
        </div>
      ) : null}
    </div>
  );
}

function Bar({ label, value, share, delay, accent, vertical }: { label: string; value: string; share: number; delay: number; accent: boolean; vertical: boolean }) {
  const grow = useDraw(delay, 22);
  const height = (vertical ? 400 : 260) * Math.max(0.06, share) * grow;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: vertical ? 180 : 170 }}>
      <div style={{ fontFamily: HAND, fontSize: 52, color: accent ? ACCENT : INK, opacity: grow }}>{value}</div>
      <div
        style={{
          width: "100%",
          height,
          border: `5px solid ${INK}`,
          borderRadius: "12px 16px 6px 8px",
          background: accent
            ? `repeating-linear-gradient(-45deg, ${ACCENT}, ${ACCENT} 10px, transparent 10px, transparent 20px)`
            : `repeating-linear-gradient(-45deg, ${INK}33, ${INK}33 10px, transparent 10px, transparent 20px)`,
        }}
      />
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, textAlign: "center" }}>{label}</div>
    </div>
  );
}
