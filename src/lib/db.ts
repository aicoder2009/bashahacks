import { Pool } from "pg";

const g = globalThis as unknown as { __bhPool?: Pool; __bhReady?: Promise<void> };

// Where hosting providers put the database address. Vercel's Neon integration can also add a custom
// prefix (for example STORAGE_DATABASE_URL), so any variable ending in _DATABASE_URL or _POSTGRES_URL counts.
const DB_VARS = ["DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "POSTGRES_PRISMA_URL"];

export function findDatabaseUrl(): { name: string; url: string } | null {
  for (const name of DB_VARS) {
    const url = process.env[name];
    if (url) return { name, url };
  }
  for (const [name, url] of Object.entries(process.env)) {
    if (url && /(_DATABASE_URL|_POSTGRES_URL)$/.test(name) && /^postgres(ql)?:\/\//.test(url)) return { name, url };
  }
  return null;
}

/** Removes options that the driver would read differently from what the address intends; encryption is set below. */
function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of ["sslmode", "channel_binding", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

function pool(): Pool {
  if (!g.__bhPool) {
    const found = findDatabaseUrl();
    if (!found) throw new Error("No database address is set (looked for DATABASE_URL, POSTGRES_URL and similar)");
    const local = /@(127\.0\.0\.1|localhost)[:/]/.test(found.url);
    g.__bhPool = new Pool({
      connectionString: cleanUrl(found.url),
      max: local ? 10 : 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: true },
    });
    g.__bhPool.on("error", (e) => console.error("[db] idle client error", e.message));
  }
  return g.__bhPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  solo boolean NOT NULL DEFAULT true,
  created_at double precision NOT NULL,
  cap_usd double precision NOT NULL,
  spent_usd double precision NOT NULL DEFAULT 0,
  ai_paused boolean NOT NULL DEFAULT false,
  key_id text,
  on_backup boolean NOT NULL DEFAULT false,
  files jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 0,
  busy_until double precision NOT NULL DEFAULT 0,
  busy_by text,
  published_files jsonb,
  published_at double precision,
  published_version integer,
  app_title text,
  milestones jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS members (
  id text PRIMARY KEY,
  team_id text NOT NULL,
  name text NOT NULL,
  avatar jsonb NOT NULL,
  created_at double precision NOT NULL,
  last_seen double precision NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS members_team ON members(team_id);
CREATE TABLE IF NOT EXISTS versions (
  id serial PRIMARY KEY,
  team_id text NOT NULL,
  files jsonb NOT NULL,
  label text NOT NULL,
  kind text NOT NULL,
  member_id text,
  created_at double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS versions_team ON versions(team_id, id);
CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  team_id text NOT NULL,
  role text NOT NULL,
  member_id text,
  content text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_team ON messages(team_id, id);
CREATE TABLE IF NOT EXISTS announcements (
  id serial PRIMARY KEY,
  body text NOT NULL,
  urgent boolean NOT NULL DEFAULT false,
  created_at double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  team_id text PRIMARY KEY,
  title text NOT NULL,
  problem text NOT NULL,
  solution text NOT NULL,
  category text NOT NULL,
  submitted_at double precision NOT NULL,
  updated_at double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS criteria (
  id serial PRIMARY KEY,
  name text NOT NULL,
  hint text NOT NULL DEFAULT '',
  weight double precision NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS judges (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS scores (
  judge_id text NOT NULL,
  team_id text NOT NULL,
  criterion_id integer NOT NULL,
  value integer NOT NULL,
  updated_at double precision NOT NULL,
  PRIMARY KEY (judge_id, team_id, criterion_id)
);
CREATE TABLE IF NOT EXISTS judge_notes (
  judge_id text NOT NULL,
  team_id text NOT NULL,
  comment text NOT NULL DEFAULT '',
  updated_at double precision NOT NULL,
  PRIMARY KEY (judge_id, team_id)
);
CREATE TABLE IF NOT EXISTS ai_keys (
  id text PRIMARY KEY,
  hash text NOT NULL,
  key_enc text NOT NULL,
  limit_usd double precision NOT NULL,
  team_id text,
  kind text NOT NULL DEFAULT 'team',
  created_at double precision NOT NULL,
  disabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS usage_log (
  id serial PRIMARY KEY,
  team_id text,
  member_id text,
  model text,
  cost double precision NOT NULL DEFAULT 0,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'team',
  created_at double precision NOT NULL
);
INSERT INTO criteria (name, hint, weight, position)
SELECT * FROM (VALUES
  ('Sustainability impact', 'Does it tackle a real environmental problem, and would it help?', 1::double precision, 1),
  ('Creativity', 'Is the idea or the approach original?', 1::double precision, 2),
  ('Does it work', 'Can you actually use the app, start to finish?', 1::double precision, 3),
  ('Design and ease of use', 'Is it clear, good looking, and easy to figure out?', 1::double precision, 4),
  ('Presentation', 'Did the team explain the problem and their app well?', 1::double precision, 5)
) AS v(name, hint, weight, position)
WHERE NOT EXISTS (SELECT 1 FROM criteria);
`;

async function init(): Promise<void> {
  const client = await pool().connect();
  try {
    // A transaction-scoped lock is released on COMMIT, so it also works through Neon's pooled connections.
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(72311114)");
    await client.query(SCHEMA);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[db] setting up tables failed", e);
    throw e;
  } finally {
    client.release();
  }
}

/** A quick check for the health page: can we reach the database and are the tables there? */
export async function checkDatabase(): Promise<{ ok: boolean; code?: string; message?: string }> {
  try {
    await ready();
    await pool().query("SELECT 1 FROM settings LIMIT 1");
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, code: err.code, message: String(err.message || e).replace(/postgres(ql)?:\/\/\S+/gi, "[address hidden]").slice(0, 240) };
  }
}

export function ready(): Promise<void> {
  if (!g.__bhReady) {
    g.__bhReady = init().catch((e) => {
      g.__bhReady = undefined;
      throw e;
    });
  }
  return g.__bhReady;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const res = await pool().query(text, params as any[]);
  return res.rows as T[];
}

export async function q1<T = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export const now = () => Date.now();
