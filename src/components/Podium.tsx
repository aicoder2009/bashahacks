"use client";
import Avatar from "@/components/Avatar";
import type { PodiumEntry } from "@/lib/types";

// Classic podium order on screen: second, first, third.
const ORDER = [2, 1, 3];
// Bar heights, as a share of the podium's own width, so it scales with whatever box it is put in.
const BAR: Record<number, number> = { 1: 22, 2: 16, 3: 11.5 };

const cq = (x: number, minRem = 0): string => (minRem ? `max(${minRem}rem, ${x}cqw)` : `${x}cqw`);

function formatScore(score: number): string {
  const n = Math.round(score * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Column({ entry, revealed }: { entry: PodiumEntry; revealed: boolean }) {
  const place = entry.place;
  const first = place === 1;
  const height = cq(BAR[place] ?? 10);
  const avatar = cq(first ? 5.4 : 4.4, 1.5);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ maxWidth: cq(31) }}>
      {revealed ? (
        <div className="pop-in flex w-full min-w-0 flex-col items-center text-center" style={{ animationDelay: "0.75s", paddingBottom: cq(1.2), gap: cq(0.3) }}>
          <div className="flex justify-center" style={{ marginBottom: cq(0.3) }}>
            {entry.members.map((m, i) => (
              <span key={i} className="block" style={{ width: avatar, height: avatar, marginLeft: i ? `calc(${avatar} * -0.18)` : 0 }}>
                <Avatar spec={m.avatar} size={72} className="h-full w-full" title={m.name} />
              </span>
            ))}
          </div>
          <div className="w-full truncate font-bold leading-tight" style={{ fontSize: cq(first ? 3.1 : 2.4, 0.95) }}>
            {entry.teamName}
          </div>
          <div className="line-clamp-2 w-full font-medium leading-snug text-accent" style={{ fontSize: cq(first ? 1.9 : 1.6, 0.8) }}>
            {entry.appTitle}
          </div>
          {entry.members.length && !(entry.members.length === 1 && entry.members[0].name === entry.teamName) ? (
            <div className="line-clamp-2 w-full leading-snug text-muted" style={{ fontSize: cq(1.35, 0.7) }}>
              {entry.members.map((m) => m.name).join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative w-full shrink-0 overflow-hidden" style={{ height, borderTopLeftRadius: cq(1), borderTopRightRadius: cq(1) }}>
        {revealed ? (
          <div
            className={`flex h-full w-full flex-col items-center justify-center border border-b-0 ${
              first ? "border-accent bg-accent text-accent-fg" : "border-line bg-panel2 text-fg"
            }`}
            style={{
              borderTopLeftRadius: cq(1),
              borderTopRightRadius: cq(1),
              animation: "bh-rise 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both",
            }}
          >
            <span className="mono font-bold" style={{ fontSize: cq(first ? 8 : 5.6, 1.6), lineHeight: 1 }}>
              {place}
            </span>
            <span className="mono font-semibold" style={{ fontSize: cq(1.5, 0.7), marginTop: cq(0.5), opacity: 0.85 }}>
              {formatScore(entry.score)} points
            </span>
          </div>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center border border-b-0 border-dashed border-muted bg-panel text-muted"
            style={{ borderTopLeftRadius: cq(1), borderTopRightRadius: cq(1) }}
            aria-label="Not revealed yet"
          >
            <span className="mono font-bold" style={{ fontSize: cq(5, 1.4), lineHeight: 1 }}>
              ?
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The winners podium. `step` 0 shows only question marks, 1 reveals third place,
 * 2 also reveals second, 3 also reveals first. Places with no entry are simply left out.
 * It sizes itself from the width of the box it is placed in.
 */
export default function Podium({ entries, step }: { entries: PodiumEntry[]; step: number }) {
  const columns = ORDER.map((place) => entries.find((e) => e.place === place)).filter((e): e is PodiumEntry => !!e);
  if (!columns.length) return null;
  return (
    <div className="@container flex h-full w-full items-end">
      <div className="flex w-full items-end justify-center border-b border-line" style={{ gap: cq(2.2) }}>
        {columns.map((e) => {
          const revealed = step >= 4 - e.place;
          return <Column key={`${e.place}-${e.teamId}-${revealed ? "on" : "off"}`} entry={e} revealed={revealed} />;
        })}
      </div>
    </div>
  );
}
