import { fail, json, sessionCookie, tooManyAttempts } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import type { MemberRow, TeamRow } from "@/lib/store";

export const dynamic = "force-dynamic";

const norm = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function GET(req: Request) {
  if (tooManyAttempts(req, "rejoin", 90)) return fail("Too many tries. Wait a minute and try again.", 429);
  const code = norm(new URL(req.url).searchParams.get("code"));
  const team = await q1<TeamRow>("SELECT * FROM teams WHERE code=$1", [code]);
  if (!team) return fail("No team has that code.", 404);
  const members = await q<MemberRow>("SELECT * FROM members WHERE team_id=$1 ORDER BY created_at", [team.id]);
  return json({ teamName: team.name, members: members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar })) });
}

export async function POST(req: Request) {
  if (tooManyAttempts(req, "rejoin", 90)) return fail("Too many tries. Wait a minute and try again.", 429);
  const body = await req.json().catch(() => ({}));
  const team = await q1<TeamRow>("SELECT * FROM teams WHERE code=$1", [norm(body.code)]);
  if (!team) return fail("No team has that code.", 404);
  const member = await q1<MemberRow>("SELECT * FROM members WHERE id=$1 AND team_id=$2", [String(body.memberId || ""), team.id]);
  if (!member) return fail("That person is not on this team.", 404);
  return json({ ok: true }, { cookies: [sessionCookie("student", { memberId: member.id, teamId: team.id })] });
}
