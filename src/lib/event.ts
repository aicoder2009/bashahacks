import { q, q1 } from "./db";
import { randomCode, randomDigits, randomId } from "./ids";
import type { EventSettings, PublicEvent } from "./types";

// Saturday Nov 14 2026, Arizona time (UTC-7, no daylight saving).
const DEFAULT_START = Date.UTC(2026, 10, 14, 16, 30); // 9:30 AM
const DEFAULT_END = Date.UTC(2026, 10, 14, 20, 0); // 1:00 PM

function defaults(): EventSettings {
  return {
    eventName: "DevOps Basha Hacks",
    phase: "lobby",
    startsAt: DEFAULT_START,
    endsAt: DEFAULT_END,
    autoStart: true,
    autoEnd: true,
    pausedRemainingMs: null,
    eventCode: randomCode(4) + randomDigits(2),
    judgeCode: "JUDGE-" + randomCode(5),
    tvKey: randomId(10),
    teamsAllowed: true,
    maxTeamSize: 3,
    model: "",
    reasoningEffort: "high",
    defaultCapUsd: 4,
    totalBudgetUsd: 50,
    aiPausedAll: false,
    schedule: [
      { time: "9:00", label: "Welcome and intro" },
      { time: "9:30", label: "Building starts" },
      { time: "12:00", label: "Lunch, keep building" },
      { time: "1:00", label: "Submissions close, presentations" },
      { time: "1:40", label: "Winners" },
      { time: "2:00", label: "Done" },
    ],
    podium: null,
    podiumStep: 0,
    presentingTeamId: null,
  };
}

const g = globalThis as unknown as { __bhSettings?: { at: number; value: EventSettings } };
const CACHE_MS = 1000;

async function load(): Promise<EventSettings> {
  let row = await q1<{ value: Partial<EventSettings> }>("SELECT value FROM settings WHERE key='event'");
  if (!row) {
    await q("INSERT INTO settings (key, value) VALUES ('event', $1::jsonb) ON CONFLICT (key) DO NOTHING", [
      JSON.stringify(defaults()),
    ]);
    row = await q1<{ value: Partial<EventSettings> }>("SELECT value FROM settings WHERE key='event'");
  }
  return { ...defaults(), ...(row?.value || {}) } as EventSettings;
}

export async function getSettings(fresh = false): Promise<EventSettings> {
  const t = Date.now();
  if (!fresh && g.__bhSettings && t - g.__bhSettings.at < CACHE_MS) return g.__bhSettings.value;
  let s = await load();

  // The timer moves the event along on its own, so nobody has to press a button at the exact minute.
  if (s.phase === "lobby" && s.autoStart && t >= s.startsAt && t < s.endsAt) {
    await q(
      `UPDATE settings SET value = value || '{"phase":"hacking","pausedRemainingMs":null}'::jsonb
       WHERE key='event' AND value->>'phase'='lobby'`
    );
    s = await load();
  } else if (s.phase === "hacking" && s.autoEnd && s.pausedRemainingMs == null && t >= s.endsAt) {
    await q(
      `UPDATE settings SET value = value || '{"phase":"judging"}'::jsonb
       WHERE key='event' AND value->>'phase'='hacking'`
    );
    s = await load();
  }
  g.__bhSettings = { at: t, value: s };
  return s;
}

export async function updateSettings(patch: Partial<EventSettings>): Promise<EventSettings> {
  await getSettings(true);
  await q("UPDATE settings SET value = value || $1::jsonb WHERE key='event'", [JSON.stringify(patch)]);
  g.__bhSettings = undefined;
  return getSettings(true);
}

export function publicEvent(s: EventSettings): PublicEvent {
  return {
    name: s.eventName,
    phase: s.phase,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    pausedRemainingMs: s.pausedRemainingMs,
    teamsAllowed: s.teamsAllowed,
    schedule: s.schedule,
  };
}

export function remainingMs(s: { endsAt: number; pausedRemainingMs: number | null }, at = Date.now()): number {
  if (s.pausedRemainingMs != null) return Math.max(0, s.pausedRemainingMs);
  return Math.max(0, s.endsAt - at);
}

// Total AI spend across every team and test call, cached briefly.
const gs = globalThis as unknown as { __bhSpend?: { at: number; value: number } };
export async function totalSpend(fresh = false): Promise<number> {
  const t = Date.now();
  if (!fresh && gs.__bhSpend && t - gs.__bhSpend.at < 4000) return gs.__bhSpend.value;
  const row = await q1<{ total: number }>("SELECT COALESCE(SUM(cost),0)::double precision AS total FROM usage_log");
  const value = row?.total || 0;
  gs.__bhSpend = { at: t, value };
  return value;
}

/** The event-wide stop: pause AI for everyone shortly before the money runs out. */
export function eventBudgetLeft(s: EventSettings, spent: number): number {
  return Math.max(0, s.totalBudgetUsd - 1 - spent);
}

export function forgetSpendCache(): void {
  gs.__bhSpend = undefined;
}
