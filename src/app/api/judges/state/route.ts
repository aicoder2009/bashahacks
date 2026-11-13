import { clearCookie, fail, getJudge, json } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import type { AvatarSpec } from "@/lib/types";

export const dynamic = "force-dynamic";

// Same test as hasApp() in parse-files, done in SQL so the app code itself is never loaded here.
const HAS_APP = `(
  (t.published_files IS NOT NULL AND jsonb_typeof(t.published_files) = 'object')
  OR (jsonb_typeof(t.files->'index.html') = 'string' AND t.files->>'index.html' ~ '\\S')
)`;

type TeamLite = {
  id: string;
  name: string;
  slug: string;
  solo: boolean;
  app_title: string | null;
  sub_title: string | null;
  category: string | null;
  problem: string | null;
  solution: string | null;
  submitted: boolean;
};

export async function GET(req: Request) {
  const session = getJudge(req);
  if (!session) return fail("Please log in as a judge.", 401);

  const [s, judge] = await Promise.all([
    getSettings(),
    q1<{ id: string; name: string }>("SELECT id, name FROM judges WHERE id=$1", [session.judgeId]),
  ]);
  if (!judge) return json({ error: "Please log in again." }, { status: 401, cookies: [clearCookie("judge")] });

  const [criteria, teams, members, scores, notes] = await Promise.all([
    q<{ id: number; name: string; hint: string; weight: number }>(
      "SELECT id, name, hint, weight FROM criteria ORDER BY position, id"
    ),
    q<TeamLite>(
      `SELECT t.id, t.name, t.slug, t.solo, t.app_title,
              s.title AS sub_title, s.category, s.problem, s.solution, (s.team_id IS NOT NULL) AS submitted
       FROM teams t LEFT JOIN submissions s ON s.team_id = t.id
       WHERE ${HAS_APP}`
    ),
    q<{ team_id: string; name: string; avatar: AvatarSpec }>(
      "SELECT team_id, name, avatar FROM members ORDER BY created_at"
    ),
    q<{ team_id: string; criterion_id: number; value: number }>(
      "SELECT team_id, criterion_id, value FROM scores WHERE judge_id=$1",
      [judge.id]
    ),
    q<{ team_id: string; comment: string }>("SELECT team_id, comment FROM judge_notes WHERE judge_id=$1", [judge.id]),
  ]);

  const criterionIds = new Set(criteria.map((c) => c.id));
  const scoresByTeam = new Map<string, Record<number, number>>();
  for (const r of scores) {
    if (!criterionIds.has(r.criterion_id)) continue;
    if (!scoresByTeam.has(r.team_id)) scoresByTeam.set(r.team_id, {});
    scoresByTeam.get(r.team_id)![r.criterion_id] = r.value;
  }
  const noteByTeam = new Map(notes.map((n) => [n.team_id, n.comment]));
  const membersByTeam = new Map<string, { name: string; avatar: AvatarSpec }[]>();
  for (const m of members) {
    if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
    membersByTeam.get(m.team_id)!.push({ name: m.name, avatar: m.avatar });
  }

  const out = teams
    .map((t) => {
      const mine = scoresByTeam.get(t.id) || {};
      return {
        teamId: t.id,
        teamName: t.name,
        slug: t.slug,
        solo: t.solo,
        appTitle: t.sub_title || t.app_title || "Untitled app",
        submitted: !!t.submitted,
        category: t.category || "",
        problem: t.problem || "",
        solution: t.solution || "",
        members: membersByTeam.get(t.id) || [],
        scores: mine,
        comment: noteByTeam.get(t.id) || "",
        complete: criteria.length > 0 && criteria.every((c) => mine[c.id] != null),
      };
    })
    .sort((a, b) => Number(b.submitted) - Number(a.submitted) || a.teamName.localeCompare(b.teamName, undefined, { numeric: true, sensitivity: "base" }));

  return json({
    now: Date.now(),
    judge: { id: judge.id, name: judge.name },
    eventName: s.eventName,
    phase: s.phase,
    locked: s.phase === "winners" || s.phase === "done",
    criteria,
    teams: out,
  });
}
