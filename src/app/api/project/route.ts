import { fail, getStudent, json } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { appTitle, cleanFiles } from "@/lib/parse-files";
import { getMember, getTeam } from "@/lib/store";
import type { Files } from "@/lib/types";

export const dynamic = "force-dynamic";

type VersionRow = { id: number; files: Files; label: string; kind: string; member_id: string | null; created_at: number };

export async function GET(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const rows = await q<VersionRow & { member_name: string | null }>(
    `SELECT v.id, v.label, v.kind, v.created_at, m.name AS member_name
     FROM versions v LEFT JOIN members m ON m.id = v.member_id
     WHERE v.team_id=$1 ORDER BY v.id DESC LIMIT 40`,
    [session.teamId]
  );
  return json({
    versions: rows.map((r) => ({ id: r.id, label: r.label, kind: r.kind, createdAt: r.created_at, by: r.member_name })),
  });
}

export async function POST(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const body = await req.json().catch(() => ({}));
  const [s, team, me] = await Promise.all([getSettings(), getTeam(session.teamId), getMember(session.memberId)]);
  if (!team || !me || me.team_id !== team.id) return fail("Please join again.", 401);
  if (s.phase !== "hacking") return fail("Building is not open right now.", 403);
  const t = Date.now();
  if (team.busy_until > t) return fail("The AI is working on your app. Wait for it to finish.", 409);

  let files: Files | null = null;
  let label = "";
  let kind = "manual";

  if (body.action === "save") {
    files = cleanFiles(body.files);
    if (!files) return fail("That is too much code to save.");
    if (Number(body.baseVersion) !== team.version) {
      return json({ error: "Your teammate changed the app. Loading the newest version.", conflict: true, version: team.version, files: team.files }, { status: 409 });
    }
    label = "Edited the code by hand";
  } else if (body.action === "restore") {
    const v = await q1<VersionRow>("SELECT * FROM versions WHERE id=$1 AND team_id=$2", [Number(body.versionId), team.id]);
    if (!v) return fail("That version was not found.", 404);
    files = v.files;
    label = `Went back to: ${v.label}`.slice(0, 90);
    kind = "restore";
  } else if (body.action === "undo") {
    const last = await q<VersionRow>("SELECT * FROM versions WHERE team_id=$1 ORDER BY id DESC LIMIT 2", [team.id]);
    if (!last.length) return fail("There is nothing to undo yet.");
    files = last[1]?.files || {};
    label = `Undid: ${last[0].label}`.slice(0, 90);
    kind = "restore";
  } else {
    return fail("Unknown action.");
  }

  const updated = await q1<{ version: number }>(
    `UPDATE teams SET files=$2::jsonb, version=version+1, app_title=COALESCE($4, app_title)
     WHERE id=$1 AND version=$3 AND busy_until < $5 RETURNING version`,
    [team.id, JSON.stringify(files), team.version, appTitle(files), t]
  );
  if (!updated) return json({ error: "The app changed while saving. Loading the newest version.", conflict: true }, { status: 409 });

  // Hand edits arrive every second or so while typing; fold them into one history entry.
  const recent = kind === "manual"
    ? await q1<VersionRow>("SELECT * FROM versions WHERE team_id=$1 ORDER BY id DESC LIMIT 1", [team.id])
    : null;
  if (recent && recent.kind === "manual" && recent.member_id === me.id && t - recent.created_at < 180_000) {
    await q("UPDATE versions SET files=$2::jsonb, created_at=$3 WHERE id=$1", [recent.id, JSON.stringify(files), t]);
  } else {
    await q("INSERT INTO versions (team_id, files, label, kind, member_id, created_at) VALUES ($1,$2::jsonb,$3,$4,$5,$6)", [
      team.id,
      JSON.stringify(files),
      label,
      kind,
      me.id,
      t,
    ]);
  }
  return json({ ok: true, version: updated.version, files: kind === "manual" ? undefined : files });
}
