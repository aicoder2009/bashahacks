"use client";
import { timeOfDay } from "@/lib/client";
import type { Phase, ScheduleItem } from "@/lib/types";
import { Field, PHASES, Section, Toggle, dayAndTime, fromLocalInput, phaseLabel, toLocalInput, useAdmin, useBusy, useDraft } from "./shared";

function PhasePicker() {
  const { state, act } = useAdmin();
  const { settings } = state;
  const [busy, run] = useBusy();

  const choose = (phase: Phase) => {
    if (phase === settings.phase) return;
    const extra =
      phase === "lobby"
        ? " Auto start will be turned off so it stays in the lobby."
        : phase === "hacking"
          ? " If the end time has already passed, 30 minutes go on the clock."
          : "";
    if (!window.confirm(`Move the event to ${phaseLabel(phase)}?${extra}`)) return;
    run(() => act("setPhase", { phase }, { success: `The event is now in ${phaseLabel(phase)}.` }));
  };

  return (
    <Section title="Phase" hint="The whole room follows this: student screens, the judges page, and the TV.">
      <ol className="grid gap-2 min-[1100px]:grid-cols-5">
        {PHASES.map((p, i) => {
          const current = p.id === settings.phase;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`h-full w-full rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                  current ? "border-accent bg-accent-soft" : "border-line bg-panel hover:bg-panel2"
                }`}
                aria-pressed={current}
                disabled={busy}
                onClick={() => choose(p.id)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    <span className="mono mr-1.5 text-xs text-muted">{i + 1}</span>
                    {p.label}
                  </span>
                  {current ? <span className="pill pill-green">Now</span> : null}
                </span>
                <span className="mt-1 block text-sm text-muted">{p.help}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function Times() {
  const { state, act } = useAdmin();
  const { settings } = state;
  const start = useDraft(toLocalInput(settings.startsAt));
  const end = useDraft(toLocalInput(settings.endsAt));
  const [busy, run] = useBusy();
  const dirty = start.dirty || end.dirty;
  const startMs = fromLocalInput(start.value);
  const endMs = fromLocalInput(end.value);
  const problem = startMs == null || endMs == null ? "Pick both times." : endMs <= startMs ? "The end time needs to be after the start time." : "";

  const save = () =>
    run(async () => {
      // Only send what changed, so an untouched time keeps its exact seconds.
      const patch: { startsAt?: number | null; endsAt?: number | null } = {};
      if (start.dirty) patch.startsAt = startMs;
      if (end.dirty) patch.endsAt = endMs;
      const out = await act("updateSettings", { patch }, { success: "Times saved." });
      if (out) {
        start.reset();
        end.reset();
      }
    });

  return (
    <Section
      title="Building time"
      hint="Shown in this laptop's own time zone."
      actions={
        <>
          {dirty ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                start.reset();
                end.reset();
              }}
            >
              Undo
            </button>
          ) : null}
          <button className="btn btn-primary btn-sm" disabled={!dirty || !!problem || busy} onClick={save}>
            Save times
          </button>
        </>
      }
    >
      <div className="grid gap-3 min-[700px]:grid-cols-2">
        <Field label="Building starts" hint={`Now set to ${dayAndTime(settings.startsAt)}`}>
          <input type="datetime-local" className="input mono" value={start.value} onChange={(e) => start.set(e.target.value)} />
        </Field>
        <Field label="Submissions close" hint={`Now set to ${dayAndTime(settings.endsAt)}`}>
          <input type="datetime-local" className="input mono" value={end.value} onChange={(e) => end.set(e.target.value)} />
        </Field>
      </div>
      {dirty && problem ? <p className="mt-2 text-sm text-amber">{problem}</p> : null}
      {settings.pausedRemainingMs != null ? (
        <p className="mt-2 text-sm text-amber">The timer is paused, so the end time will be worked out again when you press Resume.</p>
      ) : null}

      <div className="mt-4 grid gap-4 border-t border-line pt-4 min-[700px]:grid-cols-2">
        <Toggle
          label="Auto start"
          checked={settings.autoStart}
          disabled={busy}
          onChange={(v) => run(() => act("updateSettings", { patch: { autoStart: v } }, { success: v ? "Auto start is on." : "Auto start is off." }))}
          hint={`Opens building by itself at ${timeOfDay(settings.startsAt)} if the event is still in the lobby.`}
        />
        <Toggle
          label="Auto end"
          checked={settings.autoEnd}
          disabled={busy}
          onChange={(v) => run(() => act("updateSettings", { patch: { autoEnd: v } }, { success: v ? "Auto end is on." : "Auto end is off." }))}
          hint="Closes submissions and opens judging by itself when the timer hits zero."
        />
      </div>
    </Section>
  );
}

function TimerTools() {
  const { state, act } = useAdmin();
  const { settings } = state;
  const [busy, run] = useBusy();
  const paused = settings.pausedRemainingMs != null;
  const canAdd = settings.phase === "hacking" || settings.phase === "judging";

  return (
    <Section title="Timer" hint="Quick changes while the event is running.">
      <div className="flex flex-wrap items-center gap-2">
        {paused ? (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => act("resume", {}, { success: "Timer is running again." }))}>
            Resume
          </button>
        ) : (
          <button className="btn btn-sm" disabled={busy || settings.phase !== "hacking"} onClick={() => run(() => act("pause", {}, { success: "Timer paused." }))}>
            Pause
          </button>
        )}
        {[5, 10, 15, 30].map((m) => (
          <button
            key={m}
            className="btn btn-sm"
            disabled={busy || !canAdd}
            onClick={() => run(() => act("addTime", { minutes: m }, { success: settings.phase === "judging" ? `Building is open again for ${m} minutes.` : `Added ${m} minutes.` }))}
          >
            +{m} min
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        {settings.phase === "judging"
          ? "Adding time during judging reopens building for that many minutes."
          : settings.phase === "hacking"
            ? "Pause freezes the countdown for everyone. Adding time moves the end later."
            : "These work once building is open."}
      </p>
    </Section>
  );
}

function ScheduleEditor() {
  const { state, act } = useAdmin();
  const draft = useDraft<ScheduleItem[]>(state.settings.schedule);
  const rows = draft.value;
  const [busy, run] = useBusy();

  const update = (i: number, patch: Partial<ScheduleItem>) => draft.set(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const save = () =>
    run(async () => {
      const out = await act("updateSettings", { patch: { schedule: rows.filter((r) => r.time.trim() || r.label.trim()) } }, { success: "Schedule saved." });
      if (out) draft.reset();
    });

  return (
    <Section
      title="Schedule"
      hint="Shown to students and on the TV. It is only a list, it does not move the phases."
      actions={
        <>
          {draft.dirty ? (
            <button className="btn btn-ghost btn-sm" onClick={draft.reset}>
              Undo
            </button>
          ) : null}
          <button className="btn btn-primary btn-sm" disabled={!draft.dirty || busy} onClick={save}>
            Save schedule
          </button>
        </>
      }
    >
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              className="input mono !h-9 !w-24 shrink-0 text-sm"
              value={row.time}
              maxLength={12}
              placeholder="9:30"
              aria-label={`Row ${i + 1} time`}
              onChange={(e) => update(i, { time: e.target.value })}
            />
            <input
              className="input !h-9 text-sm"
              value={row.label}
              maxLength={60}
              placeholder="What happens"
              aria-label={`Row ${i + 1} label`}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <button className="btn btn-ghost btn-sm shrink-0" aria-label={`Remove row ${i + 1}`} onClick={() => draft.set(rows.filter((_, n) => n !== i))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-sm mt-3" disabled={rows.length >= 12} onClick={() => draft.set([...rows, { time: "", label: "" }])}>
        Add row
      </button>
    </Section>
  );
}

function TeamRules() {
  const { state, act } = useAdmin();
  const { settings } = state;
  const [busy, run] = useBusy();

  return (
    <Section title="Teams" hint="Rules for how students group up.">
      <div className="grid gap-4 min-[700px]:grid-cols-2">
        <Toggle
          label="Teams allowed"
          checked={settings.teamsAllowed}
          disabled={busy}
          onChange={(v) => run(() => act("updateSettings", { patch: { teamsAllowed: v } }, { success: v ? "Teams are allowed." : "Everyone builds solo now." }))}
          hint="When off, new students can only build solo. Teams that already exist stay together."
        />
        <Field label="Most people on one team">
          <select
            className="input mono !h-9 !w-24 text-sm"
            value={settings.maxTeamSize}
            disabled={busy}
            onChange={(e) => {
              const n = Number(e.target.value);
              run(() => act("updateSettings", { patch: { maxTeamSize: n } }, { success: `Teams can have up to ${n}.` }));
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Section>
  );
}

export function EventTab() {
  return (
    <div className="space-y-4">
      <PhasePicker />
      <TimerTools />
      <Times />
      <ScheduleEditor />
      <TeamRules />
    </div>
  );
}
