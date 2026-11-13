import { json } from "@/lib/auth";
import { getSettings } from "@/lib/event";
import { randomTeamName } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return json({
    name: s.eventName,
    phase: s.phase,
    teamsAllowed: s.teamsAllowed,
    maxTeamSize: s.maxTeamSize,
    teamName: randomTeamName(),
  });
}
