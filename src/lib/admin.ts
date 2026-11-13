import { q, q1 } from "./db";
import { eventBudgetLeft, getSettings, totalSpend } from "./event";
import { hasBackupKey, hasManagementKey, mockMode } from "./openrouter";
import { leaderboard, type LeaderRow } from "./store";
import type { Announcement, AvatarSpec, Criterion, EventSettings, Files, MemberView } from "./types";

/* Shapes shared by the admin API routes and the /admin page (the page imports them as types only). */

export type AdminTeam = {
  id: string;
  name: string;
  code: string;
  slug: string;
  solo: boolean;
  createdAt: number;
  members: MemberView[];
  capUsd: number;
  spentUsd: number;
  aiPaused: boolean;
  onBackup: boolean;
  hasKey: boolean;
  version: number;
  appTitle: string | null;
  hasApp: boolean;
  publishedAt: number | null;
  submitted: boolean;
  busy: boolean;
};

export type AdminSubmission = {
  teamId: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  submittedAt: number;
  updatedAt: number;
};

export type AdminJudge = { id: string; name: string; createdAt: number; scoredTeams: number; totalTeams: number };

export type AdminAi = {
  totalSpent: number;
  budgetLeft: number;
  poolFree: number;
  poolTotal: number;
  hasManagementKey: boolean;
  hasBackupKey: boolean;
  mockMode: boolean;
  teamsOnBackup: number;
};

export type AdminState = {
  now: number;
  settings: EventSettings;
  teams: AdminTeam[];
  announcements: Announcement[];
  submissions: AdminSubmission[];
  criteria: Criterion[];
  judges: AdminJudge[];
  leaderboard: LeaderRow[];
  ai: AdminAi;
  counts: { students: number; teams: number; published: number; submitted: number };
};

export type AdminTeamDetail = {
  team: { name: string; code: string; slug: string };
  files: Files;
  publishedFiles: Files | null;
  messages: { role: "user" | "assistant"; content: string; memberName: string; createdAt: number }[];
};

type TeamListRow = {
  id: string;
  name: string;
  code: string;
  slug: string;
  solo: boolean;
  created_at: number;
  cap_usd: number;
  spent_usd: number;
  ai_paused: boolean;
  on_backup: boolean;
  version: number;
  app_title: string | null;
  published_at: number | null;
  busy_until: number;
  has_app: boolean;
  has_key: boolean;
  submitted: boolean;
};

/** Everything the dashboard shows, in one payload. The app files themselves are left out to keep it small. */
export async function adminState(): Promise<AdminState> {
  const settings = await getSettings(true);
  const [teamRows, memberRows, annRows, subRows, criteria, judgeRows, board, spent, pool] = await Promise.all([
    q<TeamListRow>(
      `SELECT t.id, t.name, t.code, t.slug, t.solo, t.created_at, t.cap_usd, t.spent_usd, t.ai_paused, t.on_backup,
              t.version, t.app_title, t.published_at, t.busy_until,
              (COALESCE(length(btrim(t.files->>'index.html')), 0) > 0) AS has_app,
              EXISTS (SELECT 1 FROM ai_keys k WHERE k.team_id = t.id AND k.kind = 'team' AND NOT k.disabled) AS has_key,
              EXISTS (SELECT 1 FROM submissions s WHERE s.team_id = t.id) AS submitted
       FROM teams t ORDER BY t.created_at, t.id`
    ),
    q<{ id: string; team_id: string; name: string; avatar: AvatarSpec; last_seen: number }>(
      "SELECT id, team_id, name, avatar, last_seen FROM members ORDER BY created_at, id"
    ),
    q<{ id: number; body: string; urgent: boolean; created_at: number }>("SELECT * FROM announcements ORDER BY id DESC LIMIT 100"),
    q<{ team_id: string; title: string; problem: string; solution: string; category: string; submitted_at: number; updated_at: number }>(
      "SELECT * FROM submissions ORDER BY submitted_at"
    ),
    q<Criterion>("SELECT id, name, hint, weight, position FROM criteria ORDER BY position, id"),
    q<{ id: string; name: string; created_at: number; scored: number }>(
      `SELECT j.id, j.name, j.created_at,
              (SELECT COUNT(*) FROM (
                 SELECT s.team_id FROM scores s
                 JOIN criteria c ON c.id = s.criterion_id
                 JOIN teams t ON t.id = s.team_id
                 WHERE s.judge_id = j.id
                 GROUP BY s.team_id
                 HAVING COUNT(*) >= (SELECT COUNT(*) FROM criteria)
               ) done)::int AS scored
       FROM judges j ORDER BY j.created_at, j.id`
    ),
    leaderboard(),
    totalSpend(true),
    q1<{ free: number; total: number }>(
      `SELECT (COUNT(*) FILTER (WHERE team_id IS NULL AND NOT disabled))::int AS free, COUNT(*)::int AS total
       FROM ai_keys WHERE kind = 'team'`
    ),
  ]);

  const t = Date.now();
  const byTeam = new Map<string, MemberView[]>();
  for (const m of memberRows) {
    if (!byTeam.has(m.team_id)) byTeam.set(m.team_id, []);
    byTeam.get(m.team_id)!.push({ id: m.id, name: m.name, avatar: m.avatar, online: t - m.last_seen < 20_000 });
  }

  const teams: AdminTeam[] = teamRows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    slug: r.slug,
    solo: r.solo,
    createdAt: r.created_at,
    members: byTeam.get(r.id) || [],
    capUsd: r.cap_usd,
    spentUsd: r.spent_usd,
    aiPaused: r.ai_paused,
    onBackup: r.on_backup,
    hasKey: r.has_key,
    version: r.version,
    appTitle: r.app_title,
    hasApp: r.has_app,
    publishedAt: r.published_at,
    submitted: r.submitted,
    busy: r.busy_until > t,
  }));

  return {
    now: t,
    settings,
    teams,
    announcements: annRows.map((a) => ({ id: a.id, body: a.body, urgent: a.urgent, createdAt: a.created_at })),
    submissions: subRows.map((s) => ({
      teamId: s.team_id,
      title: s.title,
      problem: s.problem,
      solution: s.solution,
      category: s.category,
      submittedAt: s.submitted_at,
      updatedAt: s.updated_at,
    })),
    criteria,
    judges: judgeRows.map((j) => ({ id: j.id, name: j.name, createdAt: j.created_at, scoredTeams: j.scored, totalTeams: teams.length })),
    leaderboard: board,
    ai: {
      totalSpent: spent,
      budgetLeft: eventBudgetLeft(settings, spent),
      poolFree: pool?.free || 0,
      poolTotal: pool?.total || 0,
      hasManagementKey: hasManagementKey(),
      hasBackupKey: hasBackupKey(),
      mockMode: mockMode(),
      teamsOnBackup: teams.filter((x) => x.onBackup).length,
    },
    counts: {
      students: memberRows.length,
      teams: teams.length,
      published: teams.filter((x) => x.publishedAt != null).length,
      submitted: teams.filter((x) => x.submitted).length,
    },
  };
}

/** One CSV cell: quoted when needed, and never starting with a character a spreadsheet would run as a formula. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}
