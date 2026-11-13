"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Avatar from "@/components/Avatar";
import { timeOfDay } from "@/lib/client";
import type { ScheduleItem } from "@/lib/types";
import type { TvAnnouncement, TvData, TvTeam } from "./types";

/**
 * One TV unit. On a 16:9 screen `u(1)` is 1% of the width. On a squarer or wider screen it
 * shrinks with whichever side is tighter, so nothing falls off the edge.
 */
export const u = (x: number): string => `min(${x}vw, ${(x * 1.78).toFixed(2)}vh)`;

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function TvLogo({ size = 1.9 }: { size?: number }) {
  return (
    <span className="mono font-semibold whitespace-nowrap" style={{ fontSize: u(size) }}>
      <span className="text-accent" aria-hidden>
        &gt;{" "}
      </span>
      basha<span className="text-accent">hacks</span>
    </span>
  );
}

export function QrTile({ url, size }: { url: string; size: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!url) return;
    let stop = false;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#1a1915", light: "#ffffff" } })
      .then((d) => {
        if (!stop) setSrc(d);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [url]);
  return (
    <div className="shrink-0 overflow-hidden bg-white" style={{ width: size, height: size, borderRadius: `calc(${size} * 0.06)`, padding: `calc(${size} * 0.04)` }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR code to join" className="h-full w-full" style={{ imageRendering: "pixelated" }} />
      ) : null}
    </div>
  );
}

