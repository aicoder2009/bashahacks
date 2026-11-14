import { FILE_NAMES, type Files } from "./types";

export type ParsedFile = { name: string; content: string; complete: boolean };
export type ParsedOutput = { text: string; files: ParsedFile[]; suggestions: string[] };

const ALLOWED = new Set<string>(FILE_NAMES);

function stripFences(content: string): string {
  let c = content.replace(/^\s*\n/, "");
  c = c.replace(/^```[a-zA-Z]*\s*\n/, "");
  c = c.replace(/\n```\s*$/, "\n");
  return c.replace(/\s+$/, "") + "\n";
}

/**
 * Splits raw AI output into the chat text, the file blocks, and the suggestion chips.
 * Safe to call on partial output while it is still streaming.
 */
export function parseAiOutput(raw: string): ParsedOutput {
  const files: ParsedFile[] = [];
  let text = "";
  let rest = raw;

  const open = /<file\s+name=["']([^"'>]+)["']\s*>/;
  for (;;) {
    const m = open.exec(rest);
    if (!m) break;
    text += rest.slice(0, m.index);
    const after = rest.slice(m.index + m[0].length);
    const end = after.indexOf("</file>");
    const name = m[1].trim().toLowerCase().replace(/^\.?\//, "");
    if (end < 0) {
      // Drop a half-written closing tag from the visible content.
      const content = after.replace(/<\/?f?i?l?e?$/, "");
      if (ALLOWED.has(name)) files.push({ name, content: stripFences(content), complete: false });
      rest = "";
      break;
    }
    if (ALLOWED.has(name)) files.push({ name, content: stripFences(after.slice(0, end)), complete: true });
    rest = after.slice(end + "</file>".length);
  }
  text += rest;

  let suggestions: string[] = [];
  const s = /<suggestions>([\s\S]*?)<\/suggestions>/.exec(text);
  if (s) {
    suggestions = s[1]
      .split("\n")
      .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
      .filter((l) => l.length > 1 && l.length <= 70)
      .slice(0, 3);
    text = text.replace(s[0], "");
  } else {
    const i = text.indexOf("<suggestions>");
    if (i >= 0) text = text.slice(0, i);
  }

  // Fallback: some models answer with a markdown code block instead of file tags.
  if (files.length === 0) {
    const fence = /```html\s*\n([\s\S]*?)(```|$)/.exec(text);
    if (fence && /<html|<!doctype|<body/i.test(fence[1])) {
      files.push({ name: "index.html", content: stripFences(fence[1]), complete: fence[2] === "```" });
      text = text.replace(fence[0], "");
    }
  }

  // Hide a tag that has only partly arrived.
  text = text.replace(/<[a-z/]*$/i, "").replace(/\n{3,}/g, "\n\n").trim();
  return { text, files, suggestions };
}

export function applyFiles(current: Files, parsed: ParsedFile[]): { files: Files; changed: string[] } {
  const next: Files = { ...current };
  const changed: string[] = [];
  for (const f of parsed) {
    if (!f.complete) continue;
    if (next[f.name] !== f.content) {
      next[f.name] = f.content;
      changed.push(f.name);
    }
  }
  return { files: next, changed };
}

export function hasApp(files: Files | null | undefined): boolean {
  return !!files && typeof files["index.html"] === "string" && files["index.html"].trim().length > 0;
}

export function appTitle(files: Files): string | null {
  const m = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(files["index.html"] || "");
  return m ? m[1].trim() : null;
}

export function cleanFiles(input: unknown, maxTotal = 300_000): Files | null {
  if (!input || typeof input !== "object") return null;
  const out: Files = {};
  let total = 0;
  for (const name of FILE_NAMES) {
    const v = (input as Record<string, unknown>)[name];
    if (typeof v === "string") {
      out[name] = v;
      total += v.length;
    }
  }
  return total > maxTotal ? null : out;
}

/**
 * Combines hand edits from two teammates who both started from `base`. Each file goes to whoever
 * changed it. Returns null when both changed the same file in different ways.
 */
export function mergeFiles(base: Files, mine: Files, theirs: Files): Files | null {
  const out: Files = { ...theirs };
  for (const name of FILE_NAMES) {
    const b = base[name] ?? "";
    const m = mine[name] ?? "";
    const t = theirs[name] ?? "";
    if (m === b || m === t) continue;
    if (t !== b) return null;
    out[name] = m;
  }
  return out;
}
