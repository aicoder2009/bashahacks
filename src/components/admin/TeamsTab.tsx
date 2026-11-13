"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppFrame from "@/components/AppFrame";
import Avatar from "@/components/Avatar";
import { ErrorNote, Modal } from "@/components/ui";
import { api, timeOfDay } from "@/lib/client";
import type { AdminTeam, AdminTeamDetail } from "@/lib/admin";
import type { MemberView } from "@/lib/types";
import { Empty, Field, Section, Toggle, useAdmin, useBusy, usd } from "./shared";

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full border ${online ? "border-accent bg-accent" : "border-muted bg-transparent"}`}
      title={online ? "Online" : "Away"}
    >
      <span className="sr-only">{online ? "online" : "away"}</span>
    </span>
  );
}

function UsageBar({ team }: { team: AdminTeam }) {
  const pct = team.capUsd > 0 ? Math.min(1, team.spentUsd / team.capUsd) : 1;
  const full = team.spentUsd >= team.capUsd - 0.0005;
  const tone = full ? "bg-red" : pct > 0.8 ? "bg-amber" : "bg-accent";
  return (
    <div className="w-40">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-panel2"
        role="progressbar"
        aria-label="AI used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
      >
        <div className={`h-full ${tone}`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <div className="mono mt-1 text-xs text-muted">
        {usd(team.spentUsd)} of {usd(team.capUsd)}
        {full ? <span className="text-red"> (used up)</span> : null}
      </div>
    </div>
  );
}

function StatusPills({ team }: { team: AdminTeam }) {
  return (
    <div className="flex max-w-56 flex-wrap gap-1">
      {team.busy ? (
        <span className="pill pill-green">
          <span className="pulse-dot" aria-hidden />
          AI working
        </span>
      ) : null}
      {team.solo ? <span className="pill">Solo</span> : null}
      {team.publishedAt != null ? <span className="pill pill-green">Published</span> : team.hasApp ? <span className="pill">Has app</span> : <span className="pill">No app yet</span>}
      {team.submitted ? <span className="pill pill-green">Submitted</span> : null}
      {team.aiPaused ? <span className="pill pill-amber">AI paused</span> : null}
      {team.onBackup ? <span className="pill pill-amber">On backup key</span> : null}
    </div>
  );
}

/* ---------- View app ---------- */

function ViewApp({ team }: { team: AdminTeam }) {
  const [detail, setDetail] = useState<AdminTeamDetail | null>(null);
  const [error, setError] = useState("");
  const [which, setWhich] = useState<"current" | "published">("current");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await api<AdminTeamDetail>(`/api/admin/team/${encodeURIComponent(team.id)}`));
      setError("");
      setReload((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this team.");
    } finally {
      setLoading(false);
    }
  }, [team.id]);

  useEffect(() => {
    let alive = true;
    api<AdminTeamDetail>(`/api/admin/team/${encodeURIComponent(team.id)}`)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Could not load this team.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [team.id]);

  const files = detail ? (which === "published" ? detail.publishedFiles : detail.files) : null;
  const hasFiles = !!files && typeof files["index.html"] === "string" && files["index.html"].trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Which version to show">
          <button className={`btn btn-sm ${which === "current" ? "!border-accent !bg-accent-soft" : ""}`} aria-pressed={which === "current"} onClick={() => setWhich("current")}>
            Current app
          </button>
          <button
            className={`btn btn-sm ${which === "published" ? "!border-accent !bg-accent-soft" : ""}`}
            aria-pressed={which === "published"}
            onClick={() => setWhich("published")}
            disabled={!detail?.publishedFiles}
          >
            Published app
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-xs text-muted">
            code {team.code} · v{team.version}
          </span>
          {team.publishedAt != null ? (
            <a className="btn btn-sm" href={`/p/${team.slug}`} target="_blank" rel="noreferrer">
              Open published page
            </a>
          ) : null}
          <button className="btn btn-sm" onClick={load} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </button>
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="h-[380px] overflow-hidden rounded-lg border border-line bg-panel2">
        {hasFiles && files ? (
          <AppFrame files={files} storageKey={`admin_view_${team.id}`} reloadKey={reload} title={`${team.name} app`} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
            {!detail && !error ? "Loading the app." : which === "published" ? "This team has not published yet." : "This team has not built anything yet."}
          </div>
        )}
      </div>

      <div>
        <h3 className="label mb-1.5">Chat with the AI ({detail?.messages.length || 0} latest messages)</h3>
        {detail && detail.messages.length > 0 ? (
          <ol className="max-h-72 space-y-2 overflow-auto rounded-lg border border-line bg-bg p-3">
            {detail.messages.map((m, i) => (
              <li key={i} className="text-sm">
                <div className="mono text-xs text-muted">
                  <span className={m.role === "assistant" ? "text-accent" : "text-blue"}>{m.memberName}</span> · {timeOfDay(m.createdAt)}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.content || "(no text)"}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>{detail ? "No messages yet." : "Loading the chat."}</Empty>
        )}
      </div>
    </div>
  );
}

/* ---------- Add AI ---------- */

function AddAi({ team, onDone }: { team: AdminTeam; onDone: () => void }) {
  const { state, act } = useAdmin();
  const [busy, run] = useBusy();
  const max = Math.floor((team.spentUsd + state.ai.budgetLeft) * 100) / 100;
  const [value, setValue] = useState(() => Math.max(0, Math.min(team.capUsd + 1, max)).toFixed(2));
  const amount = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(amount) && amount >= 0;
  const tooMuch = valid && amount > max + 0.0001;

  const bump = (by: number) => setValue(Math.max(0, Math.min((valid ? amount : team.capUsd) + by, max)).toFixed(2));
  const save = () =>
    run(async () => {
      const out = await act("setCap", { teamId: team.id, capUsd: amount }, { success: `${team.name} can now use up to ${usd(amount)}.` });
      if (out) onDone();
    });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !tooMuch && !busy) save();
      }}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Used so far</dt>
        <dd className="mono text-right">{usd(team.spentUsd)}</dd>
        <dt className="text-muted">Limit now</dt>
        <dd className="mono text-right">{usd(team.capUsd)}</dd>
        <dt className="text-muted">Left in the event budget</dt>
        <dd className="mono text-right">{usd(state.ai.budgetLeft)}</dd>
        <dt className="text-muted">Most this team can be set to</dt>
        <dd className="mono text-right">{usd(max)}</dd>
      </dl>
      <Field label="New limit for this team, in dollars" hint="This is the total the team can use, counting what they already used.">
        <input className="input mono" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-sm" onClick={() => bump(0.5)}>
          +$0.50
        </button>
        <button type="button" className="btn btn-sm" onClick={() => bump(1)}>
          +$1.00
        </button>
        <button type="button" className="btn btn-sm" onClick={() => bump(2.5)}>
          +$2.50
        </button>
      </div>
      {tooMuch ? <p className="text-sm text-amber">That is more than the event has left. The most you can set is {usd(max)}.</p> : null}
      {valid && amount < team.spentUsd ? <p className="text-sm text-amber">This is below what the team already used, so their AI will stop.</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid || tooMuch || busy}>
          Save limit
        </button>
      </div>
    </form>
  );
}

/* ---------- Manage ---------- */

function MemberEditor({ member, team, others }: { member: MemberView; team: AdminTeam; others: AdminTeam[] }) {
  const { state, act } = useAdmin();
  const [busy, run] = useBusy();
  const [name, setName] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const shown = name ?? member.name;

  const rename = () =>
    run(async () => {
      const out = await act("renameMember", { memberId: member.id, name: shown }, { success: "Name saved." });
      if (out) setName(null);
    });
  const move = () => {
    const to = others.find((t) => t.code === target);
    if (!to) return;
    if (!window.confirm(`Move ${member.name} from ${team.name} to ${to.name}? They will need to press Rejoin and type the code ${to.code}.`)) return;
    run(() => act("moveMember", { memberId: member.id, teamCode: to.code }, { success: `${member.name} moved to ${to.name}. They rejoin with code ${to.code}.` }));
  };
  const remove = () => {
    if (!window.confirm(`Remove ${member.name} from ${team.name}? They will be signed out and can join again with the event code.`)) return;
    run(() => act("removeMember", { memberId: member.id }, { success: `${member.name} was removed.` }));
  };

  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-2">
        <Avatar spec={member.avatar} size={28} />
        <span className="min-w-0 truncate font-medium">{member.name}</span>
        <OnlineDot online={member.online} />
        <span className="text-xs text-muted">{member.online ? "online" : "away"}</span>
        <button className="btn btn-danger btn-sm ml-auto" disabled={busy} onClick={remove}>
          Remove
        </button>
      </div>
      <div className="mt-2 grid gap-2 min-[560px]:grid-cols-2">
        <div className="flex items-end gap-2">
          <Field label="Name" className="min-w-0 flex-1">
            <input className="input !h-9 text-sm" value={shown} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </Field>
          <button className="btn btn-sm !h-9" disabled={busy || name == null || shown.trim().length < 2 || shown.trim() === member.name} onClick={rename}>
            Save
          </button>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Move to team" className="min-w-0 flex-1">
            <select className="input !h-9 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Pick a team</option>
              {others.map((t) => {
                const isFull = t.members.length >= state.settings.maxTeamSize;
                return (
                  <option key={t.id} value={t.code} disabled={isFull}>
                    {t.name} ({t.code}){isFull ? ", full" : ""}
                  </option>
                );
              })}
            </select>
          </Field>
          <button className="btn btn-sm !h-9" disabled={busy || !target} onClick={move}>
            Move
          </button>
        </div>
      </div>
    </li>
  );
}

function Manage({ team, onDone }: { team: AdminTeam; onDone: () => void }) {
  const { state, act } = useAdmin();
  const [busy, run] = useBusy();
  const [name, setName] = useState<string | null>(null);
  const shown = name ?? team.name;
  const others = useMemo(() => state.teams.filter((t) => t.id !== team.id), [state.teams, team.id]);

  const rename = () =>
    run(async () => {
      const out = await act("renameTeam", { teamId: team.id, name: shown }, { success: "Team name saved." });
      if (out) setName(null);
    });
  const remove = () => {
    const people = team.members.length === 1 ? "1 student" : `${team.members.length} students`;
    if (!window.confirm(`Delete ${team.name} for good? This removes the team, its ${people}, its app, its chat, and its scores. This cannot be undone.`)) return;
    run(async () => {
      const out = await act("deleteTeam", { teamId: team.id }, { success: `${team.name} was deleted.` });
      if (out) onDone();
    });
  };

  return (
    <div className="space-y-5">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && name != null && shown.trim().length >= 2) rename();
        }}
      >
        <Field label="Team name" className="min-w-0 flex-1">
          <input className="input" value={shown} maxLength={28} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={busy || name == null || shown.trim().length < 2 || shown.trim() === team.name}>
          Save name
        </button>
      </form>

      <Toggle
        label="Solo"
        checked={team.solo}
        disabled={busy || (!team.solo && team.members.length > 1)}
        onChange={(v) => run(() => act("setSolo", { teamId: team.id, solo: v }, { success: v ? "Marked solo. Nobody can join with the code." : "Open to teammates now." }))}
        hint={
          !team.solo && team.members.length > 1
            ? "This team has more than one person, so it cannot be solo."
            : `When on, nobody else can join with the code ${team.code}.`
        }
      />

      <div>
        <h3 className="label mb-2">Members ({team.members.length})</h3>
        {team.members.length === 0 ? (
          <Empty>Nobody is on this team. You can delete it.</Empty>
        ) : (
          <ul className="space-y-2">
            {team.members.map((m) => (
              <MemberEditor key={m.id} member={m} team={team} others={others} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red/40 bg-red-soft px-3 py-2.5">
        <p className="text-sm">Deleting removes the team, its students, its app, and its scores.</p>
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>
          Delete team
        </button>
      </div>
    </div>
  );
}

/* ---------- Table ---------- */

type Open = { kind: "view" | "cap" | "manage"; teamId: string };

export function TeamsTab() {
  const { state, act } = useAdmin();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, run] = useBusy();
  const close = useCallback(() => setOpen(null), []);

  const needle = query.trim().toLowerCase();
  const teams = needle
    ? state.teams.filter(
        (t) => t.name.toLowerCase().includes(needle) || t.code.toLowerCase().includes(needle) || t.members.some((m) => m.name.toLowerCase().includes(needle))
      )
    : state.teams;
  const openTeam = open ? state.teams.find((t) => t.id === open.teamId) || null : null;
  const online = state.teams.reduce((n, t) => n + t.members.filter((m) => m.online).length, 0);

  const togglePause = (team: AdminTeam) =>
    run(() => act("pauseTeam", { teamId: team.id, paused: !team.aiPaused }, { success: team.aiPaused ? `AI is back on for ${team.name}.` : `AI paused for ${team.name}.` }));

  return (
    <div className="space-y-4">
      <Section
        title="Teams"
        hint={`${state.counts.teams} teams, ${state.counts.students} students, ${online} online now.`}
        actions={
          <label className="flex items-center gap-2">
            <span className="label">Find</span>
            <input
              className="input !h-8 !w-56 text-sm"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Team, code, or student"
            />
          </label>
        }
      >
        {state.teams.length === 0 ? (
          <Empty>No teams yet. They show up here as students join.</Empty>
        ) : teams.length === 0 ? (
          <Empty>Nothing matches that search.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="label py-2 pr-3 font-normal">
                    Team and members
                  </th>
                  <th scope="col" className="label py-2 pr-3 font-normal">
                    Code
                  </th>
                  <th scope="col" className="label py-2 pr-3 font-normal">
                    AI used
                  </th>
                  <th scope="col" className="label py-2 pr-3 font-normal">
                    Status
                  </th>
                  <th scope="col" className="label py-2 text-right font-normal">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} className="border-b border-line align-top last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold">{team.name}</div>
                      {team.appTitle ? <div className="max-w-64 truncate text-xs text-muted">{team.appTitle}</div> : null}
                      <ul className="mt-1.5 flex max-w-80 flex-wrap gap-x-3 gap-y-1">
                        {team.members.length === 0 ? <li className="text-xs text-muted">No members</li> : null}
                        {team.members.map((m) => (
                          <li key={m.id} className="flex items-center gap-1.5">
                            <Avatar spec={m.avatar} size={28} />
                            <span className="text-[0.82rem]">{m.name}</span>
                            <OnlineDot online={m.online} />
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="mono py-2.5 pr-3 text-[0.95rem] tracking-wider">{team.code}</td>
                    <td className="py-2.5 pr-3">
                      <UsageBar team={team} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusPills team={team} />
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button className="btn btn-sm" onClick={() => setOpen({ kind: "view", teamId: team.id })}>
                          View app
                        </button>
                        <button className="btn btn-sm" onClick={() => setOpen({ kind: "cap", teamId: team.id })}>
                          Add AI
                        </button>
                        <button className="btn btn-sm" disabled={busy} onClick={() => togglePause(team)} aria-pressed={team.aiPaused}>
                          {team.aiPaused ? "Resume AI" : "Pause AI"}
                        </button>
                        <button className="btn btn-sm" onClick={() => setOpen({ kind: "manage", teamId: team.id })} aria-label={`Manage ${team.name}: rename, members, delete`}>
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Manage is where you rename a team, rename, move, or remove a student, and delete a team. A filled dot means the student is online.
        </p>
      </Section>

      <Modal open={!!openTeam && open?.kind === "view"} onClose={close} title={openTeam ? `${openTeam.name}: app and chat` : "App"} wide>
        {openTeam && open?.kind === "view" ? <ViewApp key={openTeam.id} team={openTeam} /> : null}
      </Modal>
      <Modal open={!!openTeam && open?.kind === "cap"} onClose={close} title={openTeam ? `Add AI for ${openTeam.name}` : "Add AI"}>
        {openTeam && open?.kind === "cap" ? <AddAi key={openTeam.id} team={openTeam} onDone={close} /> : null}
      </Modal>
      <Modal open={!!openTeam && open?.kind === "manage"} onClose={close} title={openTeam ? `Manage ${openTeam.name}` : "Manage team"} wide>
        {openTeam && open?.kind === "manage" ? <Manage key={openTeam.id} team={openTeam} onDone={close} /> : null}
      </Modal>
    </div>
  );
}
