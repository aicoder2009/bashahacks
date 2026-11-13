import { clearCookie, fail, getJudge, json } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { cleanMultiline } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = getJudge(req);
  if (!session) return fail("Please log in as a judge.", 401);
  const body = await req.json().catch(() => ({}));

  // Read the phase fresh: a score must never land after the winners are locked in.
  const [s, judge] = await Promise.all([
    getSettings(true),
    q1<{ id: string }>("SELECT id FROM judges WHERE id=$1", [session.judgeId]),
  ]);
  if (!judge) return json({ error: "Please log in again." }, { status: 401, cookies: [clearCookie("judge")] });
  if (s.phase === "winners" || s.phase === "done") return fail("Scores are locked.", 403);

  const teamId = typeof body.teamId === "string" ? body.teamId : "";
  const hasScore = body.criterionId !== undefined;
  const hasComment = typeof body.comment === "string";
  if (!teamId || (!hasScore && !hasComment)) return fail("Nothing to save.");

  const team = await q1<{ id: string }>("SELECT id FROM teams WHERE id=$1", [teamId]);
  if (!team) return fail("That team no longer exists.", 404);

  const t = Date.now();

  if (hasScore) {
    const criterionId = body.criterionId;
    const value = body.value;
    if (typeof criterionId !== "number" || !Number.isInteger(criterionId)) return fail("That is not a valid criterion.");
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 5) {
      return fail("A score is a whole number from 1 to 5.");
    }
    const criterion = await q1<{ id: number }>("SELECT id FROM criteria WHERE id=$1", [criterionId]);
    if (!criterion) return fail("That criterion no longer exists.", 404);

    if (value === 0) {
      await q("DELETE FROM scores WHERE judge_id=$1 AND team_id=$2 AND criterion_id=$3", [judge.id, team.id, criterion.id]);
    } else {
      await q(
        `INSERT INTO scores (judge_id, team_id, criterion_id, value, updated_at) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (judge_id, team_id, criterion_id) DO UPDATE SET value=$4, updated_at=$5`,
        [judge.id, team.id, criterion.id, value, t]
      );
    }
  }

  if (hasComment) {
    const comment = cleanMultiline(body.comment, 600);
    await q(
      `INSERT INTO judge_notes (judge_id, team_id, comment, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (judge_id, team_id) DO UPDATE SET comment=$3, updated_at=$4`,
      [judge.id, team.id, comment, t]
    );
  }

  return json({ ok: true });
}
