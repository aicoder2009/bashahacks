"use client";
import { useEffect, useState } from "react";
import AppFrame from "@/components/AppFrame";
import Podium from "@/components/Podium";
import { api } from "@/lib/client";
import { fmtClock } from "@/lib/text";
import type { Files } from "@/lib/types";
import { AnnouncementStrip, Counts, JoinBar, QrTile, Schedule, TeamCloud, plural, u } from "./parts";
import type { ModeProps, TvData } from "./types";

// Width of one monospace character, as a share of the font size.
const MONO = 0.62;

/** The largest font size (in TV units) that keeps `text` on one line inside `room` units. */
function fit(text: string, room: number, max: number, spacing = 0): number {
  const need = Math.max(1, text.length) * (MONO + spacing);
  return Math.min(max, room / need);
}

function shortClock(ms: number): string {
  const clock = fmtClock(ms);
  return ms >= 3_600_000 ? clock : clock.slice(3);
}

export function LobbyMode({ data, now, host, origin }: ModeProps) {
  const { event, counts, teams } = data;
  const until = event.startsAt - now;
  const code = event.eventCode;
  return (
    <div className="flex h-full flex-col" style={{ gap: u(1.6) }}>
      <div className="flex shrink-0 items-center justify-between" style={{ gap: u(4) }}>
        <div className="min-w-0">
          <div className="text-muted" style={{ fontSize: u(1.8) }}>
            Join at
          </div>
          <div className="mono font-semibold text-accent whitespace-nowrap" style={{ fontSize: u(fit(host, 62, 4.8)), lineHeight: 1.15 }}>
            {host}
          </div>
          <div className="text-muted" style={{ fontSize: u(1.8), marginTop: u(1.2) }}>
            Event code
          </div>
          <div className="mono font-bold whitespace-nowrap" style={{ fontSize: u(fit(code, 62, 10, 0.1)), lineHeight: 1, letterSpacing: "0.1em" }}>
            {code}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center" style={{ gap: u(0.9) }}>
          <QrTile url={origin} size={u(16)} />
          <div className="text-muted" style={{ fontSize: u(1.4) }}>
            Or scan with a phone camera
          </div>
        </div>
      </div>

      <AnnouncementStrip announcement={data.announcement} />

      <div className="flex min-h-0 flex-1 flex-col border border-line bg-panel" style={{ borderRadius: u(1.2), padding: u(1.4), gap: u(1.1) }}>
        <div className="flex shrink-0 items-baseline justify-between" style={{ gap: u(2) }}>
          <div className="font-semibold" style={{ fontSize: u(1.9) }}>
            {counts.students === 0 ? "Waiting for the first builder" : `${plural(counts.students, "builder")}, ${plural(counts.teams, "team")}`}
          </div>
          <div style={{ fontSize: u(1.9) }}>
            {until > 0 ? (
              <>
                <span className="text-muted">Building starts in </span>
                <span className="mono font-bold text-accent" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {shortClock(until)}
                </span>
              </>
            ) : (
              <span className="text-muted">Building starts soon</span>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <TeamCloud teams={teams} />
        </div>
      </div>
    </div>
  );
}

function BigTimer({ ms, tone }: { ms: number; tone: string }) {
  const parts = fmtClock(ms).split(":");
  return (
    <div
      className={`mono flex items-center justify-center font-bold transition-colors duration-500 ${tone}`}
      style={{ fontSize: u(12), lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
      role="timer"
      aria-label={`${fmtClock(ms)} left`}
    >
      {parts.map((p, i) => (
        <span key={i} className="flex items-center">
          {i ? (
            <span className="opacity-40" style={{ margin: `0 ${u(0.6)}`, transform: "translateY(-6%)" }}>
              :
            </span>
          ) : null}
          <span>{p}</span>
        </span>
      ))}
    </div>
  );
}

export function HackingMode({ data, now, host, origin }: ModeProps) {
  const { event } = data;
  const paused = event.pausedRemainingMs != null;
  const left = Math.max(0, paused ? (event.pausedRemainingMs as number) : event.endsAt - now);
  const tone = left <= 60_000 ? "text-red" : left <= 600_000 ? "text-amber" : "text-fg";
  const caption = paused
    ? "The timer is paused"
    : left <= 0
      ? "Time is up"
      : left <= 60_000
        ? "Last minute, save your work"
        : left <= 600_000
          ? "Almost done, submit your app"
          : "Time left to build";
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: `minmax(0, 1fr) ${u(27)}`, gridTemplateRows: "minmax(0, 1fr) auto", gap: u(1.8) }}>
      <div className="flex min-h-0 min-w-0 flex-col items-center justify-center" style={{ gap: u(1.2) }}>
        {paused ? (
          <div className="mono border border-amber bg-amber-soft font-bold uppercase text-amber" style={{ fontSize: u(1.8), letterSpacing: "0.16em", padding: `${u(0.4)} ${u(1.6)}`, borderRadius: u(3) }}>
            Paused
          </div>
        ) : null}
        <BigTimer ms={left} tone={tone} />
        <div className={`font-medium ${tone === "text-fg" ? "text-muted" : tone}`} style={{ fontSize: u(2.3) }}>
          {caption}
        </div>
        {data.announcement ? (
          <div className="w-full" style={{ marginTop: u(1.6) }}>
            <AnnouncementStrip announcement={data.announcement} />
          </div>
        ) : null}
      </div>
      <div className="min-h-0">
        <Schedule items={event.schedule} now={now} />
      </div>
      <div className="col-span-2">
        <JoinBar host={host} origin={origin} code={event.eventCode} counts={data.counts} />
      </div>
    </div>
  );
}

export function JudgingMode({ data, now }: ModeProps) {
  const { event, counts, teams } = data;
  return (
    <div className="grid h-full" style={{ gridTemplateColumns: `minmax(0, 1fr) ${u(27)}`, gridTemplateRows: "minmax(0, 1fr) auto", gap: u(1.8) }}>
      <div className="flex min-h-0 min-w-0 flex-col justify-center" style={{ gap: u(1.6), paddingLeft: u(1) }}>
        <div>
          <h1 className="font-bold" style={{ fontSize: u(6.4), lineHeight: 1.05 }}>
            Time is up.
          </h1>
          <div className="flex items-center font-semibold text-accent" style={{ fontSize: u(3.4), gap: u(1.2), marginTop: u(0.8) }}>
            <span className="pulse-dot" style={{ width: u(1.2), height: u(1.2) }} aria-hidden />
            Judging in progress.
          </div>
          <p className="text-muted" style={{ fontSize: u(1.8), marginTop: u(1) }}>
            Judges are coming around. Get ready to show your app.
          </p>
        </div>
        <Counts counts={counts} size={1.15} />
        <AnnouncementStrip announcement={data.announcement} />
      </div>
      <div className="min-h-0">
        <Schedule items={event.schedule} now={now} />
      </div>
      <div className="col-span-2">
        <TeamCloud teams={teams} base={0.72} maxHeight="26vh" />
      </div>
    </div>
  );
}

type ShownApp = { teamId: string; files: Files };

/** One team's app, full size, while the judges score it on their phones. */
export function PresentingMode({ presenting, tvKey }: { presenting: NonNullable<TvData["presenting"]>; tvKey: string }) {
  const [app, setApp] = useState<ShownApp | null>(null);
  const teamId = presenting.teamId;
  const hasApp = presenting.hasApp;

  // The code is fetched once per team, not on every poll, so the app never reloads in the middle of a demo.
  useEffect(() => {
    if (!hasApp) return;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const go = () =>
      api<ShownApp>(`/api/tv/app?key=${encodeURIComponent(tvKey)}`)
        .then((next) => {
          if (!live) return;
          if (next.teamId === teamId) setApp(next);
          else retry = setTimeout(go, 1500);
        })
        .catch(() => {
          if (live) retry = setTimeout(go, 3000);
        });
    go();
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, [teamId, tvKey, hasApp]);

  const files = app && app.teamId === teamId ? app.files : null;
  const names = presenting.members.map((m) => m.name).join(", ");
  return (
    <div className="flex h-full flex-col" style={{ gap: u(1.2) }}>
      <div className="flex shrink-0 items-baseline justify-between" style={{ gap: u(3) }}>
        <div className="flex min-w-0 items-baseline" style={{ gap: u(1.4) }}>
          <span className="mono shrink-0 font-semibold uppercase text-accent" style={{ fontSize: u(1.3), letterSpacing: "0.16em" }}>
            Now showing
          </span>
          <h1 className="truncate font-bold" style={{ fontSize: u(3), lineHeight: 1.1 }}>
            {presenting.appTitle}
          </h1>
        </div>
        <div className="min-w-0 truncate text-muted" style={{ fontSize: u(1.8) }}>
          <span className="font-semibold text-fg">{presenting.teamName}</span>
          {names && names !== presenting.teamName ? `, ${names}` : ""}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden border border-line bg-white" style={{ borderRadius: u(1.2) }}>
        {!hasApp ? (
          // Built somewhere else: an outside site is never loaded into this page, so the team shows it themselves.
          <div className="flex h-full flex-col items-center justify-center bg-panel text-center" style={{ gap: u(1.6), padding: u(4) }}>
            <p className="font-semibold" style={{ fontSize: u(3) }}>
              This project was built outside Basha Hacks
            </p>
            <p className="text-muted" style={{ fontSize: u(2) }}>
              The team will show it to you themselves.
            </p>
            {presenting.link ? (
              <p className="mono max-w-full text-accent [overflow-wrap:anywhere]" style={{ fontSize: u(1.8) }}>
                {presenting.link}
              </p>
            ) : null}
          </div>
        ) : files ? (
          <AppFrame key={teamId} files={files} storageKey={`bh_tv_${teamId}`} title={presenting.appTitle} />
        ) : (
          <div className="flex h-full items-center justify-center bg-panel text-muted" style={{ fontSize: u(2.2) }}>
            Loading the app
          </div>
        )}
      </div>
    </div>
  );
}

const PODIUM_WIDTH = "min(86vw, 148vh)";

export function WinnersMode({ data }: ModeProps) {
  const { event } = data;
  const entries = event.podium || [];
  const step = Math.max(0, Math.min(3, Math.floor(Number(event.podiumStep) || 0)));
  const intro = step === 0;
  return (
    <div className="flex h-full flex-col items-center">
      <h1 className={`shrink-0 text-center font-bold ${intro ? "text-fg" : "text-muted"}`} style={{ fontSize: u(intro ? 5.6 : 2.6), lineHeight: 1.1, marginTop: u(intro ? 8 : 0.4), transition: "font-size 0.6s ease, margin 0.6s ease" }}>
        {intro ? "And the winners are" : "The winners"}
      </h1>
      {entries.length ? (
        <div className="min-h-0 flex-1" style={{ width: PODIUM_WIDTH }}>
          <Podium entries={entries} step={step} />
        </div>
      ) : (
        <div className="flex flex-1 items-center text-muted" style={{ fontSize: u(2.4) }}>
          The results are almost ready
        </div>
      )}
    </div>
  );
}

export function DoneMode({ data }: ModeProps) {
  const { event, counts } = data;
  const entries = event.podium || [];
  return (
    <div className="flex h-full flex-col items-center">
      <div className={`shrink-0 text-center ${entries.length ? "" : "flex flex-1 flex-col justify-center"}`} style={{ marginTop: u(entries.length ? 0.4 : 0) }}>
        <h1 className="font-bold" style={{ fontSize: u(entries.length ? 4.2 : 7), lineHeight: 1.1 }}>
          Thanks for building.
        </h1>
        <p className="text-accent" style={{ fontSize: u(entries.length ? 2.2 : 3.2), marginTop: u(0.5) }}>
          See you next time.
        </p>
        {entries.length ? null : (
          <p className="text-muted" style={{ fontSize: u(1.8), marginTop: u(2) }}>
            {plural(counts.students, "builder")}, {plural(counts.published, "app")} published
          </p>
        )}
      </div>
      {entries.length ? (
        <div className="min-h-0 flex-1" style={{ width: PODIUM_WIDTH }}>
          <Podium entries={entries} step={3} />
        </div>
      ) : null}
    </div>
  );
}
