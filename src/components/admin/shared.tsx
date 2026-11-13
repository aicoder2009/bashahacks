"use client";
import { createContext, useCallback, useContext, useId, useState } from "react";
import { useNow } from "@/lib/client";
import type { AdminState } from "@/lib/admin";
import type { Phase } from "@/lib/types";

export type TabId = "overview" | "event" | "announce" | "teams" | "ai" | "judging" | "settings";

export const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "event", label: "Event" },
  { id: "announce", label: "Announce" },
  { id: "teams", label: "Teams" },
  { id: "ai", label: "AI" },
  { id: "judging", label: "Judging" },
  { id: "settings", label: "Settings" },
];

export const PHASES: { id: Phase; label: string; help: string }[] = [
  { id: "lobby", label: "Lobby", help: "Students can join and make teams. Building is locked." },
  { id: "hacking", label: "Building", help: "Building is open and the timer is running." },
  { id: "judging", label: "Judging", help: "Building is closed. Judges score the apps." },
  { id: "winners", label: "Winners", help: "The TV shows the winners reveal." },
  { id: "done", label: "Done", help: "The event is over. Published apps stay online." },
];

export const phaseLabel = (p: Phase) => PHASES.find((x) => x.id === p)?.label || p;

export type ActOptions = {
  /** Text for the success toast. Pass an empty string to stay quiet. */
  success?: string;
};

export type Act = <T = Record<string, unknown>>(action: string, payload?: Record<string, unknown>, opts?: ActOptions) => Promise<T | null>;

export type ToastKind = "ok" | "warn" | "error";

export type AdminContext = {
  state: AdminState;
  /** How far the server clock is ahead of this laptop's clock, in milliseconds. */
  offset: number;
  act: Act;
  toast: (kind: ToastKind, text: string) => void;
  go: (tab: TabId) => void;
  loggedOut: () => void;
};

const Ctx = createContext<AdminContext | null>(null);
export const AdminProvider = Ctx.Provider;

export function useAdmin(): AdminContext {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAdmin must be used inside the admin page");
  return value;
}

/** The current time on the server clock, ticking twice a second. Only clocks should use this. */
export function useClock(): number {
  return useNow(useAdmin().offset);
}

/** Runs one async job at a time and reports whether it is still going. */
export function useBusy(): [boolean, (job: () => Promise<unknown>) => Promise<void>] {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (job: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

/**
 * A form value that starts from the server and stays with whatever the officer typed until it is
 * saved or reset, so the 3 second refresh never overwrites a field someone is typing in.
 */
export function useDraft<T>(server: T): { value: T; set: (v: T) => void; dirty: boolean; reset: () => void } {
  const [draft, setDraft] = useState<{ v: T } | null>(null);
  const reset = useCallback(() => setDraft(null), []);
  const set = useCallback((v: T) => setDraft({ v }), []);
  return { value: draft ? draft.v : server, set, dirty: draft != null, reset };
}

export const usd = (n: number) => "$" + (Number.isFinite(n) ? n : 0).toFixed(2);

export function Section({
  title,
  hint,
  actions,
  children,
  className = "",
}: {
  title: string;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[0.95rem] font-semibold">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A labelled control. The label wraps the control, so every input has a name for screen readers. */
export function Field({ label, hint, children, className = "" }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label mb-1 block">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <label htmlFor={id} className={`relative mt-0.5 inline-flex shrink-0 items-center ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className="h-5 w-9 rounded-full border border-line bg-panel2 transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
        />
        <span
          aria-hidden
          className="absolute left-[3px] h-3.5 w-3.5 rounded-full bg-muted transition-transform peer-checked:translate-x-4 peer-checked:bg-accent-fg"
        />
      </label>
      <div className="min-w-0 text-sm">
        <label htmlFor={id} className="font-medium">
          {label} <span className="mono text-xs text-muted">({checked ? "on" : "off"})</span>
        </label>
        {hint ? <p className="text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card min-w-0 px-4 py-3">
      <div className="label">{label}</div>
      <div className="mono mt-1 truncate text-2xl font-semibold leading-tight">{value}</div>
      {sub ? <div className="mt-0.5 truncate text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

/** A Stat with a half-circle gauge. `ratio` is 0 to 1; `warn` turns it amber past 80% and red when full. */
export function GaugeStat({ label, value, sub, ratio, warn = false }: { label: string; value: React.ReactNode; sub?: React.ReactNode; ratio: number; warn?: boolean }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const tone = warn && pct >= 0.999 ? "text-red" : warn && pct > 0.8 ? "text-amber" : "text-accent";
  const arc = "M 6 34 A 28 28 0 0 1 62 34";
  return (
    <div className="card relative min-w-0 px-4 py-3">
      <div className="label pr-12">{label}</div>
      <div className="mono mt-1 truncate pr-12 text-2xl font-semibold leading-tight">{value}</div>
      {sub ? <div className="mt-0.5 truncate text-xs text-muted">{sub}</div> : null}
      <svg
        viewBox="0 0 68 40"
        className="absolute right-3 top-3 w-12"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
      >
        <path d={arc} pathLength={100} fill="none" strokeWidth={6} strokeLinecap="round" className="stroke-line" />
        {pct > 0 ? (
          <path d={arc} pathLength={100} fill="none" strokeWidth={6} strokeLinecap="round" stroke="currentColor" strokeDasharray={`${pct * 100} 100`} className={`${tone} transition-[stroke-dasharray] duration-500`} />
        ) : null}
        <text x={34} y={36} textAnchor="middle" className="mono fill-muted" fontSize={10}>
          {Math.round(pct * 100)}%
        </text>
      </svg>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/** Turns a timestamp into the value a datetime-local input expects, in the browser's own time zone. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function dayAndTime(ms: number): string {
  return new Date(ms).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
