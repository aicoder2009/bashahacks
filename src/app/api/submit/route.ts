import { fail, getStudent, json } from "@/lib/auth";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { appTitle, hasApp } from "@/lib/parse-files";
import { getTeam } from "@/lib/store";
import { cleanMultiline, cleanText, isRude } from "@/lib/text";

export const dynamic = "force-dynamic";

const CATEGORIES = ["home", "school", "community"];

export async function POST(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const body = await req.json().catch(() => ({}));
  const [s, team] = await Promise.all([getSettings(), getTeam(session.teamId)]);
  if (!team) return fail("Please join again.", 401);
  if (s.phase !== "hacking") return fail("Submissions are closed.", 403);
  if (!hasApp(team.files)) return fail("Build your app first, then submit it.");

  const title = cleanText(body.title, 60);
  const problem = cleanMultiline(body.problem, 700);
  const solution = cleanMultiline(body.solution, 700);
  const category = CATEGORIES.includes(body.category) ? body.category : "";
  if (title.length < 2) return fail("Give your app a name.");
  if (isRude(title)) return fail("Please pick a different app name.");
  if (problem.length < 10) return fail("Tell us about the problem you noticed (a sentence or two).");
  if (solution.length < 10) return fail("Tell us how your app helps (a sentence or two).");
  if (!category) return fail("Choose where the problem happens: home, school, or community.");

  const t = Date.now();
  await q(
    `INSERT INTO submissions (team_id, title, problem, solution, category, submitted_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6)
     ON CONFLICT (team_id) DO UPDATE SET title=$2, problem=$3, solution=$4, category=$5, updated_at=$6`,
    [team.id, title, problem, solution, category, t]
  );
  // Submitting also publishes the newest version, so judges always see the latest app.
  await q(
    `UPDATE teams SET published_files = files, published_at = $2, published_version = version,
       app_title = COALESCE($3, app_title), milestones = $4::jsonb || milestones WHERE id=$1`,
    [team.id, t, appTitle(team.files), JSON.stringify({ publish: t, submit: t })]
  );
  return json({ ok: true });
}
