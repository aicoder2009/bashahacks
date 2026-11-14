"use client";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import Guide, { type GuideProgress } from "./Guide";
import { parseAiOutput } from "@/lib/parse-files";
import { timeOfDay } from "@/lib/client";
import type { ChatMessage, MemberView, Phase, UsageView } from "@/lib/types";

export type Streaming = { userText: string; userMessageId: number | null; raw: string };

const IDEAS: { title: string; blurb: string; icon: React.ReactNode; prompts: string[] }[] = [
  {
    title: "Wasted food",
    blurb: "Lunches tossed, leftovers forgotten",
    icon: <path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6 0 8v10" />,
    prompts: [
      "Build a fridge tracker that reminds me to eat food before it goes bad",
      "Make an app where my family logs leftovers and gets ideas for using them",
    ],
  },
  {
    title: "Water use",
    blurb: "Long showers, running taps",
    icon: <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />,
    prompts: [
      "Build a shower timer that shows how many gallons I used and my best streak",
      "Make a daily water tracker for my house with a weekly goal",
    ],
  },
  {
    title: "Reuse",
    blurb: "Things thrown away too soon",
    icon: <path d="M7 7h8l-2-3M17 17H9l2 3M5 14l-2-4 4-1M19 10l2 4-4 1" />,
    prompts: [
      "Build a swap board where students list things they no longer need",
      "Make a quiz that tells me if something can be recycled, reused, or composted",
    ],
  },
  {
    title: "Clean community",
    blurb: "Litter at school and in parks",
    icon: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
    prompts: [
      "Build a cleanup tracker where our club logs bags of trash picked up",
      "Make a map-style checklist of spots around school that need cleaning",
    ],
  },
];

function Text({ children }: { children: string }) {
  // Keep it simple: plain text with line breaks, and drop markdown bold markers.
  return <div className="whitespace-pre-wrap break-words leading-relaxed">{children.replace(/\*\*(.+?)\*\*/g, "$1")}</div>;
}

function FileRow({ name, state }: { name: string; state: "writing" | "wrote" }) {
  return (
    <div className="mono flex items-center gap-2 text-[0.8rem] text-muted">
      <span className="text-line" aria-hidden>
        │
      </span>
      {state === "writing" ? <span className="pulse-dot !h-1.5 !w-1.5" aria-hidden /> : <span className="text-accent" aria-hidden>✓</span>}
      <span>
        {state === "writing" ? "writing" : "wrote"} {name}
      </span>
    </div>
  );
}

