"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ChatPanel, { type Streaming } from "@/components/build/ChatPanel";
import TopBar from "@/components/build/TopBar";
import WorkArea from "@/components/build/WorkArea";
import {
  AnnouncementBanner,
  HistoryDialog,
  InboxDialog,
  PublishDialog,
  SubmitDialog,
  TeamDialog,
  UrgentDialog,
} from "@/components/build/Dialogs";
import { Confetti, Logo } from "@/components/ui";
import { api, ApiError, chime, useNow, usePoll } from "@/lib/client";
import { mergeFiles, parseAiOutput } from "@/lib/parse-files";
import type { Announcement, ChatMessage, Files, SyncResponse } from "@/lib/types";

/** Line numbers in `next` that were not in `prev`, so the editor can mark what the AI changed. */
function changedLines(prev: string, next: string): number[] {
  if (!prev) return [];
  const old = new Set(prev.split("\n").map((l) => l.trim()));
  const out: number[] = [];
  next.split("\n").forEach((line, i) => {
    if (line.trim() && !old.has(line.trim())) out.push(i + 1);
  });
  return out.length > 400 ? [] : out;
}

const readNum = (key: string) => {
  try {
    return Number(localStorage.getItem(key) || 0) || 0;
  } catch {
    return 0;
  }
};
const writeStr = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export default function BuildPage() {
  const router = useRouter();
  const [sync, setSync] = useState<SyncResponse | null>(null);
  const [files, setFiles] = useState<Files>({});
  const [previewFiles, setPreviewFiles] = useState<Files>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [highlights, setHighlights] = useState<Record<string, number[]>>({});
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<"" | "publish" | "submit" | "history" | "team" | "inbox">("");
  const [banner, setBanner] = useState<Announcement | null>(null);
  const [urgent, setUrgent] = useState<Announcement[]>([]);
  const [seenAnn, setSeenAnn] = useState(0);
  const [burst, setBurst] = useState(0);
  const [toast, setToast] = useState("");
  const [edited, setEdited] = useState(false);

  const versionRef = useRef(-1);
  const lastMsg = useRef(0);
  const lastAnn = useRef(0);
  const filesRef = useRef<Files>({});
  const baseRef = useRef<Files>({}); // the files as the server last had them
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  const milestones = useRef<Record<string, number>>({});
  const rawRef = useRef("");

  const now = useNow(offset, 500);

  const say = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);

  useEffect(() => {
    setSeenAnn(readNum("bh_ann_seen"));
  }, []);

  // The guide's "change the code yourself" step is remembered in this browser, per team.
  const teamId = sync?.team.id;
  useEffect(() => {
    if (teamId) setEdited(!!readNum(`bh_edited_${teamId}`));
  }, [teamId]);

  const markSeen = useCallback((id: number) => {
    setSeenAnn((cur) => {
      const next = Math.max(cur, id);
      writeStr("bh_ann_seen", String(next));
      return next;
    });
  }, []);

  const applyFiles = useCallback((next: Files, version: number) => {
    filesRef.current = next;
    baseRef.current = next;
    versionRef.current = version;
    dirtyRef.current = false;
    setFiles(next);
    setPreviewFiles(next);
    setPreviewError("");
  }, []);

  const doSync = useCallback(async () => {
    let resp: SyncResponse;
    try {
      resp = await api<SyncResponse>(`/api/sync?v=${versionRef.current}&m=${lastMsg.current}&a=${lastAnn.current}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/join");
      return;
    }
    setOffset(resp.now - Date.now());
    const isFirst = first.current;

    // Take newer files from the server unless this student has typing that is not saved yet.
    if (resp.files && !dirtyRef.current && !savingRef.current && (versionRef.current === -1 || resp.team.version > versionRef.current)) {
      const prev = filesRef.current;
      const fromAi = !isFirst && resp.messages.some((m) => m.role === "assistant" && (m.meta.files || []).length > 0);
      if (fromAi) {
        const marks: Record<string, number[]> = {};
        for (const name of Object.keys(resp.files)) marks[name] = changedLines(prev[name] || "", resp.files[name] || "");
        setHighlights(marks);
      } else setHighlights({});
      applyFiles(resp.files, resp.team.version);
    }

    if (resp.messages.length) {
      const fresh = resp.messages.filter((m) => m.id > lastMsg.current);
      if (fresh.length) {
        lastMsg.current = fresh[fresh.length - 1].id;
        setMessages((cur) => [...cur, ...fresh]);
        // An answer arrived, so a note such as "a teammate is already asking" no longer applies.
        if (fresh.some((m) => m.role === "assistant")) setNotice("");
      }
    }

    if (resp.announcements.length) {
      const fresh = resp.announcements.filter((a) => a.id > lastAnn.current);
      if (fresh.length) {
        lastAnn.current = fresh[fresh.length - 1].id;
        setAnns((cur) => [...cur, ...fresh]);
        if (!isFirst) {
          const urgentOnes = fresh.filter((a) => a.urgent);
          const normal = fresh.filter((a) => !a.urgent);
          chime(urgentOnes.length > 0);
          if (urgentOnes.length) setUrgent((cur) => [...cur, ...urgentOnes]);
          if (normal.length) setBanner(normal[normal.length - 1]);
        }
      }
    }

    // Small celebrations when a step is finished for the first time.
    const ms = resp.team.milestones || {};
    if (!isFirst) {
      if (ms.submit && !milestones.current.submit) {
        setBurst((n) => n + 1);
        say("Submitted. Nice work.");
      } else if (ms.publish && !milestones.current.publish) {
        setBurst((n) => n + 1);
        say("Your app is live for anyone with the link.");
      } else if (ms.build && !milestones.current.build) {
        setBurst((n) => n + 1);
        say("Your first app is built. Try it out on the right.");
      }
      const pct = resp.team.usage.pctLeft;
      if (pct < 0.25 && pct > 0 && !readNum("bh_low_warned")) {
        writeStr("bh_low_warned", "1");
        say("Heads up: about a quarter of your AI usage is left. Make each request count by saying exactly what you want.");
      }
    }
    milestones.current = ms;
    first.current = false;
    setSync(resp);
  }, [applyFiles, router, say]);

  usePoll(doSync, 2500);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    if (savingRef.current) {
      saveTimer.current = setTimeout(save, 400);
      return;
    }
    savingRef.current = true;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const snapshot = filesRef.current;
        try {
          const out = await api<{ version: number }>("/api/project", { action: "save", files: snapshot, baseVersion: versionRef.current });
          versionRef.current = out.version;
          baseRef.current = snapshot;
          if (filesRef.current === snapshot) dirtyRef.current = false;
          else saveTimer.current = setTimeout(save, 600);
          return;
        } catch (e) {
          // A teammate saved first. If they changed a different file, keep both edits and save again.
          const conflict = e instanceof ApiError && e.data.conflict ? e.data : null;
          const theirs = conflict?.files as Files | undefined;
          const merged = theirs ? mergeFiles(baseRef.current, filesRef.current, theirs) : null;
          if (!theirs || !merged) {
            // Same file changed twice, the AI is working, or building closed: drop local typing and load the newest version.
            dirtyRef.current = false;
            versionRef.current = -1;
            if (e instanceof ApiError) say(e.message);
            return;
          }
          baseRef.current = theirs;
          versionRef.current = Number(conflict?.version);
          filesRef.current = merged;
          setFiles(merged);
          setPreviewFiles(merged);
        }
      }
      saveTimer.current = setTimeout(save, 600);
    } finally {
      savingRef.current = false;
    }
  }, [say]);

  const onEdit = useCallback(
    (name: string, value: string) => {
      if (filesRef.current[name] === value) return;
      const next = { ...filesRef.current, [name]: value };
      filesRef.current = next;
      dirtyRef.current = true;
      setFiles(next);
      if (teamId) {
        writeStr(`bh_edited_${teamId}`, "1");
        setEdited(true);
      }
      setHighlights((h) => ((h[name] || []).length ? { ...h, [name]: [] } : h));
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => {
        setPreviewError("");
        setPreviewFiles(filesRef.current);
      }, 500);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(save, 900);
    },
    [save, teamId]
  );

  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (dirtyRef.current) await save();
  }, [save]);

  const send = useCallback(
    async (text: string) => {
      setNotice("");
      setDraft("");
      rawRef.current = "";
      setStreaming({ userText: text, userMessageId: null, raw: "" });
      await flush();
      let lastPaint = 0;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setNotice(String(data.error || "The AI could not start. Try again."));
          setDraft(text);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (!line.trim()) continue;
            let ev: { t: string; v?: string; userMessageId?: number };
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            if (ev.t === "start") setStreaming((s) => (s ? { ...s, userMessageId: ev.userMessageId ?? null } : s));
            else if (ev.t === "d" && ev.v) {
              rawRef.current += ev.v;
              const t = performance.now();
              if (t - lastPaint > 90) {
                lastPaint = t;
                const raw = rawRef.current;
                setStreaming((s) => (s ? { ...s, raw } : s));
              }
            }
          }
        }
      } catch {
        setNotice("The connection dropped while the AI was working. Your app will update here when it finishes.");
      } finally {
        await doSync();
        setStreaming(null);
      }
    },
    [doSync, flush]
  );

  const projectAction = useCallback(
    async (body: object) => {
      await flush();
      try {
        const out = await api<{ version: number; files?: Files }>("/api/project", body);
        if (out.files) {
          setHighlights({});
          applyFiles(out.files, out.version);
        }
        say("Done. Your app is back to that version.");
      } catch (e) {
        say(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      }
    },
    [applyFiles, flush, say]
  );

  const publish = useCallback(async () => {
    if (!sync) return;
    const stale = sync.team.publishedVersion !== versionRef.current || dirtyRef.current;
    if (sync.team.publishedAt && !stale) return setDialog("publish");
    await flush();
    try {
      await api("/api/publish", {});
      await doSync();
      setDialog("publish");
    } catch (e) {
      say(e instanceof ApiError ? e.message : "Could not publish. Try again.");
    }
  }, [doSync, flush, say, sync]);

  const liveFiles = useMemo(() => {
    if (!streaming) return null;
    const parsed = parseAiOutput(streaming.raw);
    if (!parsed.files.length) return null;
    const out: Files = {};
    for (const f of parsed.files) out[f.name] = f.content;
    return out;
  }, [streaming]);

  if (!sync) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4">
        <Logo size="lg" />
        <div className="flex items-center gap-2 text-muted">
          <span className="pulse-dot" aria-hidden />
          Opening your workspace
        </div>
      </main>
    );
  }

  const { team, event, me } = sync;
  const building = event.phase === "hacking";
  const busyNote = team.busy && !streaming ? (team.busy.memberId === me.id ? "The AI is still working on your last request" : `${team.busy.name} is asking the AI`) : null;
  const canAct = building && !team.busy && !streaming;
  const ms = team.milestones || {};
  const guide = {
    idea: !!ms.idea || !!streaming,
    build: !!ms.build,
    // Two AI answers that changed files means the first version got at least one change.
    change: messages.filter((m) => m.role === "assistant" && (m.meta.files || []).length > 0).length > 1,
    edit: edited,
    publish: !!ms.publish,
    submit: !!ms.submit,
  };
  const unread = anns.filter((a) => a.id > seenAnn).length;

  return (
    <div className="flex h-screen min-h-0 flex-col">
      <TopBar
        sync={sync}
        now={now}
        unread={unread}
        onBell={() => {
          setDialog("inbox");
          markSeen(lastAnn.current);
        }}
        onTeam={() => setDialog("team")}
        onSubmit={() => setDialog("submit")}
      />

      {event.phase !== "hacking" && event.phase !== "lobby" && (
        <div className="border-b border-line bg-panel px-4 py-2 text-center text-sm">
          Time is up. {sync.submission ? "Your app is submitted, and judges will come around to see it." : "Judges will come around to see what you built."}
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[45%_55%] md:grid-cols-[minmax(320px,36%)_1fr] md:grid-rows-1">
        <div className="min-h-0 border-b border-line md:border-b-0 md:border-r">
          <ChatPanel
            messages={messages}
            members={team.members}
            meId={me.id}
            streaming={streaming}
            busyNote={busyNote}
            phase={event.phase}
            startsAt={event.startsAt}
            usage={team.usage}
            notice={notice}
            guide={guide}
            onSend={send}
            draft={draft}
            setDraft={setDraft}
          />
        </div>
        <div className="min-h-0">
          <WorkArea
            teamId={team.id}
            files={files}
            previewFiles={previewFiles}
            liveFiles={liveFiles}
            highlights={highlights}
            readOnly={!canAct}
            canAct={canAct}
            hasHistory={team.version > 0}
            published={!!team.publishedAt}
            publishStale={team.publishedVersion !== team.version}
            previewError={previewError}
            onPreviewError={setPreviewError}
            onEdit={onEdit}
            onUndo={() => projectAction({ action: "undo" })}
            onHistory={() => setDialog("history")}
            onPublish={publish}
            onFix={() => send(`My app shows this error: "${previewError}". Please find the cause and fix it.`)}
          />
        </div>
      </main>

      <PublishDialog open={dialog === "publish"} onClose={() => setDialog("")} slug={team.slug} publishedAt={team.publishedAt} />
      <SubmitDialog
        open={dialog === "submit"}
        onClose={() => setDialog("")}
        submission={sync.submission}
        appTitle={team.appTitle || ""}
        canSubmit={building}
        onDone={doSync}
      />
      <HistoryDialog
        open={dialog === "history"}
        onClose={() => setDialog("")}
        canRestore={canAct}
        onRestore={(id) => {
          setDialog("");
          projectAction({ action: "restore", versionId: id });
        }}
      />
      <TeamDialog open={dialog === "team"} onClose={() => setDialog("")} sync={sync} onChanged={doSync} />
      <InboxDialog open={dialog === "inbox"} onClose={() => setDialog("")} items={anns} />

      <AnnouncementBanner
        item={urgent.length ? null : banner}
        onDismiss={() => {
          if (banner) markSeen(banner.id);
          setBanner(null);
        }}
      />
      <UrgentDialog
        item={urgent[0] || null}
        onDismiss={() => {
          if (urgent[0]) markSeen(urgent[0].id);
          setUrgent((cur) => cur.slice(1));
        }}
      />

      {toast && (
        <div className="fade-in pointer-events-none fixed bottom-5 right-5 z-40 w-[min(26rem,calc(100vw-2.5rem))]" role="status" aria-live="polite">
          <div className="card border-accent/50 px-4 py-3 text-sm shadow-2xl">{toast}</div>
        </div>
      )}
      <Confetti burst={burst} />
    </div>
  );
}
