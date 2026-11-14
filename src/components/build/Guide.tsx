"use client";
import { useState } from "react";

export type GuideProgress = { idea: boolean; build: boolean; change: boolean; edit: boolean; publish: boolean; submit: boolean };

const STEPS: { key: keyof GuideProgress; title: string; how: string }[] = [
  { key: "idea", title: "Describe a problem", how: "Pick a topic or type your own idea. One or two sentences is enough." },
  { key: "build", title: "Get a first version", how: "The AI writes the code. Open the Code tab to watch it happen." },
  {
    key: "change",
    title: "Test it and ask for a change",
    how: "Click every button in your app. What is missing, wrong, or boring? Ask the AI for that in your own words.",
  },
  { key: "edit", title: "Change the code yourself", how: "Open the Code tab, change a word or a color, and watch the preview update." },
  { key: "publish", title: "Publish", how: "Press Publish to get a link anyone can open." },
  { key: "submit", title: "Submit", how: "Press Submit and tell the judges what problem your app solves." },
];

function Mark({ done, n }: { done: boolean; n: number }) {
  return (
    <span
      className={`mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.7rem] ${
        done ? "border-accent/50 bg-accent-soft text-accent" : "border-line text-muted"
      }`}
      aria-hidden
    >
      {done ? "✓" : n}
    </span>
  );
}

/** The six steps of the day. `full` lists them all; otherwise it shows the next one, with the list a tap away. */
export default function Guide({ progress, full = false }: { progress: GuideProgress; full?: boolean }) {
  const [open, setOpen] = useState(false);
  // The next step is the first open one after the furthest finished one, so a skipped step never blocks the rest.
  const last = STEPS.findLastIndex((s) => progress[s.key]);
  const next = STEPS.findIndex((s, i) => i > last && !progress[s.key]);

  const list = (
    <ol className="space-y-2">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex gap-2.5 text-sm">
          <Mark done={progress[s.key]} n={i + 1} />
          <span className={progress[s.key] ? "text-muted" : ""}>
            <span className="font-medium">{s.title}</span>
            {(full || i === next) && <span className="block text-[0.82rem] text-muted">{s.how}</span>}
            <span className="sr-only">{progress[s.key] ? " (done)" : i === next ? " (next)" : ""}</span>
          </span>
        </li>
      ))}
    </ol>
  );

  if (full) {
    return (
      <div className="mt-6" aria-label="How today works">
        <p className="label mb-2">How today works</p>
        {list}
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-line bg-panel px-3 py-2" aria-label="Guide">
      {open ? (
        list
      ) : next < 0 ? (
        <p className="text-sm">
          <span className="font-medium">You are submitted.</span>{" "}
          <span className="text-muted">Keep testing and improving until time is up, then Publish again so judges see your latest version.</span>
        </p>
      ) : (
        <div className="flex gap-2.5 text-sm">
          <Mark done={false} n={next + 1} />
          <span>
            <span className="font-medium">{STEPS[next].title}</span>
            <span className="block text-[0.82rem] text-muted">{STEPS[next].how}</span>
          </span>
        </div>
      )}
      <button className="mt-1.5 text-[0.78rem] text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Show less" : `Step ${next < 0 ? STEPS.length : next + 1} of ${STEPS.length}. See all steps`}
      </button>
    </div>
  );
}
