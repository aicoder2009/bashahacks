import { fail, json, safeEqual } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import type { Files } from "@/lib/types";

export const dynamic = "force-dynamic";

/** The code of the one app an officer put on the TV. Nothing else can be read with the screen key. */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || "";
  const s = await getSettings();
  if (!key || !s.tvKey || !safeEqual(key, s.tvKey)) return fail("This screen link is not valid.", 401);
  if (s.phase !== "judging" || !s.presentingTeamId) return fail("No app is on the TV right now.", 404);

  const team = await q1<{ id: string; files: Files | null; published_files: Files | null }>(
    "SELECT id, files, published_files FROM teams WHERE id=$1",
    [s.presentingTeamId]
  );
  if (!team) return fail("That team no longer exists.", 404);

  // Same rule as for judges: the published app when there is one, otherwise the work in progress.
  return json({ teamId: team.id, files: team.published_files || team.files || {} });
}
