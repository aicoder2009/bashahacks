"use client";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import { categoryLabel, scoredCount, totalOf, type JudgeCriterion, type JudgeTeam } from "./types";

type Filter = "all" | "todo" | "done";

export function StatusPills({ team, criteria }: { team: JudgeTeam; criteria: JudgeCriterion[] }) {
  const scored = scoredCount(criteria, team.scores);
  return (
    <>
      {team.category ? <span className="pill">{categoryLabel(team.category)}</span> : null}
      {team.complete ? (
        <span className="pill pill-green">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Scored
        </span>
      ) : scored > 0 ? (
        <span className="pill pill-amber">
          In progress, {scored} of {criteria.length}
        </span>
      ) : (
        <span className="pill">Not scored</span>
      )}
      {team.submitted ? null : <span className="pill pill-amber">Not submitted</span>}
    </>
  );
}

export function TeamLine({ team, size = 28 }: { team: JudgeTeam; size?: number }) {
  const names = team.members.map((m) => m.name).join(", ");
  return (
    <div className="flex min-w-0 items-center gap-2">
      {team.members.length ? (
        <span className="flex shrink-0 -space-x-1.5">
          {team.members.map((m, i) => (
            <Avatar key={i} spec={m.avatar} size={size} title={m.name} />
          ))}
        </span>
      ) : null}
      <span className="min-w-0 text-sm leading-snug">
        <span className="block truncate font-medium">{team.teamName}</span>
        {!team.solo && names ? <span className="block truncate text-muted">{names}</span> : null}
      </span>
    </div>
  );
}

export default function ProjectList({
  teams,
  criteria,
  phase,
  onOpen,
}: {
  teams: JudgeTeam[];
  criteria: JudgeCriterion[];
  phase: string;
  onOpen: (teamId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const done = teams.filter((t) => t.complete).length;
  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: teams.length },
    { id: "todo", label: "To do", count: teams.length - done },
    { id: "done", label: "Done", count: done },
  ];
  const shown = teams.filter((t) => (filter === "all" ? true : filter === "done" ? t.complete : !t.complete));
  const max = criteria.length * 5;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted">Tap a project to score it. Your scores save as you go.</p>
        </div>
        <div role="group" aria-label="Filter projects" className="flex gap-2">
          {chips.map((c) => {
            const on = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(c.id)}
                className={`btn h-10 px-3 text-sm ${on ? "border-accent bg-accent-soft font-semibold text-accent hover:bg-accent-soft" : ""}`}
              >
                {c.label}
                <span className="mono text-xs opacity-80">{c.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {phase === "lobby" || phase === "hacking" ? (
        <p className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-muted">
          Teams are still building, so apps can change. Anything you score now is saved.
        </p>
      ) : null}

      {teams.length === 0 ? (
        <div className="card mt-4 p-6 text-center">
          <p className="font-medium">No apps to score yet</p>
          <p className="mt-1 text-sm text-muted">Projects show up here as soon as teams start building.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="card mt-4 p-6 text-center">
          <p className="font-medium">{filter === "todo" ? "Nothing left to do" : "Nothing scored yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {filter === "todo" ? "You have scored every project. Thank you." : "Projects you finish scoring will show up here."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {shown.map((t) => {
            const scored = scoredCount(criteria, t.scores);
            return (
              <li key={t.teamId}>
                <button
                  type="button"
                  onClick={() => onOpen(t.teamId)}
                  className="card flex h-full w-full cursor-pointer flex-col gap-3 p-4 text-left transition-colors hover:bg-panel2"
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="min-w-0 text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{t.appTitle}</span>
                    {scored > 0 ? (
                      <span className="mono shrink-0 text-sm text-muted">
                        {totalOf(criteria, t.scores)} of {max}
                      </span>
                    ) : null}
                  </span>
                  <TeamLine team={t} />
                  <span className="mt-auto flex flex-wrap gap-1.5">
                    <StatusPills team={t} criteria={criteria} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
