"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import AppFrame from "@/components/AppFrame";
import Avatar from "@/components/Avatar";
import { useTheme } from "@/components/ui";
import { hasApp } from "@/lib/parse-files";
import { FILE_NAMES, type Files } from "@/lib/types";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-muted">Loading the code editor</div>,
});

const FILE_HELP: Record<string, string> = {
  "index.html": "What is on the page: headings, buttons, boxes.",
  "style.css": "How it looks: colors, sizes, spacing.",
  "script.js": "What it does: the logic behind the buttons.",
};

export default function WorkArea({
  teamId,
  files,
  previewFiles,
  liveFiles,
  highlights,
  readOnly,
  canAct,
  hasHistory,
  published,
  publishStale,
  previewError,
  onPreviewError,
  onEdit,
  onUndo,
  onHistory,
  onPublish,
  onFix,
}: {
  teamId: string;
  files: Files;
  previewFiles: Files;
  liveFiles: Files | null;
  highlights: Record<string, number[]>;
  readOnly: boolean;
  canAct: boolean;
  hasHistory: boolean;
  published: boolean;
  publishStale: boolean;
  previewError: string;
  onPreviewError: (m: string) => void;
  onEdit: (name: string, value: string) => void;
  onUndo: () => void;
  onHistory: () => void;
  onPublish: () => void;
  onFix: () => void;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [file, setFile] = useState<string>("index.html");
  const [reload, setReload] = useState(0);
  const theme = useTheme();
  const exists = hasApp(files);
  const shown = liveFiles && typeof liveFiles[file] === "string" ? liveFiles[file] : files[file] || "";
  const changed = (highlights[file] || []).length;

  const tabBtn = (id: "preview" | "code", label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      className={`mono rounded-md px-3 py-1.5 text-sm ${tab === id ? "bg-panel2 text-fg" : "text-muted hover:text-fg"}`}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Your app">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        <div role="tablist" aria-label="View" className="flex items-center gap-1">
          {tabBtn("preview", "Preview")}
          {tabBtn("code", "Code")}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {tab === "preview" && exists && (
            <button className="btn btn-ghost btn-sm" onClick={() => setReload((n) => n + 1)} title="Restart your app from the beginning">
              Restart
            </button>
          )}
          <button className="btn btn-sm" onClick={onUndo} disabled={!canAct || !hasHistory} title="Go back to how it was before the last change">
            Undo
          </button>
          <button className="btn btn-sm" onClick={onHistory} disabled={!hasHistory}>
            History
          </button>
          <button className={`btn btn-sm ${published && !publishStale ? "" : "btn-primary"}`} onClick={onPublish} disabled={!exists}>
            {published ? (publishStale ? "Publish update" : "Published ✓") : "Publish"}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {tab === "preview" ? (
          exists ? (
            <div className="flex h-full flex-col">
              {previewError && (
                <div className="flex items-center gap-3 border-b border-amber/40 bg-amber-soft px-3 py-2 text-sm text-amber">
                  <span className="min-w-0 flex-1 truncate">
                    Something in your app broke: <span className="mono">{previewError}</span>
                  </span>
                  <button className="btn btn-sm shrink-0" onClick={onFix} disabled={!canAct}>
                    Ask AI to fix this
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1 bg-white">
                <AppFrame files={previewFiles} storageKey={`bh_preview_${teamId}`} onError={onPreviewError} reloadKey={reload} title="Your app" />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex items-end gap-1 opacity-90" aria-hidden>
                <Avatar spec={{ s: 0, c: 0, e: 2, m: 1, a: 0 }} size={72} />
                <Avatar spec={{ s: 1, c: 2, e: 1, m: 0, a: 0 }} size={56} />
                <Avatar spec={{ s: 2, c: 3, e: 0, m: 1, a: 5 }} size={64} />
              </div>
              <div>
                <p className="text-lg font-semibold">Your app will show up here</p>
                <p className="mt-1 max-w-sm text-sm text-muted">Tell the AI what you want to build in the chat on the left. In about a minute you will have a working app to try.</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
              {FILE_NAMES.map((n) => (
                <button
                  key={n}
                  className={`mono rounded-md px-2.5 py-1 text-[0.8rem] ${file === n ? "bg-panel2 text-fg" : "text-muted hover:text-fg"}`}
                  onClick={() => setFile(n)}
                >
                  {n}
                  {(highlights[n] || []).length > 0 && <span className="ml-1.5 text-accent" aria-label="changed by the AI">●</span>}
                </button>
              ))}
              <span className="ml-auto hidden truncate pl-3 text-[0.8rem] text-muted md:block">
                {liveFiles ? "The AI is writing this right now" : changed ? `${changed} lines changed by the AI are marked in green` : FILE_HELP[file]}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <CodeEditor
                key={file}
                name={file}
                value={shown}
                onChange={(v) => onEdit(file, v)}
                readOnly={readOnly || !!liveFiles}
                theme={theme}
                highlight={liveFiles ? [] : highlights[file] || []}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
