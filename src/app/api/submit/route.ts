import { fail, getStudent, json } from "@/lib/auth";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { appTitle, hasApp } from "@/lib/parse-files";
import { getTeam } from "@/lib/store";
import { cleanLink, cleanMultiline, cleanText, isRude } from "@/lib/text";

export const dynamic = "force-dynamic";

const CATEGORIES = ["home", "school", "community"];

export async function POST(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const body = await req.json().catch(() => ({}));
  const [s, team] = await Promise.all([getSettings(), getTeam(session.teamId)]);
  if (!team) return fail("Please join again.", 401);
  if (s.phase !== "hacking") return fail("Submissions are closed.", 403);

  // A project built somewhere else is submitted with a link, so it does not need an app here.
  const link = cleanLink(body.link);
  if (link == null) return fail("That link does not look right. Paste the full web address of your project.");
  const built = hasApp(team.files);
  if (!built && !link) return fail("Build your app here first, or add a link to a project you built somewhere else.");

  const title = cleanText(body.title, 60);
  const problem = cleanMultiline(body.problem, 700);
  const solution = cleanMultiline(body.solution, 700);
  const category = CATEGORIES.includes(body.category) ? body.category : "";
  if (title.length < 2) return fail("Give your project a name.");
  if (isRude(title)) return fail("Please pick a different project name.");
  if (problem.length < 10) return fail("Tell us about the problem you noticed (a sentence or two).");
  if (solution.length < 10) return fail("Tell us what your project is and how it helps (a sentence or two).");
  if (!category) return fail("Choose where the problem happens: home, school, or community.");

  const t = Date.now();
  await q(
    `INSERT INTO submissions (team_id, title, problem, solution, category, link, submitted_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$7,$6,$6)
     ON CONFLICT (team_id) DO UPDATE SET title=$2, problem=$3, solution=$4, category=$5, link=$7, updated_at=$6`,
    [team.id, title, problem, solution, category, t, link]
  );
  if (built) {
    // Submitting also publishes the newest version, so judges always see the latest app.
    await q(
      `UPDATE teams SET published_files = files, published_at = $2, published_version = version,
         app_title = COALESCE($3, app_title), milestones = $4::jsonb || milestones WHERE id=$1`,
      [team.id, t, appTitle(team.files), JSON.stringify({ publish: t, submit: t })]
    );
  } else {
    // Nothing was built here, so there is nothing to publish.
    await q("UPDATE teams SET milestones = $2::jsonb || milestones WHERE id=$1", [team.id, JSON.stringify({ submit: t })]);
  }
  return json({ ok: true });
}
