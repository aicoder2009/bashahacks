import { fail, json, safeEqual, sessionCookie, tooManyAttempts } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { randomCode, randomId, randomSlug, randomTeamName } from "@/lib/ids";
import { cleanAvatar, cleanText, isRude } from "@/lib/text";
import type { TeamRow } from "@/lib/store";

export const dynamic = "force-dynamic";

const norm = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function createTeam(name: string, solo: boolean, capUsd: number): Promise<TeamRow> {
  for (let i = 0; i < 8; i++) {
    try {
      const row = await q1<TeamRow>(
        `INSERT INTO teams (id, code, slug, name, solo, created_at, cap_usd)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [randomId(14), randomCode(4), randomSlug(), name, solo, Date.now(), capUsd]
      );
      if (row) return row;
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  throw new Error("Could not create a team code");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const s = await getSettings();

  // A whole classroom shares one school IP address, so this limit is deliberately loose.
  if (tooManyAttempts(req, "join", 90)) return fail("Too many tries. Wait a minute and try again.", 429);

  if (!safeEqual(norm(body.eventCode), norm(s.eventCode))) {
    return fail("That event code does not match. Check the big screen and try again.", 403);
  }
  if (body.step === "check") return json({ ok: true });

  if (s.phase !== "lobby" && s.phase !== "hacking") {
    return fail("Building time is over, so new builders cannot join right now.", 403);
  }

  const name = cleanText(body.name, 24);
  if (name.length < 2) return fail("Please type your first name and last initial.");
  if (isRude(name)) return fail("Please use your real first name.");
  const avatar = cleanAvatar(body.avatar);
  const mode = body.mode === "create" || body.mode === "join" ? body.mode : "solo";

  let team: TeamRow | null = null;
  if (mode === "join") {
    if (!s.teamsAllowed) return fail("Teams are turned off for this event. Choose Go solo.");
    team = await q1<TeamRow>("SELECT * FROM teams WHERE code=$1", [norm(body.teamCode)]);
    if (!team) return fail("No team has that code. Check the letters with your teammate.");
    if (team.solo) return fail("That code belongs to someone building solo. Ask them to press Invite a teammate first.");
    const members = await q<{ name: string }>("SELECT name FROM members WHERE team_id=$1", [team.id]);
    if (members.length >= s.maxTeamSize) return fail(`That team is full. Teams can have up to ${s.maxTeamSize} people.`);
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      return fail("Someone on that team already has this name. If that is you, use Rejoin.");
    }
  } else if (mode === "create") {
    if (!s.teamsAllowed) return fail("Teams are turned off for this event. Choose Go solo.");
    let teamName = cleanText(body.teamName, 28);
    if (teamName.length < 2 || isRude(teamName)) teamName = randomTeamName();
    team = await createTeam(teamName, false, s.defaultCapUsd);
  } else {
    team = await createTeam(name, true, s.defaultCapUsd);
  }

  const memberId = randomId(16);
  await q("INSERT INTO members (id, team_id, name, avatar, created_at, last_seen) VALUES ($1,$2,$3,$4::jsonb,$5,$5)", [
    memberId,
    team.id,
    name,
    JSON.stringify(avatar),
    Date.now(),
  ]);

  return json(
    { ok: true, team: { name: team.name, code: team.code, solo: team.solo } },
    { cookies: [sessionCookie("student", { memberId, teamId: team.id })] }
  );
}
