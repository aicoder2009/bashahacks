"use client";
import { useEffect, useMemo, useRef } from "react";
import { buildSrcdoc, SANDBOX_ATTR } from "@/lib/sandbox";
import type { Files } from "@/lib/types";

function readStore(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

/**
 * Shows a student-built app inside a locked-down iframe. The app cannot reach this site's
 * cookies or storage. Anything it saves with localStorage is kept for it under `storageKey`.
 */
export default function AppFrame({
  files,
  storageKey,
  onError,
  reloadKey = 0,
  title = "App preview",
  className = "",
}: {
  files: Files;
  storageKey: string;
  onError?: (message: string) => void;
  reloadKey?: number;
  title?: string;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const srcDoc = useMemo(() => buildSrcdoc(files, readStore(storageKey)), [files, storageKey, reloadKey]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.__bh === "storage" && d.data && typeof d.data === "object") {
        try {
          const text = JSON.stringify(d.data);
          if (text.length < 400_000) localStorage.setItem(storageKey, text);
        } catch {}
      } else if (d.__bh === "error") {
        onErrorRef.current?.(String(d.message || "Error").slice(0, 300));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [storageKey]);

  return <iframe ref={ref} title={title} sandbox={SANDBOX_ATTR} srcDoc={srcDoc} className={`h-full w-full border-0 bg-white ${className}`} />;
}