export function TeamChip({ team, scale = 1 }: { team: TvTeam; scale?: number }) {
  const names = team.members.map((m) => m.name);
  const title = team.solo ? names[0] || team.name : team.name;
  const avatar = u(3.2 * scale);
  return (
    <div
      className="pop-in flex min-w-0 items-center rounded-full border border-line bg-panel"
      style={{ gap: u(0.7 * scale), padding: `${u(0.45 * scale)} ${u(1.3 * scale)} ${u(0.45 * scale)} ${u(0.55 * scale)}` }}
    >
      {team.members.length ? (
        <div className="flex shrink-0">
          {team.members.map((m, i) => (
            <span key={i} className="block" style={{ width: avatar, height: avatar, marginLeft: i ? `calc(${u(0.7 * scale)} * -1)` : 0 }}>
              <Avatar spec={m.avatar} size={64} className="h-full w-full" title={m.name} />
            </span>
          ))}
        </div>
      ) : null}
      <div className="min-w-0 leading-tight" style={{ maxWidth: u(22 * scale), paddingLeft: team.members.length ? 0 : u(0.7 * scale) }}>
        <div className="truncate font-semibold" style={{ fontSize: u(1.4 * scale) }}>
          {title}
        </div>
        {!team.solo && names.length ? (
          <div className="truncate text-muted" style={{ fontSize: u(1.0 * scale) }}>
            {names.join(", ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A starting chip size for this many teams. TeamCloud then shrinks it until everyone fits. */
export function chipScale(count: number, base = 1): number {
  const s = count <= 6 ? 1.5 : count <= 10 ? 1.3 : count <= 15 ? 1.1 : count <= 20 ? 0.95 : count <= 28 ? 0.8 : count <= 36 ? 0.7 : count <= 48 ? 0.62 : 0.54;
  return s * base;
}

/** Every team as a chip. If the chips do not all fit in the box, they get smaller until they do. */
export function TeamCloud({ teams, base = 1, maxHeight }: { teams: TvTeam[]; base?: number; maxHeight?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ count: -1, scale: 1 });
  const count = teams.length;
  const scale = fit.count === count ? fit.scale : chipScale(count, base);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Fires once right away and again whenever the box changes size.
    const ro = new ResizeObserver(() => {
      if (el.scrollHeight > el.clientHeight + 1 && scale > 0.36) setFit({ count, scale: scale * 0.93 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [count, scale]);

  return (
    <div ref={ref} className="flex h-full flex-wrap content-start items-start overflow-hidden" style={{ gap: u(0.8 * scale), maxHeight }}>
      {teams.map((t) => (
        <TeamChip key={t.id} team={t} scale={scale} />
      ))}
    </div>
  );
}

function clockMinutes(text: string): number | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return null;
  const half = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (half === "pm" && h < 12) h += 12;
  else if (half === "am" && h === 12) h = 0;
  else if (!half && h >= 1 && h <= 6) h += 12; // "1:30" at a school event means the afternoon
  return h * 60 + min;
}

/** Index of the schedule item happening now, or -1 if the times cannot be read or nothing has started. */
export function currentScheduleIndex(items: ScheduleItem[], nowMs: number): number {
  const d = new Date(nowMs);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  let current = -1;
  let prev = -1;
  for (let i = 0; i < items.length; i++) {
    let t = clockMinutes(items[i].time);
    if (t == null) continue;
    if (t < prev && t + 720 < 1440) t += 720; // times only move forward through the day
    prev = t;
    if (t <= nowMin) current = i;
  }
  return current;
}

export function Schedule({ items, now }: { items: ScheduleItem[]; now: number }) {
  const current = currentScheduleIndex(items, now);
  if (!items.length) return null;
  return (
    <div className="flex h-full flex-col overflow-hidden border border-line bg-panel" style={{ borderRadius: u(1), padding: u(1.4), gap: u(0.5) }}>
      <div className="mono uppercase text-muted" style={{ fontSize: u(1.05), letterSpacing: "0.1em", paddingLeft: u(0.7), marginBottom: u(0.3) }}>
        Schedule
      </div>
      {items.map((it, i) => {
        const on = i === current;
        return (
          <div
            key={i}
            className={`flex items-baseline border ${on ? "border-accent bg-accent-soft" : "border-transparent"} ${i < current ? "text-muted" : ""}`}
            style={{ gap: u(1), padding: `${u(0.55)} ${u(0.7)}`, borderRadius: u(0.6), fontSize: u(1.35) }}
          >
            <span className={`mono shrink-0 font-semibold ${on ? "text-accent" : ""}`} style={{ minWidth: u(4.4) }}>
              {it.time}
            </span>
            <span className={`min-w-0 leading-snug ${on ? "font-semibold" : ""}`}>{it.label}</span>
            {on ? (
              <span className="mono ml-auto shrink-0 uppercase text-accent" style={{ fontSize: u(0.9), letterSpacing: "0.1em" }}>
                Now
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function Stat({ value, label, size = 1 }: { value: number; label: string; size?: number }) {
  return (
    <div className="flex items-baseline" style={{ gap: u(0.6 * size) }}>
      <span className="mono font-bold" style={{ fontSize: u(2.6 * size), lineHeight: 1 }}>
        {value}
      </span>
      <span className="text-muted" style={{ fontSize: u(1.25 * size) }}>
        {label}
      </span>
    </div>
  );
}

export function Counts({ counts, size = 1 }: { counts: TvData["counts"]; size?: number }) {
  return (
    <div className="flex flex-wrap items-baseline" style={{ columnGap: u(2.4 * size), rowGap: u(0.6 * size) }}>
      <Stat value={counts.teams} label={counts.teams === 1 ? "team" : "teams"} size={size} />
      <Stat value={counts.published} label={counts.published === 1 ? "app published" : "apps published"} size={size} />
      <Stat value={counts.submitted} label="submitted" size={size} />
    </div>
  );
}

export function AnnouncementStrip({ announcement }: { announcement: TvAnnouncement | null }) {
  if (!announcement) return null;
  const urgent = announcement.urgent;
  return (
    <div
      className={`flex w-full items-center border ${urgent ? "border-red bg-red-soft" : "border-line bg-panel"}`}
      style={{ gap: u(1.6), padding: `${u(1)} ${u(1.6)}`, borderRadius: u(1) }}
    >
      <span className={`mono shrink-0 font-semibold uppercase ${urgent ? "text-red" : "text-accent"}`} style={{ fontSize: u(1.1), letterSpacing: "0.12em" }}>
        {urgent ? "Important" : "Announcement"}
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 font-medium leading-snug" style={{ fontSize: u(1.9) }}>
        {announcement.body}
      </span>
      <span className="mono shrink-0 text-muted" style={{ fontSize: u(1.1) }}>
        {timeOfDay(announcement.createdAt)}
      </span>
    </div>
  );
}

export function JoinBar({ host, origin, code, counts }: { host: string; origin: string; code: string; counts: TvData["counts"] }) {
  return (
    <div className="flex items-center justify-between border border-line bg-panel" style={{ gap: u(2), padding: `${u(0.9)} ${u(1.6)}`, borderRadius: u(1) }}>
      <div className="flex min-w-0 items-center" style={{ gap: u(1.8) }}>
        <QrTile url={origin} size={u(5.4)} />
        <div className="flex min-w-0 items-baseline" style={{ gap: u(0.9) }}>
          <span className="text-muted" style={{ fontSize: u(1.3) }}>
            Join at
          </span>
          <span className="mono truncate font-semibold text-accent" style={{ fontSize: u(1.9) }}>
            {host}
          </span>
        </div>
        <div className="flex shrink-0 items-baseline" style={{ gap: u(0.9) }}>
          <span className="text-muted" style={{ fontSize: u(1.3) }}>
            code
          </span>
          <span className="mono font-bold" style={{ fontSize: u(2.3), letterSpacing: "0.08em" }}>
            {code}
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <Counts counts={counts} size={0.85} />
      </div>
    </div>
  );
}