export default function ChatPanel({
  messages,
  members,
  meId,
  streaming,
  busyName,
  phase,
  startsAt,
  usage,
  notice,
  guide,
  onSend,
  draft,
  setDraft,
}: {
  messages: ChatMessage[];
  members: MemberView[];
  meId: string;
  streaming: Streaming | null;
  busyName: string | null;
  phase: Phase;
  startsAt: number;
  usage: UsageView;
  notice: string;
  guide: GuideProgress;
  onSend: (text: string) => void;
  draft: string;
  setDraft: (v: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [openIdea, setOpenIdea] = useState<number | null>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, busyName, notice]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [draft]);

  const live = streaming ? parseAiOutput(streaming.raw) : null;
  const showPendingUser = streaming && !messages.some((m) => m.id === streaming.userMessageId);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions = !streaming && !busyName && phase === "hacking" && !usage.blocked ? lastAssistant?.meta.suggestions || [] : [];

  let disabledReason = "";
  if (phase === "lobby") disabledReason = `Building opens at ${timeOfDay(startsAt)}. Think about your idea while you wait.`;
  else if (phase !== "hacking") disabledReason = "Time is up. Building is closed.";
  else if (usage.blocked) {
    disabledReason =
      usage.reason === "cap"
        ? "Your team has used all of its AI for now. Ask an officer for more."
        : usage.reason === "paused"
          ? "AI is paused for your team right now. Ask an officer."
          : "AI is paused for everyone for a moment. An officer will turn it back on.";
  } else if (busyName) disabledReason = `${busyName} is asking the AI. You can send when it finishes.`;
  const canType = !disabledReason && !streaming;

  const send = () => {
    const text = draft.trim();
    if (!text || !canType) return;
    stick.current = true;
    onSend(text);
  };

  const use = (text: string) => {
    setDraft(text);
    setTimeout(() => input.current?.focus(), 0);
  };

  const empty = messages.length === 0 && !streaming;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Chat with the AI">
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {empty ? (
          <div className="mx-auto max-w-md">
            <p className="label mb-2">Step 1</p>
            <h2 className="text-xl font-semibold">What problem have you noticed?</h2>
            <p className="mt-1 text-sm text-muted">
              Pick a topic for ideas, or just describe your own in the box below. The AI writes the code, and you tell it what to change.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {IDEAS.map((idea, i) => (
                <button
                  key={idea.title}
                  className={`card p-3 text-left transition-colors hover:bg-panel2 ${openIdea === i ? "!border-accent bg-accent-soft" : ""}`}
                  onClick={() => setOpenIdea(openIdea === i ? null : i)}
                  aria-expanded={openIdea === i}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-accent" aria-hidden>
                    {idea.icon}
                  </svg>
                  <span className="block font-medium">{idea.title}</span>
                  <span className="block text-[0.8rem] text-muted">{idea.blurb}</span>
                </button>
              ))}
            </div>
            {openIdea !== null && (
              <div className="fade-in mt-3 space-y-2">
                <p className="label">Tap one to start with it</p>
                {IDEAS[openIdea].prompts.map((p) => (
                  <button key={p} className="card w-full p-3 text-left text-sm hover:bg-panel2" onClick={() => use(p)}>
                    <span className="mono mr-2 text-accent" aria-hidden>
                      &gt;
                    </span>
                    {p}
                  </button>
                ))}
              </div>
            )}
            <Guide progress={guide} full />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => {
              if (m.role === "user") {
                const who = members.find((x) => x.id === m.memberId);
                return (
                  <div key={m.id} className="rounded-lg border border-line bg-panel px-3 py-2.5">
                    {members.length > 1 && who ? (
                      <div className="mb-1 flex items-center gap-1.5 text-[0.78rem] text-muted">
                        <Avatar spec={who.avatar} size={18} />
                        <span>{who.id === meId ? "You" : who.name}</span>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <span className="mono text-accent" aria-hidden>
                        &gt;
                      </span>
                      <Text>{m.content}</Text>
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className="space-y-1.5 px-1">
                  {m.content ? <Text>{m.content}</Text> : null}
                  {(m.meta.files || []).map((f) => (
                    <FileRow key={f} name={f} state="wrote" />
                  ))}
                  {m.meta.error ? <p className="rounded-lg border border-amber/40 bg-amber-soft px-3 py-2 text-sm text-amber">{m.meta.error}</p> : null}
                </div>
              );
            })}

            {showPendingUser && streaming ? (
              <div className="rounded-lg border border-line bg-panel px-3 py-2.5 opacity-80">
                <div className="flex gap-2">
                  <span className="mono text-accent" aria-hidden>
                    &gt;
                  </span>
                  <Text>{streaming.userText}</Text>
                </div>
              </div>
            ) : null}

            {streaming && live ? (
              <div className="space-y-1.5 px-1" aria-live="polite">
                {live.text ? <Text>{live.text}</Text> : null}
                {live.files.map((f) => (
                  <FileRow key={f.name} name={f.name} state={f.complete ? "wrote" : "writing"} />
                ))}
                <div className="flex items-center gap-2 pt-1 text-sm text-muted">
                  <span className="pulse-dot" aria-hidden />
                  <span>{live.files.length ? "Building your app" : live.text ? "Writing" : "Thinking"}</span>
                </div>
              </div>
            ) : null}

            {!streaming && busyName ? (
              <div className="flex items-center gap-2 px-1 text-sm text-muted" aria-live="polite">
                <span className="pulse-dot" aria-hidden />
                <span>{busyName} is asking the AI</span>
              </div>
            ) : null}

            {notice ? <p className="rounded-lg border border-amber/40 bg-amber-soft px-3 py-2 text-sm text-amber">{notice}</p> : null}
          </div>
        )}
      </div>

      <div className="border-t border-line px-3 pb-3 pt-2">
        {!empty && (phase === "hacking" || phase === "lobby") && <Guide progress={guide} />}
        {suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="label mr-1">Try next</span>
            {suggestions.map((s) => (
              <button key={s} className="rounded-full border border-line bg-panel px-2.5 py-1 text-[0.82rem] hover:bg-panel2" onClick={() => use(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {disabledReason ? (
          <p className="rounded-lg border border-line bg-panel px-3 py-3 text-sm text-muted">{disabledReason}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 rounded-lg border border-line bg-panel px-3 py-2 focus-within:border-accent"
          >
            <span className="mono pb-1.5 text-accent" aria-hidden>
              &gt;
            </span>
            <label htmlFor="chat-input" className="sr-only">
              Tell the AI what to build or change
            </label>
            <textarea
              id="chat-input"
              ref={input}
              rows={1}
              className="max-h-40 min-h-[2rem] flex-1 resize-none bg-transparent py-1 outline-none placeholder:text-muted"
              placeholder={empty ? "Describe the app you want to build" : "Ask for a change"}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={!!streaming}
            />
            <button className="btn btn-primary btn-sm" disabled={!draft.trim() || !canType}>
              {streaming ? "Working" : "Send"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
