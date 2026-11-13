"use client";
import { timeOfDay } from "@/lib/client";
import { fmtClock } from "@/lib/text";
import type { AdminState } from "@/lib/admin";
import { Composer } from "./Announce";
import { Section, Stat, phaseLabel, useAdmin, useBusy, useClock, usd, type TabId } from "./shared";

type Warning = { key: string; text: string; tab: TabId; fix: string };

export function warningsFor(state: AdminState): Warning[] {
  const { ai, settings } = state;
  const out: Warning[] = [];
  if (ai.mockMode) {
    out.push({ key: "mock", text: "The AI is in practice mode. Students get a pretend AI that always builds the same sample app.", tab: "ai", fix: "Open AI" });
  } else {
    if (!ai.hasManagementKey) {
      out.push({ key: "mgmt", text: "No OpenRouter management key is set on the server, so teams cannot get their own capped keys.", tab: "ai", fix: "Open AI" });
    }
    if (!ai.hasBackupKey) {
      out.push({ key: "backup", text: "No backup key is set on the server. If a team key fails, that team has nothing to fall back on.", tab: "ai", fix: "Open AI" });
    }
    if (ai.hasManagementKey && ai.poolFree === 0) {
      out.push({ key: "pool", text: "The key pool is empty. New teams will share the backup key until you prepare more team keys.", tab: "ai", fix: "Prepare keys" });
    }
  }
  if (settings.totalBudgetUsd > 0 && ai.totalSpent > settings.totalBudgetUsd * 0.8) {
    const pct = Math.round((ai.totalSpent / settings.totalBudgetUsd) * 100);
    out.push({ key: "spend", text: `AI spend is at ${pct}% of the budget (${usd(ai.totalSpent)} of ${usd(settings.totalBudgetUsd)}).`, tab: "ai", fix: "Open AI" });
  }
  // Limits are ceilings, so handing out more than the budget is allowed, but officers should know:
  // if every team used its full limit, the event-wide stop would pause AI for everyone first.
  const promised = state.teams.reduce((sum, t) => sum + Math.max(0, t.capUsd - t.spentUsd), 0);
  if (!ai.mockMode && state.teams.length > 0 && promised > ai.budgetLeft + 0.005) {
    out.push({
      key: "promised",
      text: `Teams could still use up to ${usd(promised)} between them, but the event budget has ${usd(ai.budgetLeft)} left. Lower the starting amount for new teams, or switch to a cheaper model if spending climbs.`,
      tab: "ai",
      fix: "Open AI",
    });
  }
  if (ai.teamsOnBackup > 0) {
    out.push({
      key: "onbackup",
      text: ai.teamsOnBackup === 1 ? "1 team is using the shared backup key." : `${ai.teamsOnBackup} teams are using the shared backup key.`,
      tab: "teams",
      fix: "See teams",
    });
  }
  if (settings.aiPausedAll) {
    out.push({ key: "paused", text: "AI is paused for everyone right now.", tab: "ai", fix: "Open AI" });
  }
  return out;
}

export function clockFor(settings: AdminState["settings"], now: number): { caption: string; value: string } {
  if (settings.phase === "hacking") {
    if (settings.pausedRemainingMs != null) return { caption: "Timer paused", value: fmtClock(settings.pausedRemainingMs) };
    return { caption: `Ends ${timeOfDay(settings.endsAt)}`, value: fmtClock(settings.endsAt - now) };
  }
  if (settings.phase === "lobby") {
    if (now < settings.startsAt) return { caption: `Starts ${timeOfDay(settings.startsAt)}`, value: fmtClock(settings.startsAt - now) };
    return { caption: "Start time has passed", value: fmtClock(0) };
  }
  return { caption: "Building is closed", value: fmtClock(0) };
}

export function WarnIcon() {
  return (
    <svg
      className="mr-2 inline-block align-[-2px] text-amber"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3L2 20h20L12 3z" />
      <path d="M12 10v4M12 17.2v.1" />
    </svg>
  );
}

/** The big countdown. It is its own component so the twice-a-second tick redraws nothing else. */
function BigClock() {
  const { state } = useAdmin();
  const clock = clockFor(state.settings, useClock());
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-sm text-muted">{clock.caption}</span>
      <span className="mono text-4xl font-semibold tabular-nums leading-none" role="timer" aria-label={`${clock.caption}, ${clock.value}`}>
        {clock.value}
      </span>
    </div>
  );
}

