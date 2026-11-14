"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Avatar from "@/components/Avatar";
import { ErrorNote, Modal } from "@/components/ui";
import { api, ApiError, timeOfDay } from "@/lib/client";
import type { Announcement, Submission, SyncResponse } from "@/lib/types";

export function PublishDialog({ open, onClose, slug, publishedAt }: { open: boolean; onClose: () => void; slug: string; publishedAt: number | null }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/p/${slug}`;
  useEffect(() => {
    if (!open || !url) return;
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#1a1915", light: "#ffffff" } })
      .then(setQr)
      .catch(() => {});
  }, [open, url]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return (
    <Modal open={open} onClose={onClose} title="Your app is live">
      <div className="space-y-4">
        <p className="text-muted">Anyone with this link can try your app. Publish again any time to update it.</p>
        <div className="flex items-center gap-2">
          <input className="input mono text-sm" readOnly value={url} aria-label="Link to your app" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn shrink-0" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {qr && (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code that opens your app" width={132} height={132} className="rounded-lg border border-line" />
            <p className="text-sm text-muted">Scan with a phone to open your app. Great for showing judges and friends.</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">{publishedAt ? `Published at ${timeOfDay(publishedAt)}` : ""}</span>
          <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
            Open my app
          </a>
        </div>
      </div>
    </Modal>
  );
}

const CATEGORIES: [string, string][] = [
  ["home", "At home"],
  ["school", "At school"],
  ["community", "In my community"],
];

export function SubmitDialog({
  open,
  onClose,
  submission,
  appTitle,
  built,
  canSubmit,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  submission: Submission | null;
  appTitle: string;
  /** True when the team has an app built on this site. Without one, a link to an outside project is needed. */
  built: boolean;
  canSubmit: boolean;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [category, setCategory] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setError("");
    setTitle(submission?.title || appTitle || "");
    setProblem(submission?.problem || "");
    setSolution(submission?.solution || "");
    setCategory(submission?.category || "");
    setLink(submission?.link || "");
    // Only when the dialog opens: do not wipe what the student is typing on every sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/submit", { title, problem, solution, category, link });
      setSent(true);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={sent ? "Submitted" : submission ? "Your submission" : "Submit your project"} wide>
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-lg">Nice work. Your {built ? "app" : "project"} is in.</p>
          <p className="text-muted">
            {built
              ? "Judges will see the newest version. You can keep building and submit again until time runs out."
              : "Judges will open your link. You can change it and submit again until time runs out."}
          </p>
          <button className="btn btn-primary" onClick={onClose}>
            Back to building
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {submission && (
            <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent">
              Submitted at {timeOfDay(submission.updatedAt)}. You can still edit until submissions close.
            </p>
          )}
          <div>
            <label htmlFor="s-title" className="mb-1 block font-medium">
              Project name
            </label>
            <input id="s-title" className="input" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} disabled={!canSubmit} />
          </div>
          <div>
            <label htmlFor="s-problem" className="mb-1 block font-medium">
              What problem did you notice?
            </label>
            <textarea
              id="s-problem"
              className="input"
              rows={3}
              placeholder="Example: Our cafeteria throws away a lot of untouched fruit every day."
              value={problem}
              onChange={(e) => setProblem(e.target.value.slice(0, 700))}
              disabled={!canSubmit}
            />
          </div>
          <div>
            <label htmlFor="s-solution" className="mb-1 block font-medium">
              What is your project, and how does it help?
            </label>
            <textarea
              id="s-solution"
              className="input"
              rows={3}
              placeholder="Example: Students log what they did not eat so the cafeteria can see what to serve less of."
              value={solution}
              onChange={(e) => setSolution(e.target.value.slice(0, 700))}
              disabled={!canSubmit}
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 font-medium">Where does this problem happen?</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(([id, label]) => (
                <label
                  key={id}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${category === id ? "border-accent bg-accent-soft text-accent" : "border-line bg-panel hover:bg-panel2"}`}
                >
                  <input type="radio" name="category" value={id} checked={category === id} onChange={() => setCategory(id)} className="sr-only" disabled={!canSubmit} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="s-link" className="mb-1 block font-medium">
              Link to your project {built ? <span className="font-normal text-muted">(only if you built it somewhere else)</span> : null}
            </label>
            <input
              id="s-link"
              className="input"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://"
              value={link}
              onChange={(e) => setLink(e.target.value.trim().slice(0, 300))}
              disabled={!canSubmit}
            />
            <p className="mt-1 text-sm text-muted">
              {built
                ? "Leave this empty to submit the app you built here."
                : "You have not built an app here, and that is fine. Paste a link judges can open to see what you made. If it only runs on your laptop, paste its localhost address."}
            </p>
          </div>
          <ErrorNote>{error}</ErrorNote>
          {canSubmit ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {built ? "Submitting also publishes your newest version for the judges." : "Judges will open your link to see your project."}
              </p>
              <button className="btn btn-primary" disabled={busy}>
                {submission ? "Update submission" : "Submit"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">Submissions are closed.</p>
          )}
        </form>
      )}
    </Modal>
  );
}

