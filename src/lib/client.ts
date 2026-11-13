"use client";
import { useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Small fetch wrapper: JSON in, JSON out, friendly error messages. */
export async function api<T = Record<string, unknown>>(path: string, body?: unknown, method?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach the server. Check the internet connection and try again.", 0, {});
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new ApiError(String(data.error || "Something went wrong. Try again."), res.status, data);
  return data as T;
}

/** Ticks every `ms` and returns the current time, corrected by the server clock offset. */
export function useNow(offsetMs = 0, ms = 500): number {
  const [t, setT] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now() + offsetMs), ms);
    return () => clearInterval(id);
  }, [offsetMs, ms]);
  return t;
}

/** Calls `fn` now and then every `ms`, never overlapping, pausing while the tab is hidden. */
export function usePoll(fn: () => Promise<void>, ms: number, enabled = true): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      try {
        await ref.current();
      } catch {}
      if (!stop) timer = setTimeout(tick, document.hidden ? ms * 3 : ms);
    };
    tick();
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

/** A short, soft two-note chime made with the Web Audio API (no sound file needed). */
export function chime(urgent = false): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = urgent ? [880, 880, 1174] : [784, 1046];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
