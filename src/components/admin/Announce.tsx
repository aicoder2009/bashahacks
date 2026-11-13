"use client";
import { useId, useState } from "react";
import { timeOfDay } from "@/lib/client";
import { Empty, Section, useAdmin, useBusy } from "./shared";

const MAX = 280;

/** The announcement box. It keeps its own text, so the dashboard refresh never clears what is being typed. */
export function Composer({ rows = 2 }: { rows?: number }) {
  const { act } = useAdmin();
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [busy, run] = useBusy();
  const id = useId();
  const text = body.trim();

  const send = () =>
    run(async () => {
      const out = await act("announce", { body: text, urgent }, { success: "Announcement sent to everyone." });
      if (out) {
        setBody("");
        setUrgent(false);
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text && !busy) send();
      }}
    >
      <label htmlFor={id} className="label mb-1 block">
        Message
      </label>
      <textarea
        id={id}
        className="input text-[0.95rem]"
        rows={rows}
        maxLength={MAX}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Lunch is here, grab a slice in K105"
        aria-describedby={`${id}-count`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex items-center gap-4 text-sm">
          <legend className="sr-only">How loud</legend>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name={`${id}-kind`} className="accent-[var(--accent)]" checked={!urgent} onChange={() => setUrgent(false)} />
            Normal
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name={`${id}-kind`} className="accent-[var(--accent)]" checked={urgent} onChange={() => setUrgent(true)} />
            Urgent
          </label>
        </fieldset>
        <div className="flex items-center gap-3">
          <span id={`${id}-count`} className={`mono text-xs ${body.length >= MAX ? "text-amber" : "text-muted"}`}>
            {body.length} of {MAX}
          </span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!text || busy}>
            {busy ? "Sending" : "Send to all"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function AnnounceTab() {
  const { state, act } = useAdmin();
  const [busy, run] = useBusy();

  const remove = (id: number) => {
    if (!window.confirm("Delete this announcement? It will also disappear from the TV.")) return;
    run(() => act("deleteAnnouncement", { id }, { success: "Announcement deleted." }));
  };

  return (
    <div className="space-y-4">
      <Section title="Send announcement" hint="Students get a pop-up with a chime, and it shows on the TV. Urgent ones are louder and stand out more.">
        <Composer rows={4} />
      </Section>

      <Section title="Sent so far" hint={`${state.announcements.length} sent, newest first.`}>
        {state.announcements.length === 0 ? (
          <Empty>Nothing sent yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {state.announcements.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className="mono mt-0.5 w-20 shrink-0 text-xs text-muted">{timeOfDay(a.createdAt)}</span>
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{a.body}</p>
                {a.urgent ? <span className="pill pill-red shrink-0">Urgent</span> : <span className="pill shrink-0">Normal</span>}
                <button className="btn btn-danger btn-sm shrink-0" onClick={() => remove(a.id)} disabled={busy}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
