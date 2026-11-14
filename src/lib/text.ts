import type { AvatarSpec } from "./types";

const BLOCK = [
  "fuck", "shit", "bitch", "cunt", "nigg", "fag", "dick", "cock", "pussy", "penis", "vagina", "slut", "whore",
  "rape", "nazi", "hitler", "porn", "sex", "anal", "boob", "cum", "retard", "kys",
];

export function cleanText(input: unknown, max: number): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanMultiline(input: unknown, max: number): string {
  return String(input ?? "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function isRude(text: string): boolean {
  const flat = text.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCK.some((w) => flat.includes(w));
}

export const AVATAR_LIMITS = { s: 10, c: 8, e: 6, m: 6, a: 7 };

export function cleanAvatar(input: unknown): AvatarSpec {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const pick = (k: keyof typeof AVATAR_LIMITS) => {
    const n = Math.floor(Number(src[k]));
    return Number.isFinite(n) && n >= 0 && n < AVATAR_LIMITS[k] ? n : 0;
  };
  return { s: pick("s"), c: pick("c"), e: pick("e"), m: pick("m"), a: pick("a") };
}

export function avatarFromSeed(seed: string): AvatarSpec {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = (n: number) => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return Math.abs(h) % n;
  };
  return {
    s: next(AVATAR_LIMITS.s),
    c: next(AVATAR_LIMITS.c),
    e: next(AVATAR_LIMITS.e),
    m: next(AVATAR_LIMITS.m),
    a: next(AVATAR_LIMITS.a),
  };
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Whole percent of AI left, for the usage bars. Rounds down so the first request already reads 99,
 * and stays at 1 or more until the AI is really used up.
 */
export function percentLeft(share: number, usedUp = false): number {
  if (usedUp || !(share > 0)) return 0;
  return Math.min(100, Math.max(1, Math.floor(share * 100 + 1e-6)));
}
