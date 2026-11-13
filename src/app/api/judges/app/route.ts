import { clearCookie, fail, getJudge, json } from "@/lib/auth";
import { q1 } from "@/lib/db";
import type { Files } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = getJudge(req);
  if (!session) return fail("Please log in as a judge.", 401);
  const judge = await q1<{ id: string }>("SELECT id FROM judges WHERE id=$1", [session.judgeId]);
  if (!judge) return json({ error: "Please log in again." }, { status: 401, cookies: [clearCookie("judge")] });

  const teamId = new URL(req.url).searchParams.get("teamId") || "";
  if (!teamId) return fail("Choose a team first.");
  const team = await q1<{ files: Files | null; published_files: Files | null }>(
    "SELECT files, published_files FROM teams WHERE id=$1",
    [teamId]
  );
  if (!team) return fail("That team no longer exists.", 404);

  // Judges see the published app when there is one, otherwise the work in progress.
  return json({ files: team.published_files || team.files || {} });
}
