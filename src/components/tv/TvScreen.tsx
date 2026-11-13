"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Confetti } from "@/components/ui";
import { ApiError, api, chime, timeOfDay, useNow, usePoll } from "@/lib/client";
import type { Phase } from "@/lib/types";
import { DoneMode, HackingMode, JudgingMode, LobbyMode, WinnersMode } from "./modes";
import { TvLogo, u } from "./parts";
import type { TvAnnouncement, TvData } from "./types";

const TAKEOVER_MS = 20_000;

const subscribeNever = () => () => {};

const PHASE_LABEL: Record<Phase, string> = {
  lobby: "Join now",
  hacking: "Hacking",
  judging: "Judging",
  winners: "Winners",
  done: "Done",
};

function PhasePill({ phase }: { phase: Phase }) {
  const tone =
    phase === "hacking" || phase === "winners"
      ? "border-accent bg-accent-soft text-accent"
      : phase === "judging"
        ? "border-amber bg-amber-soft text-amber"
        : "border-line bg-panel text-fg";
  return (
    <span
      className={`mono flex items-center border font-semibold uppercase ${tone}`}
      style={{ fontSize: u(1.3), letterSpacing: "0.14em", gap: u(0.7), padding: `${u(0.35)} ${u(1.3)}`, borderRadius: u(3) }}
    >
      {phase === "hacking" ? <span className="pulse-dot" style={{ width: u(0.8), height: u(0.8) }} aria-hidden /> : null}
      {PHASE_LABEL[phase] || phase}
    </span>
  );
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-bg text-center text-fg" style={{ padding: u(6), gap: u(1.4) }}>
      <TvLogo size={2.4} />
      <div className="font-semibold" style={{ fontSize: u(3.2), marginTop: u(1.5) }}>
        {title}
      </div>
      {body ? (
        <div className="text-muted" style={{ fontSize: u(2.2) }}>
          {body}
        </div>
      ) : null}
    </div>
  );
}

function Takeover({ announcement }: { announcement: TvAnnouncement }) {
  const urgent = announcement.urgent;
  const len = announcement.body.length;
  const size = len <= 40 ? 7 : len <= 90 ? 5.4 : len <= 180 ? 4 : len <= 320 ? 3 : 2.3;
  return (
    <div className="fade-in fixed inset-0 z-50 flex bg-bg" style={{ padding: u(3) }} role="alert">
      <div
        className={`pop-in flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden border text-center ${urgent ? "border-red bg-red-soft" : "border-line bg-panel"}`}
        style={{ borderRadius: u(2), padding: u(5), gap: u(2.4) }}
      >
        <div className={`mono font-semibold uppercase ${urgent ? "text-red" : "text-accent"}`} style={{ fontSize: u(2.2), letterSpacing: "0.2em" }}>
          {urgent ? "Important" : "Announcement"}
        </div>
        <p className="whitespace-pre-wrap font-semibold [overflow-wrap:anywhere]" style={{ fontSize: u(size), lineHeight: 1.15, maxWidth: u(84) }}>
          {announcement.body}
        </p>
      </div>
    </div>
  );
}

