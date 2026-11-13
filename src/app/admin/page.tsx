"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { ErrorNote, Logo, ThemeToggle } from "@/components/ui";
import { AiTab } from "@/components/admin/AiTab";
import { AnnounceTab } from "@/components/admin/Announce";
import { EventTab } from "@/components/admin/EventTab";
import { JudgingTab } from "@/components/admin/JudgingTab";
import { OverviewTab, WarnIcon, clockFor, warningsFor } from "@/components/admin/Overview";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { TeamsTab } from "@/components/admin/TeamsTab";
import { AdminProvider, TABS, phaseLabel, useAdmin, useClock, type Act, type AdminContext, type TabId, type ToastKind } from "@/components/admin/shared";
import { ApiError, api, usePoll } from "@/lib/client";
import type { AdminState } from "@/lib/admin";

type ToastItem = { id: number; kind: ToastKind; text: string };

const TOAST_WORD: Record<ToastKind, string> = { ok: "Done", warn: "Note", error: "Problem" };
const TOAST_TONE: Record<ToastKind, string> = { ok: "text-accent", warn: "text-amber", error: "text-red" };

function Login({ onDone }: { onDone: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/login", { passcode });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <form className="card space-y-4 p-6" onSubmit={submit}>
          <div>
            <h1 className="text-xl font-semibold">Officer login</h1>
            <p className="mt-1 text-sm text-muted">This page runs the event. Students do not need it.</p>
          </div>
          <label className="block">
            <span className="label mb-1 block">Admin passcode</span>
            <input
              className="input mono"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" className="btn btn-primary w-full" disabled={!passcode.trim() || busy}>
            {busy ? "Checking" : "Log in"}
          </button>
        </form>
      </div>
    </main>
  );
}

/** The small phase and countdown readout in the header, visible from every tab. */
function HeaderClock() {
  const { state } = useAdmin();
  const { settings } = state;
  const clock = clockFor(settings, useClock());
  const paused = settings.phase === "hacking" && settings.pausedRemainingMs != null;
  return (
    <div className="flex items-center gap-2">
      <span className={`pill ${settings.phase === "hacking" ? (paused ? "pill-amber" : "pill-green") : ""}`}>
        {phaseLabel(settings.phase).toUpperCase()}
        {paused ? " (PAUSED)" : ""}
      </span>
      {settings.phase === "hacking" || settings.phase === "lobby" ? (
        <span className="mono text-sm tabular-nums" title={clock.caption}>
          {clock.value}
        </span>
      ) : null}
    </div>
  );
}

