import { fail, json, safeEqual } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import type { AvatarSpec } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || "";
  const s = await getSettings();
  if (!key || !s.tvKey || !safeEqual(key, s.tvKey)) return fail("This screen link is not valid.", 401);

  const [teams, members, announcement] = await Promise.all([
    q<{ id: string; name: string; solo: boolean; published: boolean; submitted: boolean }>(
      `SELECT t.id, t.name, t.solo,
              (t.published_files IS NOT NULL AND jsonb_typeof(t.published_files) = 'object') AS published,
              (s.team_id IS NOT NULL) AS submitted
       FROM teams t LEFT JOIN submissions s ON s.team_id = t.id
       ORDER BY t.created_at, t.id`
    ),
    q<{ team_id: string; name: string; avatar: AvatarSpec }>(
      "SELECT team_id, name, avatar FROM members ORDER BY created_at"
    ),
    q1<{ id: number; body: string; urgent: boolean; created_at: number }>(
      "SELECT id, body, urgent, created_at FROM announcements ORDER BY id DESC LIMIT 1"
    ),
  ]);

  const membersByTeam = new Map<string, { name: string; avatar: AvatarSpec }[]>(teams.map((t) => [t.id, []]));
  let students = 0;
  for (const m of members) {
    const list = membersByTeam.get(m.team_id);
    if (!list) continue;
    list.push({ name: m.name, avatar: m.avatar });
    students++;
  }

  // Only what the room is allowed to see: no judge code, no screen key, no budget numbers.
  return json({
    now: Date.now(),
    event: {
      name: s.eventName,
      phase: s.phase,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      pausedRemainingMs: s.pausedRemainingMs,
      eventCode: s.eventCode,
      schedule: s.schedule,
      podium: s.podium,
      podiumStep: s.podiumStep,
    },
    announcement: announcement
      ? { id: announcement.id, body: announcement.body, urgent: announcement.urgent, createdAt: announcement.created_at }
      : null,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      solo: t.solo,
      members: membersByTeam.get(t.id) || [],
      published: !!t.published,
      submitted: !!t.submitted,
    })),
    counts: {
      students,
      teams: teams.length,
      published: teams.filter((t) => t.published).length,
      submitted: teams.filter((t) => t.submitted).length,
    },
  });
}