export function OverviewTab() {
  const { state, act, go } = useAdmin();
  const { settings, counts, ai } = state;
  const [busy, run] = useBusy();
  const paused = settings.pausedRemainingMs != null;
  const warnings = warningsFor(state);

  const closeSubmissions = () => {
    if (!window.confirm("Close submissions now? Building stops for everyone and judging opens.")) return;
    run(() => act("setPhase", { phase: "judging" }, { success: "Submissions are closed. Judging is open." }));
  };

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label">Phase</span>
            <span className={`pill ${settings.phase === "hacking" ? (paused ? "pill-amber" : "pill-green") : ""}`}>
              {settings.phase === "hacking" && !paused ? <span className="pulse-dot" aria-hidden /> : null}
              {phaseLabel(settings.phase).toUpperCase()}
              {settings.phase === "hacking" && paused ? " (PAUSED)" : ""}
            </span>
          </div>
          <BigClock />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {settings.phase === "lobby" ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => act("setPhase", { phase: "hacking" }, { success: "Building is open." }))}>
              Start building now
            </button>
          ) : null}
          {settings.phase === "hacking" ? (
            <>
              {paused ? (
                <button className="btn btn-primary" disabled={busy} onClick={() => run(() => act("resume", {}, { success: "Timer is running again." }))}>
                  Resume
                </button>
              ) : (
                <button className="btn" disabled={busy} onClick={() => run(() => act("pause", {}, { success: "Timer paused." }))}>
                  Pause
                </button>
              )}
              <button className="btn" disabled={busy} onClick={() => run(() => act("addTime", { minutes: 5 }, { success: "Added 5 minutes." }))}>
                +5 min
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={closeSubmissions}>
                Close submissions
              </button>
            </>
          ) : null}
          {settings.phase === "judging" ? (
            <>
              <button className="btn" disabled={busy} onClick={() => run(() => act("addTime", { minutes: 5 }, { success: "Building is open again for 5 minutes." }))}>
                Reopen building for 5 min
              </button>
              <button className="btn btn-primary" onClick={() => go("judging")}>
                Go to judging
              </button>
            </>
          ) : null}
          {settings.phase === "winners" || settings.phase === "done" ? (
            <button className="btn" onClick={() => go("judging")}>
              Go to winners controls
            </button>
          ) : null}
          <button className="btn btn-ghost" onClick={() => go("event")}>
            More event controls
          </button>
        </div>

        {settings.phase === "lobby" ? (
          <p className="mt-3 text-sm text-muted">
            {settings.autoStart
              ? `Auto start is on. Building opens by itself at ${timeOfDay(settings.startsAt)}.`
              : "Auto start is off. Building opens only when you press Start building now."}
          </p>
        ) : null}
        {settings.phase === "hacking" && !paused ? (
          <p className="mt-3 text-sm text-muted">
            {settings.autoEnd ? "Auto end is on. Submissions close by themselves when the timer hits zero." : "Auto end is off. Submissions stay open until you close them."}
          </p>
        ) : null}
      </section>

      {warnings.length > 0 ? (
        <section className="rounded-[10px] border border-amber/40 bg-amber-soft px-4 py-3" aria-label="Things to check">
          <div className="label mb-1.5 !text-amber">
            Check these ({warnings.length})
          </div>
          <ul className="space-y-1.5">
            {warnings.map((w) => (
              <li key={w.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                <span className="min-w-0">
                  <WarnIcon />
                  {w.text}
                </span>
                <button className="btn btn-sm shrink-0" onClick={() => go(w.tab)}>
                  {w.fix}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-3 min-[1100px]:grid-cols-5">
        <Stat label="Students" value={counts.students} />
        <Stat label="Teams" value={counts.teams} />
        <Stat label="Published" value={counts.published} sub={`of ${counts.teams} teams`} />
        <Stat label="Submitted" value={counts.submitted} sub={`of ${counts.teams} teams`} />
        <Stat label="AI spent" value={usd(ai.totalSpent)} sub={`of ${usd(settings.totalBudgetUsd)} budget`} />
      </div>

      <Section title="Send announcement" hint="Students get a pop-up with a chime, and it shows on the TV.">
        <Composer rows={2} />
      </Section>
    </div>
  );
}
