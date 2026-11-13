"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, api, usePoll } from "@/lib/client";
import { Logo, ThemeToggle } from "@/components/ui";
import JudgeLogin from "./JudgeLogin";
import ProjectList from "./ProjectList";
import ScoreView from "./ScoreView";
import { isComplete, type JudgeState, type JudgeTeam, type SaveState } from "./types";

function subscribeHash(cb: () => void): () => void {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
}

/** The open project lives in the URL hash, so the phone's own back button returns to the list. */
function useHash(): string {
  return useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => ""
  );
}

function setHashQuietly(hash: string): void {
  window.history.replaceState(window.history.state, "", hash ? `#${hash}` : window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function patchTeam(state: JudgeState | null, teamId: string, fn: (t: JudgeTeam) => JudgeTeam): JudgeState | null {
  if (!state) return state;
  return { ...state, teams: state.teams.map((t) => (t.teamId === teamId ? fn(t) : t)) };
}

function withScore(state: JudgeState | null, teamId: string, criterionId: number, value: number): JudgeState | null {
  if (!state) return state;
  return patchTeam(state, teamId, (t) => {
    const scores = { ...t.scores };
    if (value) scores[criterionId] = value;
    else delete scores[criterionId];
    return { ...t, scores, complete: isComplete(state.criteria, scores) };
  });
}

export default function JudgeApp() {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [data, setData] = useState<JudgeState | null>(null);
  const [offline, setOffline] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const hash = useHash();

  const dataRef = useRef<JudgeState | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Bookkeeping so a poll that started before a tap can never undo that tap.
  const edits = useRef(0); // goes up on every local change and every finished save
  const inflight = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve()); // saves go out one at a time, in order
  const latest = useRef(new Map<string, number>()); // newest tap per score
  const confirmed = useRef(new Map<string, number>()); // last value the server is known to hold
  const pushed = useRef(false);

  const signedOut = useCallback(() => {
    setAuth("out");
    setData(null);
    setSave("idle");
    setSaveError("");
  }, []);

  const load = useCallback(async () => {
    const seen = edits.current;
    try {
      const next = await api<JudgeState>("/api/judges/state");
      const keepLocal = edits.current !== seen || inflight.current > 0;
      setOffline(false);
      setAuth("in");
      setData((prev) => {
        if (!prev || !keepLocal) return next;
        // Something was edited while this request was in the air: keep what the judge sees.
        const local = new Map(prev.teams.map((t) => [t.teamId, t]));
        return {
          ...next,
          teams: next.teams.map((t) => {
            const mine = local.get(t.teamId);
            return mine ? { ...t, scores: mine.scores, comment: mine.comment, complete: isComplete(next.criteria, mine.scores) } : t;
          }),
        };
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) signedOut();
      else setOffline(true);
    }
  }, [signedOut]);

  usePoll(load, 5000, auth !== "out");

  const finish = useCallback((failed: boolean) => {
    inflight.current -= 1;
    edits.current += 1;
    setSave(failed ? "error" : inflight.current > 0 ? "saving" : "saved");
  }, []);

  const onScore = useCallback(
    (teamId: string, criterionId: number, value: number) => {
      const key = `${teamId}:${criterionId}`;
      const token = ++edits.current;
      if (!confirmed.current.has(key)) {
        const now = dataRef.current?.teams.find((t) => t.teamId === teamId)?.scores[criterionId] || 0;
        confirmed.current.set(key, now);
      }
      latest.current.set(key, token);
      inflight.current += 1;
      setSave("saving");
      setSaveError("");
      setData((prev) => withScore(prev, teamId, criterionId, value));

      chain.current = chain.current.then(async () => {
        // A newer tap on the same score is already waiting, so this one does not need to be sent.
        if (latest.current.get(key) !== token) return finish(false);
        let failed = false;
        let gone = false;
        try {
          await api("/api/judges/score", { teamId, criterionId, value });
          confirmed.current.set(key, value);
        } catch (e) {
          failed = true;
          if (e instanceof ApiError && e.status === 401) gone = true;
          else {
            setSaveError(
              e instanceof ApiError && e.status !== 0
                ? e.message
                : "That score did not save. Check the connection and tap it again."
            );
          }
        }
        if (latest.current.get(key) === token) {
          const back = confirmed.current.get(key) || 0;
          latest.current.delete(key);
          confirmed.current.delete(key);
          if (failed) setData((prev) => withScore(prev, teamId, criterionId, back));
        }
        finish(failed);
        if (gone) signedOut();
      });
    },
    [finish, signedOut]
  );

  const onComment = useCallback(
    (teamId: string, comment: string): Promise<boolean> => {
      edits.current += 1;
      inflight.current += 1;
      setSave("saving");
      setData((prev) => patchTeam(prev, teamId, (t) => ({ ...t, comment })));
      const run = chain.current.then(async () => {
        let failed = false;
        let gone = false;
        try {
          await api("/api/judges/score", { teamId, comment });
          setSaveError("");
        } catch (e) {
          failed = true;
          if (e instanceof ApiError && e.status === 401) gone = true;
          else {
            setSaveError(
              e instanceof ApiError && e.status !== 0
                ? e.message
                : "Your comment did not save yet. Check the connection. It will try again when you type or tap away."
            );
          }
        }
        finish(failed);
        if (gone) signedOut();
        return !failed;
      });
      chain.current = run.then(() => undefined);
      return run;
    },
    [finish, signedOut]
  );

  const logout = async () => {
    try {
      await api("/api/logout", { role: "judge" });
    } catch {}
    if (window.location.hash) setHashQuietly("");
    signedOut();
  };

  const open = useCallback((teamId: string) => {
    pushed.current = true;
    window.location.hash = teamId;
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    setSaveError("");
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      setHashQuietly("");
    }
  }, []);

  const jump = useCallback((teamId: string) => {
    setSaveError("");
    setSave("idle");
    setHashQuietly(teamId);
    window.scrollTo(0, 0);
  }, []);

  if (auth === "out") return <JudgeLogin onDone={() => setAuth("loading")} />;

  if (!data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
        <Logo size="lg" />
        <p className="text-muted" role="status">
          {offline ? "Could not reach the server. Trying again." : "Loading"}
        </p>
      </main>
    );
  }

  const teams = data.teams;
  const done = teams.filter((t) => t.complete).length;
  const index = hash ? teams.findIndex((t) => t.teamId === hash) : -1;
  const current = index >= 0 ? teams[index] : null;
  const pct = teams.length ? Math.round((done / teams.length) * 100) : 0;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
          <Logo />
          <span className="label">Judging</span>
          <div className="order-last flex w-full min-w-0 items-center justify-between gap-3 text-sm sm:order-none sm:ml-auto sm:w-auto">
            <span className="truncate font-medium">{data.judge.name}</span>
            <span className="mono shrink-0 text-muted">
              {done} of {teams.length} scored
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <ThemeToggle />
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
        <div
          className="h-1 bg-panel2"
          role="progressbar"
          aria-label="Projects scored"
          aria-valuemin={0}
          aria-valuemax={teams.length}
          aria-valuenow={done}
        >
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </header>

      {offline ? (
        <p role="status" className="border-b border-line bg-amber-soft px-4 py-2 text-center text-sm text-amber">
          Connection lost. Trying again.
        </p>
      ) : null}

      {data.locked && !current ? (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <p role="status" className="rounded-lg border border-line bg-panel2 px-4 py-3 font-medium">
            Scores are locked. Thanks for judging.
          </p>
        </div>
      ) : null}

      {current ? (
        <ScoreView
          key={current.teamId}
          team={current}
          criteria={data.criteria}
          locked={data.locked}
          index={index}
          total={teams.length}
          save={save}
          saveError={saveError}
          onBack={back}
          onPrev={index > 0 ? () => jump(teams[index - 1].teamId) : null}
          onNext={index < teams.length - 1 ? () => jump(teams[index + 1].teamId) : null}
          onScore={onScore}
          onComment={onComment}
        />
      ) : (
        <ProjectList teams={teams} criteria={data.criteria} phase={data.phase} onOpen={open} />
      )}
    </div>
  );
}