function Toasts({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="card fade-in pointer-events-auto flex items-start gap-3 px-3 py-2.5 text-sm">
          <span className={`mono mt-px shrink-0 text-xs font-semibold uppercase tracking-wider ${TOAST_TONE[t.kind]}`}>{TOAST_WORD[t.kind]}</span>
          <span className="min-w-0 flex-1 break-words">{t.text}</span>
          <button className="btn btn-ghost btn-sm !h-6 shrink-0 !px-1" onClick={() => dismiss(t.id)} aria-label="Dismiss message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ tab, loadError }: { tab: TabId; loadError: string }) {
  const { state, go } = useAdmin();
  const warnings = warningsFor(state).length;
  const badge: Partial<Record<TabId, string>> = {
    teams: String(state.counts.teams),
    announce: String(state.announcements.length),
    judging: String(state.judges.length),
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <Logo />
        <span className="pill">Admin</span>
        <span className="hidden min-w-0 truncate text-sm text-muted min-[700px]:inline">{state.settings.eventName}</span>
        <div className="ml-auto flex items-center gap-3">
          <HeaderClock />
          <ThemeToggle />
        </div>
      </header>

      {loadError ? (
        <div role="alert" className="border-b border-red/40 bg-red-soft px-4 py-2 text-sm text-red">
          Live updates stopped: {loadError} Trying again every few seconds.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col min-[900px]:flex-row">
        <nav aria-label="Admin sections" className="shrink-0 border-b border-line bg-panel min-[900px]:w-44 min-[900px]:border-b-0 min-[900px]:border-r">
          <ul className="flex gap-1 overflow-x-auto p-2 min-[900px]:flex-col min-[900px]:overflow-visible">
            {TABS.map((t) => {
              const current = t.id === tab;
              return (
                <li key={t.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(t.id)}
                    aria-current={current ? "page" : undefined}
                    className={`flex h-9 w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg border px-3 text-left text-sm font-medium transition-colors ${
                      current ? "border-line bg-panel2 text-fg" : "border-transparent text-muted hover:bg-panel2 hover:text-fg"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-3.5 w-0.5 rounded-full ${current ? "bg-accent" : "bg-transparent"}`} aria-hidden />
                      {t.label}
                    </span>
                    {t.id === "overview" && warnings > 0 ? (
                      <span className="mono inline-flex items-center text-xs text-amber">
                        <WarnIcon />
                        {warnings}
                        <span className="sr-only"> things to check</span>
                      </span>
                    ) : badge[t.id] ? (
                      <span className="mono text-xs text-muted">{badge[t.id]}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-[1120px]">
            <h1 className="sr-only">{TABS.find((t) => t.id === tab)?.label}</h1>
            {/* Every tab stays mounted, so half-typed text survives a trip to another tab. */}
            <div hidden={tab !== "overview"}>
              <OverviewTab />
            </div>
            <div hidden={tab !== "event"}>
              <EventTab />
            </div>
            <div hidden={tab !== "announce"}>
              <AnnounceTab />
            </div>
            <div hidden={tab !== "teams"}>
              <TeamsTab />
            </div>
            <div hidden={tab !== "ai"}>
              <AiTab />
            </div>
            <div hidden={tab !== "judging"}>
              <JudgingTab />
            </div>
            <div hidden={tab !== "settings"}>
              <SettingsTab />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [state, setState] = useState<AdminState | null>(null);
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  const [offset, setOffset] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<TabId>("overview");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const started = useRef(0);
  const applied = useRef(0);
  const lastJson = useRef("");

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (kind: ToastKind, text: string) => {
      toastId.current += 1;
      const id = toastId.current;
      setToasts((list) => [...list.slice(-3), { id, kind, text }]);
      window.setTimeout(() => dismiss(id), kind === "ok" ? 3500 : 9000);
    },
    [dismiss]
  );

  const load = useCallback(async () => {
    started.current += 1;
    const mine = started.current;
    try {
      const data = await api<AdminState>("/api/admin/state");
      // A slow answer must never replace a newer one that already arrived.
      if (mine < applied.current) return;
      applied.current = mine;
      const next = data.now - Date.now();
      setOffset((prev) => (Math.abs(prev - next) > 400 ? next : prev));
      // Skip the redraw when nothing changed since the last poll.
      const text = JSON.stringify({ ...data, now: 0 });
      if (text !== lastJson.current) {
        lastJson.current = text;
        setState(data);
      }
      setAuth("in");
      setLoadError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        lastJson.current = "";
        setState(null);
        setAuth("out");
      } else {
        setLoadError(e instanceof Error ? e.message : "Could not load the dashboard.");
      }
    }
  }, []);

  usePoll(load, 3000, auth !== "out");

  const act = useCallback(
    async (action: string, payload: Record<string, unknown> = {}, opts: { success?: string } = {}) => {
      try {
        const out = await api<Record<string, unknown>>("/api/admin/action", { action, ...payload });
        await load();
        const success = opts.success ?? "Done.";
        if (success) toast("ok", success);
        if (typeof out.warning === "string" && out.warning) toast("warn", out.warning);
        return out;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          lastJson.current = "";
          setState(null);
          setAuth("out");
          return null;
        }
        toast("error", e instanceof Error ? e.message : "Something went wrong. Try again.");
        return null;
      }
    },
    [load, toast]
  ) as Act;

  const go = useCallback((next: TabId) => setTab(next), []);
  const loggedOut = useCallback(() => {
    lastJson.current = "";
    setState(null);
    setToasts([]);
    setAuth("out");
  }, []);

  const ctx = useMemo<AdminContext | null>(
    () => (state ? { state, offset, act, toast, go, loggedOut } : null),
    [state, offset, act, toast, go, loggedOut]
  );

  if (auth === "out") return <Login onDone={() => setAuth("checking")} />;

  if (!ctx) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
        <Logo size="lg" />
        {loadError ? (
          <div className="max-w-sm">
            <ErrorNote>{loadError} Trying again every few seconds.</ErrorNote>
          </div>
        ) : (
          <p className="mono text-sm text-muted">Loading the dashboard</p>
        )}
      </main>
    );
  }

  return (
    <AdminProvider value={ctx}>
      <Dashboard tab={tab} loadError={loadError} />
      <Toasts items={toasts} dismiss={dismiss} />
    </AdminProvider>
  );
}
