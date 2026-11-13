"use client";
import Avatar from "@/components/Avatar";
import { Logo, ThemeToggle } from "@/components/ui";
import { fmtClock } from "@/lib/text";
import { timeOfDay } from "@/lib/client";
import type { SyncResponse } from "@/lib/types";

const STEPS: [string, string][] = [
  ["idea", "Idea"],
  ["build", "Build"],
  ["publish", "Publish"],
  ["submit", "Submit"],
];

export function UsageBar({ pctLeft, blocked }: { pctLeft: number; blocked: boolean }) {
  const pct = Math.round(pctLeft * 100);
  const tone = blocked || pct < 10 ? "bg-red" : pct < 25 ? "bg-amber" : "bg-accent";
  const text = blocked || pct < 10 ? "text-red" : pct < 25 ? "text-amber" : "text-muted";
  return (
    <div className="flex items-center gap-2" title="How much AI help your team has left">
      <span className="label hidden xl:inline">AI usage</span>
      <div
        className="h-2 w-20 overflow-hidden rounded-full bg-panel2"
        role="progressbar"
        aria-label="AI usage left"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={`h-full rounded-full ${tone} transition-[width] duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className={`mono text-[0.78rem] ${text}`}>{pct}% left</span>
    </div>
  );
}

export default function TopBar({
  sync,
  now,
  unread,
  onBell,
  onTeam,
  onSubmit,
}: {
  sync: SyncResponse;
  now: number;
  unread: number;
  onBell: () => void;
  onTeam: () => void;
  onSubmit: () => void;
}) {
  const { event, team } = sync;
  const done = team.milestones || {};
  const firstOpen = STEPS.findIndex(([k]) => !done[k]);

  let clock = "";
  let clockLabel = "";
  let clockTone = "text-fg";
  if (event.phase === "lobby") {
    clockLabel = "starts";
    clock = event.startsAt > now ? (event.startsAt - now < 3600_000 * 3 ? fmtClock(event.startsAt - now) : timeOfDay(event.startsAt)) : "soon";
  } else if (event.phase === "hacking") {
    const left = event.pausedRemainingMs != null ? event.pausedRemainingMs : Math.max(0, event.endsAt - now);
    clock = fmtClock(left);
    clockLabel = event.pausedRemainingMs != null ? "paused" : "left";
    clockTone = left < 60_000 ? "text-red" : left < 600_000 ? "text-amber" : "text-fg";
  } else {
    clock = "Time is up";
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg px-3">
      <Logo />

      <button className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2 py-1 hover:bg-panel2" onClick={onTeam} title="Your team and code">
        <span className="flex -space-x-1.5">
          {team.members.slice(0, 4).map((m) => (
            <span key={m.id} className={`rounded-full ${m.online ? "" : "opacity-45"}`}>
              <Avatar spec={m.avatar} size={24} title={m.name} />
            </span>
          ))}
        </span>
        <span className="max-w-[9rem] truncate text-sm font-medium">{team.name}</span>
        <span className="mono rounded bg-panel2 px-1.5 py-0.5 text-[0.72rem] tracking-widest text-muted">{team.code}</span>
      </button>

      <ol className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Your progress">
        {STEPS.map(([key, label], i) => {
          const isDone = !!done[key];
          const isNext = i === firstOpen;
          return (
            <li key={key} className="flex items-center gap-1">
              {i > 0 && <span className={`h-px w-4 ${isDone ? "bg-accent" : "bg-line"}`} aria-hidden />}
              <span
                className={`mono flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.75rem] ${
                  isDone ? "border-accent/50 bg-accent-soft text-accent" : isNext ? "border-fg/40 text-fg" : "border-line text-muted"
                }`}
              >
                <span aria-hidden>{isDone ? "✓" : i + 1}</span>
                {label}
                <span className="sr-only">{isDone ? "(done)" : isNext ? "(next)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="ml-auto flex items-center gap-3 lg:ml-0">
        <div className="flex items-baseline gap-1.5" aria-label="Event timer">
          <span className={`mono text-base font-semibold tabular-nums ${clockTone}`}>{clock}</span>
          {clockLabel && <span className="label">{clockLabel}</span>}
        </div>
        <UsageBar pctLeft={team.usage.pctLeft} blocked={team.usage.blocked && team.usage.reason === "cap"} />
        <button className="btn btn-ghost btn-sm relative !px-2" onClick={onBell} aria-label={unread ? `Announcements, ${unread} new` : "Announcements"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
          </svg>
          {unread > 0 && (
            <span className="mono absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[0.65rem] font-bold text-bg">{unread}</span>
          )}
        </button>
        <ThemeToggle />
        <button className={`btn btn-sm ${sync.submission ? "" : "btn-primary"}`} onClick={onSubmit}>
          {sync.submission ? "Submitted ✓" : "Submit"}
        </button>
      </div>
    </header>
  );
}
