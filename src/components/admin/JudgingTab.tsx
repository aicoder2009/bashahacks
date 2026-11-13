"use client";
import { useRef } from "react";
import type { Criterion, PodiumEntry } from "@/lib/types";
import { Empty, Section, useAdmin, useBusy, useDraft } from "./shared";

type Row = { key: string; id: number | null; name: string; hint: string; weight: string };

const toRows = (criteria: Criterion[]): Row[] => criteria.map((c) => ({ key: `c${c.id}`, id: c.id, name: c.name, hint: c.hint, weight: String(c.weight) }));

function Rubric() {
  const { state, act } = useAdmin();
  const draft = useDraft<Row[]>(toRows(state.criteria));
  const rows = draft.value;
  const [busy, run] = useBusy();
  const nextKey = useRef(0);

  const update = (i: number, patch: Partial<Row>) => draft.set(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    draft.set(next);
  };
  const add = () => {
    nextKey.current += 1;
    draft.set([...rows, { key: `new${nextKey.current}`, id: null, name: "", hint: "", weight: "1" }]);
  };

  const problem =
    rows.length < 1
      ? "The rubric needs at least one row."
      : rows.some((r) => !r.name.trim())
        ? "Every row needs a name."
        : rows.some((r) => !(Number(r.weight) >= 0.1 && Number(r.weight) <= 10))
          ? "Weights need to be from 0.1 to 10."
          : "";

  const save = () => {
    const keptIds = new Set(rows.map((r) => r.id).filter((id) => id != null));
    const removed = state.criteria.filter((c) => !keptIds.has(c.id)).length;
    if (removed > 0 && !window.confirm(`Save the rubric? ${removed === 1 ? "1 row was removed" : `${removed} rows were removed`}, and the scores judges gave for ${removed === 1 ? "it" : "them"} will be deleted.`)) return;
    run(async () => {
      const criteria = rows.map((r) => ({ id: r.id ?? undefined, name: r.name.trim(), hint: r.hint.trim(), weight: Number(r.weight) }));
      const out = await act("saveCriteria", { criteria }, { success: "Rubric saved." });
      if (out) draft.reset();
    });
  };

  return (
    <Section
      title="Rubric"
      hint="Judges score every team on each row. A row with weight 2 counts twice as much as a row with weight 1."
      actions={
        <>
          {draft.dirty ? (
            <button className="btn btn-ghost btn-sm" onClick={draft.reset}>
              Undo
            </button>
          ) : null}
          <button className="btn btn-primary btn-sm" disabled={!draft.dirty || !!problem || busy} onClick={save}>
            Save rubric
          </button>
        </>
      }
    >
      <ol className="space-y-2">
        {rows.map((row, i) => (
          <li key={row.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
            <span className="mono w-5 text-center text-xs text-muted">{i + 1}</span>
            <input
              className="input !h-9 !w-52 text-sm"
              value={row.name}
              maxLength={40}
              placeholder="Name"
              aria-label={`Row ${i + 1} name`}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              className="input !h-9 min-w-48 flex-1 text-sm"
              value={row.hint}
              maxLength={160}
              placeholder="Hint for judges"
              aria-label={`Row ${i + 1} hint for judges`}
              onChange={(e) => update(i, { hint: e.target.value })}
            />
            <label className="flex items-center gap-1.5">
              <span className="label">Weight</span>
              <input
                className="input mono !h-9 !w-16 text-sm"
                inputMode="decimal"
                value={row.weight}
                aria-label={`Row ${i + 1} weight`}
                onChange={(e) => update(i, { weight: e.target.value })}
              />
            </label>
            <div className="flex items-center gap-1">
              <button className="btn btn-sm !px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move row ${i + 1} up`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </button>
              <button className="btn btn-sm !px-2" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move row ${i + 1} down`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => draft.set(rows.filter((_, n) => n !== i))} aria-label={`Remove row ${i + 1}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn btn-sm" disabled={rows.length >= 12} onClick={add}>
          Add row
        </button>
        {draft.dirty && problem ? <span className="text-sm text-amber">{problem}</span> : null}
        {draft.dirty && !problem ? <span className="text-sm text-muted">You have changes that are not saved yet.</span> : null}
      </div>
    </Section>
  );
}

function Judges() {
  const { state, act } = useAdmin();
  const [busy, run] = useBusy();

  const remove = (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}? Their scores and notes are deleted too.`)) return;
    run(() => act("removeJudge", { judgeId: id }, { success: `${name} was removed.` }));
  };

  return (
    <Section title="Judges" hint={`Judges sign in at /judges with the passcode ${state.settings.judgeCode}.`}>
      {state.judges.length === 0 ? (
        <Empty>No judges have signed in yet.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {state.judges.map((j) => {
            const pct = j.totalTeams > 0 ? Math.min(100, Math.round((j.scoredTeams / j.totalTeams) * 100)) : 0;
            const done = j.totalTeams > 0 && j.scoredTeams >= j.totalTeams;
            return (
              <li key={j.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-32 flex-1 font-medium">{j.name}</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-panel2" aria-hidden>
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="mono w-44 text-xs text-muted">
                  scored {j.scoredTeams} of {j.totalTeams} teams{done ? ", done" : ""}
                </span>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(j.id, j.name)}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function Leaderboard() {
  const { state } = useAdmin();
  const board = state.leaderboard;
  // Only teams that at least one judge scored get a rank, in the same order the leaderboard already uses.
  const ranks = new Map(board.filter((r) => r.judgeCount > 0).map((r, i) => [r.teamId, i + 1]));

  return (
    <Section
      title="Leaderboard"
      hint="Only officers can see this. Each score is the average across judges, out of 100."
      actions={
        <a className="btn btn-sm" href="/api/admin/export" download>
          Download results (CSV)
        </a>
      }
    >
      {board.length === 0 ? (
        <Empty>No teams yet.</Empty>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="label w-14 py-2 pr-3 font-normal">
                  Rank
                </th>
                <th scope="col" className="label py-2 pr-3 font-normal">
                  Team
                </th>
                <th scope="col" className="label py-2 pr-3 font-normal">
                  App
                </th>
                <th scope="col" className="label py-2 pr-3 text-right font-normal">
                  Score
                </th>
                <th scope="col" className="label py-2 text-right font-normal">
                  Judges
                </th>
              </tr>
            </thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.teamId} className="border-b border-line last:border-b-0">
                  <td className="mono py-2 pr-3">{ranks.get(r.teamId) ?? <span className="text-muted">none</span>}</td>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.teamName}</div>
                    <div className="text-xs text-muted">{r.members.map((m) => m.name).join(", ") || "No members"}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <span>{r.appTitle}</span>
                    {r.submitted ? null : <span className="pill ml-2">Not submitted</span>}
                  </td>
                  <td className="mono py-2 pr-3 text-right">
                    {r.judgeCount > 0 ? (
                      <>
                        {r.score.toFixed(1)} <span className="text-xs text-muted">of 100</span>
                      </>
                    ) : (
                      <span className="text-muted">not scored</span>
                    )}
                  </td>
                  <td className="mono py-2 text-right">{r.judgeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const PLACE_NAME: Record<number, string> = { 1: "1st place", 2: "2nd place", 3: "3rd place" };

function Podium() {
  const { state, act } = useAdmin();
  const { settings } = state;
  const [busy, run] = useBusy();
  const podium = settings.podium;
  const step = settings.podiumStep;
  const scored = state.leaderboard.filter((r) => r.judgeCount > 0).length;

  const lock = () => {
    if (!window.confirm("Lock the results and start the winners reveal? The top 3 are frozen as they are right now, and the TV switches to the winners screen with nothing revealed yet.")) return;
    run(() => act("lockPodium", {}, { success: "Results locked. The TV is ready for the reveal." }));
  };
  const back = () => {
    if (!window.confirm("Go back to judging? The locked top 3 are thrown away and the TV leaves the winners screen.")) return;
    run(() => act("clearPodium", {}, { success: "Back to judging." }));
  };
  const show = (n: number, text: string) => run(() => act("podiumStep", { step: n }, { success: text }));

  if (!podium) {
    return (
      <Section title="Winners reveal" hint="When judging is finished, lock the results. Then reveal 3rd, 2nd, and 1st place on the TV, one press at a time.">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={busy || scored < 1} onClick={lock}>
            Lock results and start the winners reveal
          </button>
          <span className="text-sm text-muted">
            {scored < 1 ? "No team has a score yet." : scored === 1 ? "1 team has a score." : `${scored} teams have scores.`}
          </span>
        </div>
      </Section>
    );
  }

  // Reveal order: third, then second, then first.
  const order = [3, 2, 1];
  const byPlace = new Map<number, PodiumEntry>(podium.map((p) => [p.place, p]));
  const buttons = [
    { step: 0, label: "Hide all", done: "Everything is hidden again." },
    { step: 1, label: "Show 3rd place", done: "3rd place is on the TV." },
    { step: 2, label: "Show 2nd place", done: "2nd place is on the TV." },
    { step: 3, label: "Show 1st place", done: "1st place is on the TV." },
  ];

  return (
    <Section
      title="Winners reveal"
      hint="Results are locked. Press the buttons in order while everyone watches the TV."
      actions={
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={back}>
          Back to judging
        </button>
      }
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Reveal steps">
        {buttons.map((b) => {
          const current = step === b.step;
          return (
            <button
              key={b.step}
              className={`btn ${current ? "btn-primary" : ""}`}
              aria-pressed={current}
              disabled={busy}
              onClick={() => show(b.step, b.done)}
            >
              {b.label}
              {current ? <span className="mono text-xs">(now)</span> : null}
            </button>
          );
        })}
      </div>

      <ol className="mt-4 divide-y divide-line rounded-lg border border-line">
        {order.map((place, i) => {
          const entry = byPlace.get(place);
          const revealed = step >= i + 1;
          return (
            <li key={place} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <span className="mono w-20 shrink-0 font-semibold">{PLACE_NAME[place]}</span>
              {entry ? (
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{entry.teamName}</span>
                  <span className="text-muted">
                    , {entry.appTitle}, {entry.score.toFixed(1)} of 100
                  </span>
                  <span className="block text-xs text-muted">{entry.members.map((m) => m.name).join(", ")}</span>
                </span>
              ) : (
                <span className="min-w-0 flex-1 text-muted">Nobody. Fewer than {place} teams were scored.</span>
              )}
              <span className={`pill ${revealed ? "pill-green" : ""}`}>{revealed ? "Shown on TV" : "Hidden"}</span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function JudgingTab() {
  return (
    <div className="space-y-4">
      <Podium />
      <Judges />
      <Leaderboard />
      <Rubric />
    </div>
  );
}
