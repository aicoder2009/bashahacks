import { createHmac, createHash, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes } from "crypto";

export type StudentSession = { memberId: string; teamId: string };
export type JudgeSession = { judgeId: string; name: string };
export type AdminSession = { admin: true };

const COOKIE = { student: "bh_s", judge: "bh_j", admin: "bh_a" } as const;
type Role = keyof typeof COOKIE;

function secret(): string {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 8) return s;
  const db = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (db) return createHash("sha256").update("bh:" + db).digest("hex");
  throw new Error("APP_SECRET is not set");
}

function b64(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: object): string {
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp === "number" && data.exp < Date.now()) return null;
    return data as T;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

const WEEK = 7 * 24 * 3600;

export function sessionCookie(role: Role, payload: object, maxAgeSec = WEEK): string {
  const token = sign({ ...payload, exp: Date.now() + maxAgeSec * 1000 });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE[role]}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function clearCookie(role: Role): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE[role]}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function getStudent(req: Request): StudentSession | null {
  const s = verify<StudentSession>(readCookie(req, COOKIE.student));
  return s && s.memberId && s.teamId ? s : null;
}

export function getJudge(req: Request): JudgeSession | null {
  const s = verify<JudgeSession>(readCookie(req, COOKIE.judge));
  return s && s.judgeId ? s : null;
}

export function isAdmin(req: Request): boolean {
  const s = verify<AdminSession>(readCookie(req, COOKIE.admin));
  return !!(s && s.admin);
}

export function safeEqual(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

// Encryption for AI keys stored in the database.
function encKey(): Buffer {
  return createHash("sha256").update("enc:" + secret()).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [b64(iv), b64(cipher.getAuthTag()), b64(data)].join(".");
}

export function decrypt(packed: string): string {
  const [iv, tag, data] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Small in-memory limiter for passcode guesses (per server instance).
const attempts = new Map<string, { n: number; reset: number }>();
export function tooManyAttempts(req: Request, bucket: string, max = 12, windowMs = 60_000): boolean {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const key = `${bucket}:${ip}`;
  const t = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.reset < t) {
    attempts.set(key, { n: 1, reset: t + windowMs });
    return false;
  }
  cur.n += 1;
  return cur.n > max;
}

export function json(data: unknown, init: { status?: number; cookies?: string[] } = {}): Response {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const c of init.cookies || []) headers.append("set-cookie", c);
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
}

export function fail(message: string, status = 400, extra: object = {}): Response {
  return json({ error: message, ...extra }, { status });
}
