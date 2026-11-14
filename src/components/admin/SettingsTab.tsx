"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { Field, Section, useAdmin, useBusy, useDraft } from "./shared";

function Basics() {
  const { state, act } = useAdmin();
  const { settings } = state;
  const name = useDraft(settings.eventName);
  const code = useDraft(settings.eventCode);
  const judge = useDraft(settings.judgeCode);
  const [busy, run] = useBusy();
  const dirty = name.dirty || code.dirty || judge.dirty;
  const problem =
    name.value.trim().length < 2
      ? "The event name needs at least 2 characters."
      : !/^[A-Z0-9]{4,10}$/.test(code.value.trim().toUpperCase())
        ? "The event code needs 4 to 10 letters and digits, with no spaces."
        : judge.value.trim().length < 4
          ? "The judge passcode needs at least 4 characters."
          : "";

  const reset = () => {
    name.reset();
    code.reset();
    judge.reset();
  };
  const save = () => {
    if (code.dirty && state.counts.students > 0 && !window.confirm("Change the event code? Students who already joined stay in, but new students need the new code.")) return;
    run(async () => {
      const patch: Record<string, string> = {};
      if (name.dirty) patch.eventName = name.value.trim();
      if (code.dirty) patch.eventCode = code.value.trim().toUpperCase();
      if (judge.dirty) patch.judgeCode = judge.value.trim();
      const out = await act("updateSettings", { patch }, { success: "Settings saved." });
      if (out) reset();
    });
  };

  return (
    <Section
      title="Event basics"
      actions={
        <>
          {dirty ? (
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              Undo
            </button>
          ) : null}
          <button className="btn btn-primary btn-sm" disabled={!dirty || !!problem || busy} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="grid gap-3 min-[900px]:grid-cols-3">
        <Field label="Event name">
          <input className="input" value={name.value} maxLength={60} onChange={(e) => name.set(e.target.value)} />
        </Field>
        <Field label="Event code" hint="Students type this to join. It is shown on the TV.">
          <input className="input mono uppercase tracking-widest" value={code.value} maxLength={10} autoCapitalize="characters" spellCheck={false} onChange={(e) => code.set(e.target.value)} />
        </Field>
        <Field label="Judge passcode" hint="Tell the judges this in person.">
          <input className="input mono" value={judge.value} maxLength={40} spellCheck={false} onChange={(e) => judge.set(e.target.value)} />
        </Field>
      </div>
      {dirty && problem ? <p className="mt-2 text-sm text-amber">{problem}</p> : null}
    </Section>
  );
}

function Links() {
  const { state, act, toast } = useAdmin();
  const [busy, run] = useBusy();
  const tvPath = `/tv?key=${encodeURIComponent(state.settings.tvKey)}`;
  const tvLink = `${window.location.origin}${tvPath}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tvLink);
      toast("ok", "TV link copied.");
    } catch {
      toast("error", "Could not copy. Select the link and copy it by hand.");
    }
  };
  const regen = () => {
    if (!window.confirm("Make a new TV link? The old link stops working, so the TV needs to open the new one.")) return;
    run(() => act("regenTvKey", {}, { success: "New TV link made. Open it on the TV." }));
  };

  return (
    <Section title="Screens and links" hint="Open the TV link on the big screen. Anyone with the link can see the TV view, so do not post it.">
      <Field label="TV link">
        <input className="input mono text-sm" readOnly value={tvLink} onFocus={(e) => e.currentTarget.select()} />
      </Field>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={copy}>
          Copy
        </button>
        <button className="btn btn-sm" disabled={busy} onClick={regen}>
          Make a new TV link
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <a className="btn btn-sm" href={tvPath} target="_blank" rel="noreferrer">
          Open the TV screen
        </a>
        <a className="btn btn-sm" href="/judges" target="_blank" rel="noreferrer">
          Open the judges page
        </a>
        <a className="btn btn-sm" href="/join" target="_blank" rel="noreferrer">
          Open the student page
        </a>
      </div>
      <p className="mt-2 text-xs text-muted">Each one opens in a new tab.</p>
    </Section>
  );
}

function Account() {
  const { loggedOut, toast } = useAdmin();
  const [busy, run] = useBusy();
  const logout = () =>
    run(async () => {
      try {
        await api("/api/logout", { role: "admin" });
        loggedOut();
      } catch (e) {
        toast("error", e instanceof Error ? e.message : "Could not log out. Try again.");
      }
    });
  return (
    <Section title="This laptop" hint="Log out when you hand this laptop to someone who is not an officer.">
      <button className="btn btn-sm" disabled={busy} onClick={logout}>
        Log out
      </button>
    </Section>
  );
}

function Danger() {
  const { state, act } = useAdmin();
  const [typed, setTyped] = useState("");
  const [busy, run] = useBusy();
  const ready = typed === "WIPE";

  const wipe = () => {
    const { teams, students } = state.counts;
    if (!window.confirm(`Wipe everything? This deletes ${teams} teams, ${students} students, every app, every chat, every announcement, every judge, and every score. This cannot be undone.`)) return;
    run(async () => {
      const out = await act("wipe", { confirm: typed }, { success: "Event data wiped. The event is back in the lobby." });
      if (out) setTyped("");
    });
  };

  return (
    <section className="rounded-[10px] border border-red/40 bg-red-soft p-4">
      <h2 className="text-[0.95rem] font-semibold text-red">Danger zone</h2>
      <p className="mt-1 text-sm">
        Wipe event data deletes all teams, students, apps, chats, announcements, submissions, judges, scores, and the AI spend log, then puts the event back in the lobby. The rubric, the
        AI keys, and your settings are kept. Use it after a practice run, never during the real event.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) wipe();
        }}
      >
        <Field label="Type WIPE to unlock">
          <input className="input mono !h-9 !w-40 text-sm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field>
        <button type="submit" className="btn btn-danger btn-sm !h-9" disabled={!ready || busy}>
          Wipe event data
        </button>
      </form>
    </section>
  );
}

export function SettingsTab() {
  return (
    <div className="space-y-4">
      <Basics />
      <Links />
      <Account />
      <Danger />
    </div>
  );
}