export default function TvScreen({ tvKey }: { tvKey: string }) {
  const [data, setData] = useState<TvData | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [offset, setOffset] = useState(0);
  const [lastOk, setLastOk] = useState(0);
  const [takeover, setTakeover] = useState<TvAnnouncement | null>(null);
  const [burst, setBurst] = useState(0);
  const [sound, setSound] = useState(false);

  const offsetRef = useRef<number | null>(null);
  const lastAnnouncement = useRef<number | null>(null);
  const takeoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRevealed = useRef(false);

  const host = useSyncExternalStore(subscribeNever, () => window.location.host, () => "");
  const origin = useSyncExternalStore(subscribeNever, () => window.location.origin, () => "");
  const now = useNow(offset);

  // The big screen is always dark, whatever theme this browser used before.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "dark");
    return () => {
      if (before) root.setAttribute("data-theme", before);
    };
  }, []);

  // Browsers only allow sound after someone has clicked or pressed a key on the page.
  useEffect(() => {
    const on = () => {
      setSound(true);
      chime();
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
    window.addEventListener("pointerdown", on);
    window.addEventListener("keydown", on);
    return () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
  }, []);

  useEffect(
    () => () => {
      if (takeoverTimer.current) clearTimeout(takeoverTimer.current);
    },
    []
  );

  const load = useCallback(async () => {
    const sent = Date.now();
    let next: TvData;
    try {
      next = await api<TvData>(`/api/tv?key=${encodeURIComponent(tvKey)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setInvalid(true);
      return;
    }
    const got = Date.now();

    // Line the countdown up with the server clock. Small wobbles between polls are ignored.
    const measured = next.now - (sent + got) / 2;
    if (offsetRef.current == null || Math.abs(measured - offsetRef.current) > 500) {
      offsetRef.current = measured;
      setOffset(Math.round(measured));
    }

    setInvalid(false);
    setData(next);
    setLastOk(got);

    // A new announcement takes over the whole screen for a moment. The one already there on first load does not.
    const id = next.announcement?.id ?? 0;
    if (lastAnnouncement.current == null) {
      lastAnnouncement.current = id;
    } else if (next.announcement && id > lastAnnouncement.current) {
      lastAnnouncement.current = id;
      chime(next.announcement.urgent);
      setTakeover(next.announcement);
      if (takeoverTimer.current) clearTimeout(takeoverTimer.current);
      takeoverTimer.current = setTimeout(() => setTakeover(null), TAKEOVER_MS);
    }

    // Confetti fires once, at the moment first place is revealed.
    const revealed = next.event.phase === "winners" && next.event.podiumStep >= 3 && !!next.event.podium?.some((p) => p.place === 1);
    if (revealed && !firstRevealed.current) setBurst((b) => b + 1);
    firstRevealed.current = revealed;
  }, [tvKey]);

  usePoll(load, 2000, !!tvKey);

  if (!tvKey || invalid) return <Message title="This screen link is not valid." body="Ask an officer for the TV link." />;
  if (!data) return <Message title="Getting the big screen ready" />;

  const phase = data.event.phase;
  const props = { data, now, host, origin };
  // If an officer deletes the announcement, the takeover goes away with it.
  const showTakeover = takeover && data.announcement?.id === takeover.id ? takeover : null;
  const stale = lastOk > 0 && now - offset - lastOk > 9000;

  return (
    <div className={`flex h-screen w-screen flex-col overflow-hidden bg-bg text-fg ${sound ? "cursor-none" : ""}`} style={{ padding: `${u(1.8)} ${u(2.5)}`, gap: u(1.6) }}>
      <header className="flex shrink-0 items-center justify-between" style={{ gap: u(2) }}>
        <div className="flex min-w-0 items-baseline" style={{ gap: u(1.8) }}>
          <TvLogo />
          <span className="truncate text-muted" style={{ fontSize: u(1.6) }}>
            {data.event.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center" style={{ gap: u(1.6) }}>
          {stale ? (
            <span className="mono text-amber" style={{ fontSize: u(1.1) }}>
              Reconnecting
            </span>
          ) : null}
          <span className="mono text-muted" style={{ fontSize: u(1.6) }}>
            {timeOfDay(now)}
          </span>
          <PhasePill phase={phase} />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {phase === "lobby" ? (
          <LobbyMode {...props} />
        ) : phase === "hacking" ? (
          <HackingMode {...props} />
        ) : phase === "judging" ? (
          <JudgingMode {...props} />
        ) : phase === "winners" ? (
          <WinnersMode {...props} />
        ) : (
          <DoneMode {...props} />
        )}
      </main>

      {showTakeover ? <Takeover key={showTakeover.id} announcement={showTakeover} /> : null}
      <Confetti burst={burst} big />

      {sound ? null : (
        <div className="mono fixed z-[70] text-muted opacity-70" style={{ right: u(1), bottom: u(0.5), fontSize: u(0.85) }}>
          Click once to turn on sound
        </div>
      )}
    </div>
  );
}
