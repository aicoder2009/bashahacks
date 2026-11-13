import { Pool } from "pg";

const g = globalThis as unknown as { __bhPool?: Pool; __bhReady?: Promise<void> };

function pool(): Pool {
  if (!g.__bhPool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /127\.0\.0\.1|localhost/.test(url);
    g.__bhPool = new Pool({
      connectionString: url,
      max: local ? 10 : 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: true },
    });
    g.__bhPool.on("error", () => {});
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
    await client.query("SELECT pg_advisory_lock(72311114)");
    try {
      await client.query(SCHEMA);
    } finally {
      await client.query("SELECT pg_advisory_unlock(72311114)");
    }
  } finally {
    client.release();
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
