import { fail, getStudent, json } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { appTitle, hasApp } from "@/lib/parse-files";
import { getTeam } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const [s, team] = await Promise.all([getSettings(), getTeam(session.teamId)]);
  if (!team) return fail("Please join again.", 401);
  if (s.phase !== "hacking") return fail("Publishing is closed now.", 403);
  if (!hasApp(team.files)) return fail("Build something first, then publish it.");
  const t = Date.now();
  const row = await q1<{ slug: string; published_at: number; published_version: number }>(
    `UPDATE teams SET published_files = files, published_at = $2, published_version = version,
       app_title = COALESCE($3, app_title), milestones = $4::jsonb || milestones
     WHERE id=$1 RETURNING slug, published_at, published_version`,
    [team.id, t, appTitle(team.files), JSON.stringify({ publish: t })]
  );
  return json({ ok: true, slug: row?.slug, publishedAt: row?.published_at, publishedVersion: row?.published_version });
}