type VersionItem = { id: number; label: string; kind: string; createdAt: number; by: string | null };

export function HistoryDialog({ open, onClose, canRestore, onRestore }: { open: boolean; onClose: () => void; canRestore: boolean; onRestore: (id: number) => void }) {
  const [items, setItems] = useState<VersionItem[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setItems(null);
    api<{ versions: VersionItem[] }>("/api/project")
      .then((d) => setItems(d.versions))
      .catch(() => setItems([]));
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="History">
      <p className="mb-3 text-sm text-muted">Every change is saved. Pick one to go back to how your app was at that point.</p>
      {items === null ? (
        <p className="text-sm text-muted">Loading</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No changes yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((v, i) => (
            <li key={v.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <span className={`pill ${v.kind === "ai" ? "pill-green" : ""}`}>{v.kind === "ai" ? "AI" : v.kind === "manual" ? "You" : "Back"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{v.label}</span>
                <span className="mono block text-[0.72rem] text-muted">
                  {timeOfDay(v.createdAt)}
                  {v.by ? ` · ${v.by}` : ""}
                </span>
              </span>
              {i === 0 ? (
                <span className="label">Current</span>
              ) : (
                <button className="btn btn-sm" disabled={!canRestore} onClick={() => onRestore(v.id)}>
                  Go back to this
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

export function TeamDialog({
  open,
  onClose,
  sync,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  sync: SyncResponse;
  onChanged: () => void;
}) {
  const { team, me, event } = sync;
  const [error, setError] = useState("");
  const invite = async () => {
    setError("");
    try {
      await api("/api/team", { action: "open" });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  };
  const leave = async () => {
    if (!window.confirm(`Sign out on this computer? To get back in you will need your code: ${team.code}`)) return;
    await api("/api/logout", { role: "student" }).catch(() => {});
    // A full page load on purpose, so nothing from this student's session stays in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/join";
  };
  return (
    <Modal open={open} onClose={onClose} title={team.solo ? "Building solo" : `Team ${team.name}`}>
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-bg p-4 text-center">
          <p className="label mb-1">{team.solo ? "Your code to get back in" : "Team code"}</p>
          <p className="mono text-4xl font-semibold tracking-[0.35em] text-accent">{team.code}</p>
          <p className="mt-2 text-sm text-muted">
            {team.solo ? "If you switch computers, use this code on the first page to get back to your app." : "Teammates type this code on the first page to join you."}
          </p>
        </div>
        <ul className="space-y-1.5">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <Avatar spec={m.avatar} size={32} />
              <span className="flex-1 font-medium">
                {m.name}
                {m.id === me.id ? <span className="ml-2 text-sm font-normal text-muted">you</span> : null}
              </span>
              <span className={`pill ${m.online ? "pill-green" : ""}`}>{m.online ? "here" : "away"}</span>
            </li>
          ))}
        </ul>
        {team.solo && event.teamsAllowed && (
          <div className="rounded-lg border border-line p-3">
            <p className="text-sm">Want a partner? Turn your project into a team and share the code above.</p>
            <button className="btn btn-sm mt-2" onClick={invite}>
              Invite a teammate
            </button>
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-between">
          <button className="btn btn-ghost btn-sm text-muted" onClick={leave}>
            Sign out on this computer
          </button>
          <button className="btn btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AnnouncementBanner({ item, onDismiss }: { item: Announcement | null; onDismiss: () => void }) {
  if (!item) return null;
  return (
    <div className="slide-down fixed left-1/2 top-3 z-40 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2" role="status" aria-live="polite">
      <div className="card flex items-start gap-3 border-accent/60 p-4 shadow-2xl">
        <span className="mt-0.5 text-accent" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="label mb-0.5">Announcement · {timeOfDay(item.createdAt)}</p>
          <p className="whitespace-pre-wrap break-words">{item.body}</p>
        </div>
        <button className="btn btn-sm shrink-0" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}

export function UrgentDialog({ item, onDismiss }: { item: Announcement | null; onDismiss: () => void }) {
  return (
    <Modal open={!!item} onClose={onDismiss} title="Important announcement" dismissable={false}>
      {item && (
        <div className="space-y-4">
          <p className="whitespace-pre-wrap break-words rounded-lg border border-red/40 bg-red-soft p-4 text-lg">{item.body}</p>
          <div className="flex items-center justify-between">
            <span className="label">{timeOfDay(item.createdAt)}</span>
            <button className="btn btn-primary" onClick={onDismiss} autoFocus>
              I got it
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function InboxDialog({ open, onClose, items }: { open: boolean; onClose: () => void; items: Announcement[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Announcements">
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. Announcements from the officers will show up here.</p>
      ) : (
        <ul className="space-y-2">
          {[...items].reverse().map((a) => (
            <li key={a.id} className={`rounded-lg border px-3 py-2 ${a.urgent ? "border-red/40 bg-red-soft" : "border-line"}`}>
              <p className="label mb-0.5">
                {timeOfDay(a.createdAt)}
                {a.urgent ? " · Important" : ""}
              </p>
              <p className="whitespace-pre-wrap break-words">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
