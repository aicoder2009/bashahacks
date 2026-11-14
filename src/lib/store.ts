import { q, q1 } from "./db";
import { eventBudgetLeft } from "./event";
import type { AvatarSpec, EventSettings, Files, MemberView, PodiumEntry, UsageView } from "./types";

export type TeamRow = {
  id: string;
  code: string;
  slug: string;
  name: string;
  solo: boolean;
  created_at: number;
  cap_usd: number;
  spent_usd: number;
  ai_paused: boolean;
  key_id: string | null;
  on_backup: boolean;
  files: Files;
  version: number;
  busy_until: number;
  busy_by: string | null;
  published_files: Files | null;
  published_at: number | null;
  published_version: number | null;
  app_title: string | null;
  milestones: Record<string, number>;
};

export type MemberRow = {
  id: string;
  team_id: string;
  name: string;
  avatar: AvatarSpec;
  created_at: number;
  last_seen: number;
};

export const getTeam = (id: string) => q1<TeamRow>("SELECT * FROM teams WHERE id=$1", [id]);
export const getMember = (id: string) => q1<MemberRow>("SELECT * FROM members WHERE id=$1", [id]);

export async function teamMembers(teamId: string): Promise<MemberView[]> {
  const rows = await q<MemberRow>("SELECT * FROM members WHERE team_id=$1 ORDER BY created_at", [teamId]);
  const t = Date.now();
  return rows.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, online: t - m.last_seen < 20_000 }));
}

export function usageView(team: TeamRow, s: EventSettings, totalSpent: number): UsageView {
  const pctLeft = team.cap_usd > 0 ? Math.max(0, Math.min(1, 1 - team.spent_usd / team.cap_usd)) : 0;
  if (s.aiPausedAll || team.ai_paused) return { pctLeft, blocked: true, reason: "paused" };
  if (eventBudgetLeft(s, totalSpent) <= 0) return { pctLeft, blocked: true, reason: "event" };
  if (team.spent_usd >= team.cap_usd - 0.0005) return { pctLeft: 0, blocked: true, reason: "cap" };
  return { pctLeft, blocked: false, reason: "" };
}

export type LeaderRow = {
  teamId: string;
  teamName: string;
  appTitle: string;
  slug: string;
  score: number;
  judgeCount: number;
  submitted: boolean;
  /** Web address of a project built outside this site, or "". */
  link: string;
  members: { name: string; avatar: AvatarSpec }[];
};

/** Average of each judge's weighted score for a team, shown out of 100. */
export async function leaderboard(): Promise<LeaderRow[]> {
  const perJudge = await q<{ team_id: string; judge_id: string; avg: number }>(
    `SELECT s.team_id, s.judge_id,
            (SUM(s.value * c.weight) / NULLIF(SUM(c.weight), 0))::double precision AS avg
     FROM scores s JOIN criteria c ON c.id = s.criterion_id
     GROUP BY s.team_id, s.judge_id`
  );
  const byTeam = new Map<string, number[]>();
  for (const r of perJudge) {
    if (r.avg == null) continue;
    if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, []);
    byTeam.get(r.team_id)!.push(r.avg);
  }
  const teams = await q<TeamRow & { sub_title: string | null; sub_link: string | null }>(
    "SELECT t.*, s.title AS sub_title, s.link AS sub_link FROM teams t LEFT JOIN submissions s ON s.team_id = t.id"
  );
  const members = await q<MemberRow>("SELECT * FROM members ORDER BY created_at");
  const rows: LeaderRow[] = [];
  for (const t of teams) {
    const scores = byTeam.get(t.id) || [];
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    rows.push({
      teamId: t.id,
      teamName: t.name,
      appTitle: t.sub_title || t.app_title || "Untitled app",
      slug: t.slug,
      score: Math.round(mean * 20 * 10) / 10,
      judgeCount: scores.length,
      submitted: t.sub_title != null,
      link: t.sub_link || "",
      members: members.filter((m) => m.team_id === t.id).map((m) => ({ name: m.name, avatar: m.avatar })),
    });
  }
  rows.sort((a, b) => b.score - a.score || b.judgeCount - a.judgeCount || a.teamName.localeCompare(b.teamName));
  return rows;
}

export function podiumFrom(rows: LeaderRow[]): PodiumEntry[] {
  return rows
    .filter((r) => r.judgeCount > 0)
    .slice(0, 3)
    .map((r, i) => ({
      place: i + 1,
      teamId: r.teamId,
      teamName: r.teamName,
      appTitle: r.appTitle,
      score: r.score,
      members: r.members,
    }));
}
