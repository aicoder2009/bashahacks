"use client";
import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { syntaxHighlighting } from "@codemirror/language";
import { Decoration, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const look = (dark: boolean) =>
  EditorView.theme(
    {
      "&": { backgroundColor: "var(--bg)", color: "var(--fg)", height: "100%", fontSize: "14px" },
      ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
      ".cm-gutters": { backgroundColor: "var(--bg)", color: "var(--muted)", border: "none" },
      ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--panel2) 55%, transparent)" },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--fg)" },
      ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
      "&.cm-focused": { outline: "none" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent) !important",
      },
      ".cm-bh-added": { backgroundColor: "var(--accent-soft)", boxShadow: "inset 3px 0 0 var(--accent)" },
    },
    { dark }
  );

const DARK = [look(true), syntaxHighlighting(oneDarkHighlightStyle)];
const LIGHT = [look(false)];

function highlightLines(lines: number[]) {
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  const mark = Decoration.line({ class: "cm-bh-added" });
  return EditorView.decorations.of((view) => {
    const builder = new RangeSetBuilder<Decoration>();
    for (const n of sorted) {
      if (n >= 1 && n <= view.state.doc.lines) {
        const line = view.state.doc.line(n);
        builder.add(line.from, line.from, mark);
      }
    }
    return builder.finish();
  });
}

export default function CodeEditor({
  name,
  value,
  onChange,
  readOnly,
  theme,
  highlight = [],
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  theme: "dark" | "light";
  highlight?: number[];
}) {
  const extensions = useMemo(() => {
    const lang = name.endsWith(".css") ? css() : name.endsWith(".js") ? javascript() : html();
    return [lang, EditorView.lineWrapping, highlightLines(highlight)];
  }, [name, highlight]);
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      height="100%"
      style={{ height: "100%" }}
      theme={theme === "dark" ? DARK : LIGHT}
      extensions={extensions}
      basicSetup={{ foldGutter: false, highlightActiveLine: !readOnly, autocompletion: true, searchKeymap: false }}
      aria-label={`Code editor for ${name}`}
    />
  );
}
