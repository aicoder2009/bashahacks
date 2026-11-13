"use client";
import Podium from "@/components/Podium";
import { fmtClock } from "@/lib/text";
import { AnnouncementStrip, Counts, JoinBar, QrTile, Schedule, TeamCloud, plural, u } from "./parts";
import type { ModeProps } from "./types";

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
