import { clearCookie, fail, getStudent, json } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getSettings, publicEvent, totalSpend } from "@/lib/event";
import { getMember, getTeam, teamMembers, usageView } from "@/lib/store";
import type { Announcement, ChatMessage, Submission, SyncResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

type MsgRow = { id: number; role: "user" | "assistant"; member_id: string | null; content: string; meta: ChatMessage["meta"]; created_at: number };

export async function GET(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const url = new URL(req.url);
  const haveVersion = Number(url.searchParams.get("v") ?? -1);
  const lastMsg = Number(url.searchParams.get("m") ?? 0) || 0;
  const lastAnn = Number(url.searchParams.get("a") ?? 0) || 0;

  const [s, team, me] = await Promise.all([getSettings(), getTeam(session.teamId), getMember(session.memberId)]);
  if (!team || !me || me.team_id !== team.id) {
    return json({ error: "You are no longer on a team. Please join again." }, { status: 401, cookies: [clearCookie("student")] });
  }

  const t = Date.now();
  if (t - me.last_seen > 8000) await q("UPDATE members SET last_seen=$2 WHERE id=$1", [me.id, t]);

  const [members, msgs, anns, sub, spent] = await Promise.all([
    teamMembers(team.id),
    q<MsgRow>("SELECT * FROM messages WHERE team_id=$1 AND id>$2 ORDER BY id LIMIT 200", [team.id, lastMsg]),
    q<{ id: number; body: string; urgent: boolean; created_at: number }>(
      "SELECT * FROM announcements WHERE id>$1 ORDER BY id LIMIT 50",
      [lastAnn]
    ),
    q1<{ title: string; problem: string; solution: string; category: string; submitted_at: number; updated_at: number }>(
      "SELECT * FROM submissions WHERE team_id=$1",
      [team.id]
    ),
    totalSpend(),
  ]);

  const busyMember = team.busy_until > t && team.busy_by ? members.find((m) => m.id === team.busy_by) : null;
  const submission: Submission | null = sub
    ? { title: sub.title, problem: sub.problem, solution: sub.solution, category: sub.category, submittedAt: sub.submitted_at, updatedAt: sub.updated_at }
    : null;

  const out: SyncResponse = {
    now: t,
    event: publicEvent(s),
    me: { id: me.id, name: me.name, avatar: me.avatar },
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
      slug: team.slug,
      solo: team.solo,
      version: team.version,
      busy: team.busy_until > t ? { memberId: team.busy_by || "", name: busyMember?.name || "A teammate" } : null,
      usage: usageView(team, s, spent),
      members,
      publishedAt: team.published_at,
      publishedVersion: team.published_version,
      appTitle: team.app_title,
      milestones: team.milestones || {},
    },
    messages: msgs.map((m) => ({ id: m.id, role: m.role, memberId: m.member_id, content: m.content, meta: m.meta || {}, createdAt: m.created_at })),
    announcements: anns.map((a): Announcement => ({ id: a.id, body: a.body, urgent: a.urgent, createdAt: a.created_at })),
    submission,
  };
  if (haveVersion !== team.version) out.files = team.files || {};
  return json(out);
}
