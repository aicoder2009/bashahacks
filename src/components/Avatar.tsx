import type { AvatarSpec } from "@/lib/types";

// Original Basha Hacks characters, built from mix-and-match parts.
const COLORS: [string, string, string][] = [
  // body, shade, outline
  ["#7fbf7a", "#5a9d57", "#2c5a2b"],
  ["#5fc2b0", "#3f9d8c", "#1f5a50"],
  ["#74ade3", "#4f88c2", "#24507e"],
  ["#f4cf52", "#dba92c", "#7d5a0a"],
  ["#f5a25a", "#d87f33", "#7a400f"],
  ["#f097b8", "#d46f95", "#7d2f4c"],
  ["#ad92e0", "#8769c4", "#46307e"],
  ["#bfdc6c", "#98b944", "#4f6316"],
];

export const SHAPE_NAMES = ["Sprout", "Drop", "Sun", "Cactus", "Bee", "Bot", "Cloud", "Leaf", "Mushroom", "Earth"];

type Face = { x: number; y: number; k: number; top: number };

function body(shape: number, c: [string, string, string]): { el: React.ReactNode; face: Face } {
  const [fill, shade, line] = c;
  const st = { stroke: line, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (shape) {
    case 0:
      return {
        face: { x: 50, y: 62, k: 1, top: 30 },
        el: (
          <>
            <path d="M50 34 C50 22 40 14 28 16 C28 28 38 34 50 34 Z" fill={shade} {...st} />
            <path d="M50 34 C50 20 62 10 76 14 C74 28 62 36 50 34 Z" fill={fill} {...st} />
            <circle cx="50" cy="62" r="30" fill={fill} {...st} />
          </>
        ),
      };
    case 1:
      return {
        face: { x: 50, y: 62, k: 0.95, top: 22 },
        el: <path d="M50 8 C50 8 20 44 20 62 A30 30 0 0 0 80 62 C80 44 50 8 50 8 Z" fill={fill} {...st} />,
      };
    case 2:
      return {
        face: { x: 50, y: 52, k: 0.9, top: 24 },
        el: (
          <>
            {Array.from({ length: 10 }).map((_, i) => (
              <path key={i} d="M50 4 L57 18 L43 18 Z" fill={shade} {...st} transform={`rotate(${i * 36} 50 52)`} />
            ))}
            <circle cx="50" cy="52" r="27" fill={fill} {...st} />
          </>
        ),
      };
    case 3:
      return {
        face: { x: 50, y: 50, k: 0.85, top: 14 },
        el: (
          <>
            <path d="M24 44 v12 a8 8 0 0 0 8 8 h6" fill="none" stroke={line} strokeWidth="17" strokeLinecap="round" />
            <path d="M24 44 v12 a8 8 0 0 0 8 8 h6" fill="none" stroke={shade} strokeWidth="11" strokeLinecap="round" />
            <path d="M76 36 v14 a8 8 0 0 1 -8 8 h-6" fill="none" stroke={line} strokeWidth="17" strokeLinecap="round" />
            <path d="M76 36 v14 a8 8 0 0 1 -8 8 h-6" fill="none" stroke={shade} strokeWidth="11" strokeLinecap="round" />
            <rect x="32" y="12" width="36" height="80" rx="18" fill={fill} {...st} />
          </>
        ),
      };
    case 4:
      return {
        face: { x: 50, y: 56, k: 0.9, top: 30 },
        el: (
          <>
            <ellipse cx="26" cy="36" rx="16" ry="11" fill="#ffffff" opacity="0.85" {...st} transform="rotate(-25 26 36)" />
            <ellipse cx="74" cy="36" rx="16" ry="11" fill="#ffffff" opacity="0.85" {...st} transform="rotate(25 74 36)" />
            <ellipse cx="50" cy="60" rx="32" ry="28" fill={fill} {...st} />
            <path d="M24 76 Q50 88 76 76" fill="none" stroke={line} strokeWidth="6" strokeLinecap="round" opacity="0.55" />
            <path d="M30 84 Q50 93 70 84" fill="none" stroke={line} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
          </>
        ),
      };
    case 5:
      return {
        face: { x: 50, y: 58, k: 0.95, top: 30 },
        el: (
          <>
            <path d="M50 30 V16" {...st} fill="none" />
            <circle cx="50" cy="13" r="5" fill={shade} {...st} />
            <rect x="12" y="50" width="10" height="18" rx="4" fill={shade} {...st} />
            <rect x="78" y="50" width="10" height="18" rx="4" fill={shade} {...st} />
            <rect x="20" y="30" width="60" height="58" rx="14" fill={fill} {...st} />
          </>
        ),
      };
    case 6:
      return {
        face: { x: 50, y: 60, k: 0.9, top: 28 },
        el: (
          <path
            d="M26 82 a18 18 0 0 1 -2 -36 a20 20 0 0 1 36 -10 a17 17 0 0 1 22 14 a16 16 0 0 1 -4 32 Z"
            fill={fill}
            {...st}
          />
        ),
      };
    case 7:
      return {
        face: { x: 50, y: 56, k: 0.85, top: 22 },
        el: (
          <>
            <path d="M50 8 C82 22 88 60 50 92 C12 60 18 22 50 8 Z" fill={fill} {...st} />
            <path d="M50 92 V78" {...st} fill="none" />
          </>
        ),
      };
    case 8:
      return {
        face: { x: 50, y: 72, k: 0.72, top: 14 },
        el: (
          <>
            <rect x="34" y="52" width="32" height="40" rx="12" fill="#f6ecd9" {...st} />
            <path d="M10 54 C10 26 30 12 50 12 C70 12 90 26 90 54 Z" fill={fill} {...st} />
            <circle cx="32" cy="34" r="6" fill="#ffffff" opacity="0.8" />
            <circle cx="58" cy="26" r="5" fill="#ffffff" opacity="0.8" />
            <circle cx="72" cy="42" r="4" fill="#ffffff" opacity="0.8" />
          </>
        ),
      };
    default:
      return {
        face: { x: 50, y: 56, k: 0.95, top: 24 },
        el: (
          <>
            <circle cx="50" cy="54" r="34" fill={fill} {...st} />
            <path d="M24 40 C30 30 40 30 44 38 C40 44 30 48 24 40 Z" fill={shade} opacity="0.9" />
            <path d="M58 70 C66 62 78 64 78 72 C72 80 62 80 58 70 Z" fill={shade} opacity="0.9" />
            <path d="M60 26 C66 24 72 28 74 34 C68 36 62 32 60 26 Z" fill={shade} opacity="0.9" />
          </>
        ),
      };
  }
}

function eyes(kind: number, ink: string): React.ReactNode {
  const L = -11;
  const R = 11;
  switch (kind) {
    case 1:
      return (
        <>
          <circle cx={L} cy="-3" r="6.5" fill="#fff" stroke={ink} strokeWidth="2" />
          <circle cx={R} cy="-3" r="6.5" fill="#fff" stroke={ink} strokeWidth="2" />
          <circle cx={L + 1} cy="-2" r="3" fill={ink} />
          <circle cx={R + 1} cy="-2" r="3" fill={ink} />
        </>
      );
    case 2:
      return (
        <>
          <path d={`M${L - 5} -1 Q${L} -8 ${L + 5} -1`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${R - 5} -1 Q${R} -8 ${R + 5} -1`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 3:
      return (
        <>
          <circle cx={L} cy="-3" r="3.6" fill={ink} />
          <path d={`M${R - 5} -3 H${R + 5}`} stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 4:
      return (
        <>
          <ellipse cx={L} cy="-3" rx="3.4" ry="5.4" fill={ink} />
          <ellipse cx={R} cy="-3" rx="3.4" ry="5.4" fill={ink} />
          <circle cx={L + 1.2} cy="-5" r="1.3" fill="#fff" />
          <circle cx={R + 1.2} cy="-5" r="1.3" fill="#fff" />
        </>
      );
    case 5:
      return (
        <>
          <path d={`M${L - 5} -5 Q${L} 0 ${L + 5} -5`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${R - 5} -5 Q${R} 0 ${R + 5} -5`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <circle cx={L} cy="-3" r="3.6" fill={ink} />
          <circle cx={R} cy="-3" r="3.6" fill={ink} />
        </>
      );
  }
}

function mouth(kind: number, ink: string): React.ReactNode {
  switch (kind) {
    case 1:
      return <path d="M-9 7 Q0 20 9 7 Z" fill={ink} stroke={ink} strokeWidth="2" strokeLinejoin="round" />;
    case 2:
      return <ellipse cx="0" cy="11" rx="3.6" ry="4.4" fill={ink} />;
    case 3:
      return (
        <>
          <path d="M-8 8 Q0 15 8 8" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M-1 11 Q3 19 7 11 Z" fill="#f2768f" stroke={ink} strokeWidth="1.5" />
        </>
      );
    case 4:
      return <path d="M-6 11 H6" stroke={ink} strokeWidth="3" strokeLinecap="round" />;
    case 5:
      return <path d="M-8 8 Q-4 14 0 8 Q4 14 8 8" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
    default:
      return <path d="M-8 8 Q0 16 8 8" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />;
  }
}

function accessory(kind: number, face: Face, ink: string): React.ReactNode {
  const y = face.top;
  switch (kind) {
    case 1: // cap
      return (
        <g transform={`translate(50 ${y})`}>
          <path d="M-20 6 Q-20 -14 0 -14 Q20 -14 20 6 Z" fill="#e5705f" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M14 6 H34" stroke={ink} strokeWidth="6" strokeLinecap="round" />
          <path d="M14 6 H33" stroke="#e5705f" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 2: // bow
      return (
        <g transform={`translate(66 ${y + 4})`}>
          <path d="M0 0 L-13 -8 V8 Z" fill="#f097b8" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M0 0 L13 -8 V8 Z" fill="#f097b8" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <circle r="4" fill="#d46f95" stroke={ink} strokeWidth="2.5" />
        </g>
      );
    case 3: // flower
      return (
        <g transform={`translate(70 ${y + 4})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx="0" cy="-7" r="5" fill="#ffffff" stroke={ink} strokeWidth="2" transform={`rotate(${a})`} />
          ))}
          <circle r="4" fill="#f4cf52" stroke={ink} strokeWidth="2" />
        </g>
      );
    case 4: // crown
      return (
        <g transform={`translate(50 ${y - 2})`}>
          <path d="M-16 6 L-18 -10 L-8 -2 L0 -14 L8 -2 L18 -10 L16 6 Z" fill="#f4cf52" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        </g>
      );
    case 5: // sunglasses
      return (
        <g transform={`translate(${face.x} ${face.y - 3 * face.k}) scale(${face.k})`}>
          <rect x="-21" y="-7" width="18" height="12" rx="5" fill="#1d1d1b" stroke={ink} strokeWidth="2" />
          <rect x="3" y="-7" width="18" height="12" rx="5" fill="#1d1d1b" stroke={ink} strokeWidth="2" />
          <path d="M-3 -2 H3" stroke={ink} strokeWidth="2.5" />
        </g>
      );
    case 6: // star
      return (
        <g transform={`translate(72 ${y + 2})`}>
          <path d="M0 -10 L3 -3 L10 -3 L4.5 1.5 L6.5 9 L0 4.5 L-6.5 9 L-4.5 1.5 L-10 -3 L-3 -3 Z" fill="#f4cf52" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
        </g>
      );
    default:
      return null;
  }
}

export default function Avatar({ spec, size = 40, className = "", title }: { spec: AvatarSpec; size?: number; className?: string; title?: string }) {
  const c = COLORS[spec.c % COLORS.length];
  const ink = "#23221d";
  const { el, face } = body(spec.s % 10, c);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title || `${SHAPE_NAMES[spec.s % 10]} avatar`}
      style={{ flexShrink: 0, overflow: "visible" }}
    >
      {title ? <title>{title}</title> : null}
      {el}
      <g transform={`translate(${face.x} ${face.y}) scale(${face.k})`}>
        {spec.a % 7 === 5 ? null : eyes(spec.e % 6, ink)}
        {mouth(spec.m % 6, ink)}
        <circle cx="-17" cy="6" r="4" fill="#f2768f" opacity="0.35" />
        <circle cx="17" cy="6" r="4" fill="#f2768f" opacity="0.35" />
      </g>
      {accessory(spec.a % 7, face, ink)}
    </svg>
  );
}
