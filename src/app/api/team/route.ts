import { fail, getStudent, json } from "@/lib/auth";
import { q } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { getTeam } from "@/lib/store";
import { cleanText, isRude } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const body = await req.json().catch(() => ({}));
  const [s, team] = await Promise.all([getSettings(), getTeam(session.teamId)]);
  if (!team) return fail("Please join again.", 401);

  if (body.action === "open") {
    if (!s.teamsAllowed) return fail("Teams are turned off for this event.");
    await q("UPDATE teams SET solo=false WHERE id=$1", [team.id]);
    return json({ ok: true });
  }
  if (body.action === "rename") {
    const name = cleanText(body.name, 28);
    if (name.length < 2 || isRude(name)) return fail("Please pick a different team name.");
    await q("UPDATE teams SET name=$2 WHERE id=$1", [team.id, name]);
    return json({ ok: true });
  }
  return fail("Unknown action.");
}
