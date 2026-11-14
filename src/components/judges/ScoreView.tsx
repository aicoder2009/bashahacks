"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import AppFrame from "@/components/AppFrame";
import { ErrorNote } from "@/components/ui";
import { api } from "@/lib/client";
import type { Files } from "@/lib/types";
import { StatusPills, TeamLine } from "./ProjectList";
import { totalOf, type JudgeCriterion, type JudgeTeam, type SaveState } from "./types";

const WIDE = "(min-width: 1024px)";

function subscribeWide(cb: () => void): () => void {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** True on laptop-size screens, where the app sits next to the rubric. */
function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false
  );
}

function AppPanel({ teamId, title }: { teamId: string; title: string }) {
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Files | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const fetched = useRef(-1);
  const show = wide || open;

  // The app code is fetched once, the first time the frame is shown (and again only on Restart).
  useEffect(() => {
    if (!show || fetched.current === reload) return;
    fetched.current = reload;
    api<{ files: Files }>(`/api/judges/app?teamId=${encodeURIComponent(teamId)}`)
      .then((r) => {
        setFiles(r.files || {});
        setError("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load the app."));
  }, [show, teamId, reload]);

  const panelId = `app-panel-${teamId}`;

  return (
    <section aria-label="The app" className="card overflow-hidden lg:flex lg:h-full lg:flex-col">
      <div className="flex items-center justify-between gap-2 p-2 pl-4">
        {wide ? (
          <h2 className="label">The app</h2>
        ) : (
          <button
            type="button"
            className="-ml-2 flex min-h-12 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 text-left font-semibold"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={`transition-transform ${open ? "rotate-90" : ""}`}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
            {open ? "Hide the app" : "Open the app"}
          </button>
        )}
        {show ? (
          <button type="button" className="btn btn-sm" onClick={() => setReload((n) => n + 1)}>
            Restart
          </button>
        ) : null}
      </div>
      {show ? (
        <div id={panelId} className="h-[70vh] min-h-[420px] border-t border-line bg-white lg:h-auto lg:flex-1">
          {files ? (
            <AppFrame key={reload} files={files} storageKey={`judge_view_${teamId}`} title={`${title}, app preview`} />
          ) : (
            <div className="flex h-full items-center justify-center bg-panel p-4 text-center text-sm text-muted">
              {error ? <ErrorNote>{error}</ErrorNote> : "Loading the app"}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** A link to a project built somewhere else. It always opens in a new tab and is never loaded inside this page. */
function OutsideLink({ link, className, showAddress = false }: { link: string; className: string; showAddress?: boolean }) {
  if (!link) return null;
  return (
    <a className={className} href={link} target="_blank" rel="noopener noreferrer">
      {showAddress ? link : "Open their project"}
    </a>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  return (
    <span role="status" aria-live="polite" className="mono flex min-w-16 items-center justify-end gap-1.5 text-sm">
      {state === "saving" ? (
        <>
          <span className="pulse-dot" aria-hidden />
          <span className="text-muted">Saving</span>
        </>
      ) : state === "saved" ? (
        <span className="flex items-center gap-1 text-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Saved
        </span>
      ) : state === "error" ? (
        <span className="flex items-center gap-1 text-red">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
            <path d="M12 7v6M12 17v.5" />
          </svg>
          Not saved
        </span>
      ) : null}
    </span>
  );
}

export default function ScoreView({
  team,
  criteria,
  locked,
  index,
  total,
  save,
  saveError,
  onBack,
  onPrev,
  onNext,
  onScore,
  onComment,
}: {
  team: JudgeTeam;
  criteria: JudgeCriterion[];
  locked: boolean;
  index: number;
  total: number;
  save: SaveState;
  saveError: string;
  onBack: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onScore: (teamId: string, criterionId: number, value: number) => void;
  onComment: (teamId: string, comment: string) => Promise<boolean>;
}) {
  const teamId = team.teamId;

  // The comment box is driven only by what the judge types. Polling never writes into it.
  const [draft, setDraft] = useState(team.comment);
  const draftRef = useRef(team.comment);
  const savedRef = useRef(team.comment);
  const lockedRef = useRef(locked);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const text = draftRef.current;
    if (lockedRef.current || text === savedRef.current) return;
    const before = savedRef.current;
    savedRef.current = text;
    onComment(teamId, text).then((ok) => {
      // If it did not save, forget it so the next blur or keystroke tries again.
      if (!ok && savedRef.current === text) savedRef.current = before;
    });
  }, [teamId, onComment]);

  // Save anything unsaved when the judge moves to another project or puts the phone away.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const onType = (value: string) => {
    draftRef.current = value;
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1000);
  };

  const sum = totalOf(criteria, team.scores);
  const max = criteria.length * 5;
  const commentId = `comment-${teamId}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-3">
      <button type="button" className="btn btn-ghost -ml-2 px-2" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        All projects
      </button>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">
            Project {index + 1} of {total}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold leading-tight [overflow-wrap:anywhere]">{team.appTitle}</h1>
          <div className="mt-2">
            <TeamLine team={team} size={32} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPills team={team} criteria={criteria} />
        </div>
      </div>

      {locked ? (
        <p role="status" className="mt-4 rounded-lg border border-line bg-panel2 px-4 py-3 font-medium">
          Scores are locked. Thanks for judging.
        </p>
      ) : null}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
        {/* On a phone the rubric comes first and the app opens on request. On a laptop the app stays in view on the left. */}
        {team.hasApp ? (
          <div className="order-2 lg:sticky lg:top-4 lg:order-1 lg:h-[calc(100dvh-2rem)] lg:min-h-[480px]">
            <AppPanel teamId={teamId} title={team.appTitle} />
          </div>
        ) : (
          <section aria-label="The project" className="card order-2 p-6 text-center lg:order-1">
            <h2 className="label">The project</h2>
            <p className="mt-2 font-medium">This team built their project outside Basha Hacks.</p>
            <p className="mt-1 text-sm text-muted">Open their link to try it, or ask them to show it to you.</p>
            <OutsideLink link={team.link} className="btn btn-primary mt-4" />
          </section>
        )}

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <section aria-label="Write-up" className="card order-2 p-4 lg:order-1">
            {team.submitted ? (
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="label">The problem they noticed</h2>
                  <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{team.problem}</p>
                </div>
                <div>
                  <h2 className="label">What it is and how it helps</h2>
                  <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{team.solution}</p>
                </div>
                {team.hasApp && team.link ? (
                  <div>
                    <h2 className="label">Also built outside Basha Hacks</h2>
                    <OutsideLink link={team.link} className="mt-1 inline-block text-accent underline underline-offset-2 [overflow-wrap:anywhere]" showAddress />
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <h2 className="label">Write-up</h2>
                <p className="mt-1 text-muted">This team has not submitted a write-up yet. You can still score what they show you.</p>
              </>
            )}
          </section>

          <section aria-label="Rubric" className="order-1 flex flex-col gap-3 lg:order-2">
            <p className="text-sm text-muted">Tap a number for each one. 1 is the lowest, 5 is the best. Tap it again to clear.</p>

            {criteria.length === 0 ? (
              <p className="card p-4 text-muted">There are no judging criteria yet. Ask an officer to add them.</p>
            ) : null}

            {criteria.map((c) => {
              const value = team.scores[c.id] || 0;
              const headingId = `crit-${teamId}-${c.id}`;
              return (
                <div key={c.id} role="group" aria-labelledby={headingId} className="card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 id={headingId} className="font-semibold leading-snug">
                      {c.name}
                    </h3>
                    <span className={`mono shrink-0 text-sm ${value ? "text-fg" : "text-muted"}`}>{value ? `${value} of 5` : "Not scored"}</span>
                  </div>
                  {c.hint ? <p className="mt-0.5 text-sm text-muted">{c.hint}</p> : null}
                  {c.weight !== 1 ? <p className="mono mt-1 text-xs text-muted">Counts {c.weight}x</p> : null}
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const on = value === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={locked}
                          aria-pressed={on}
                          aria-label={`${c.name}: ${n} out of 5${on ? ", selected. Tap to clear" : ""}`}
                          onClick={() => onScore(teamId, c.id, on ? 0 : n)}
                          className={`mono h-14 cursor-pointer rounded-lg border text-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            on ? "border-accent bg-accent text-accent-fg" : "border-line bg-bg text-fg hover:bg-panel2 disabled:hover:bg-bg"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={commentId} className="font-semibold">
                  Comment <span className="font-normal text-muted">(optional)</span>
                </label>
                <span className="mono text-xs text-muted">{draft.length} of 600</span>
              </div>
              <textarea
                id={commentId}
                className="input mt-2"
                rows={3}
                maxLength={600}
                value={draft}
                disabled={locked}
                placeholder="Anything worth remembering about this project"
                onChange={(e) => onType(e.target.value)}
                onBlur={flush}
              />
            </div>

            <ErrorNote>{saveError}</ErrorNote>

            <div className="card sticky bottom-2 z-10 flex items-center justify-between gap-3 bg-panel2 px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="label">Your total</span>
                <span className="mono text-lg font-semibold">
                  {sum} of {max}
                </span>
              </div>
              <SaveBadge state={save} />
            </div>
          </section>
        </div>
      </div>

      <nav aria-label="Move between projects" className="mt-6 grid grid-cols-2 gap-2 lg:ml-auto lg:max-w-[26rem]">
        <button type="button" className="btn btn-lg px-3" disabled={!onPrev} onClick={onPrev || undefined} aria-label="Previous project">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Previous
        </button>
        <button type="button" className="btn btn-primary btn-lg px-3" disabled={!onNext} onClick={onNext || undefined} aria-label="Next project">
          Next
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" className="btn col-span-2 h-12" onClick={onBack}>
          Back to all projects
        </button>
      </nav>
    </main>
  );
}
