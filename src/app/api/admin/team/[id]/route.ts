import { fail, isAdmin, json } from "@/lib/auth";
import type { AdminTeamDetail } from "@/lib/admin";
import { q, q1 } from "@/lib/db";
import type { Files } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return fail("Admin login needed.", 401);
  const { id } = await ctx.params;

  const team = await q1<{ id: string; name: string; code: string; slug: string; files: Files | null; published_files: Files | null }>(
    "SELECT id, name, code, slug, files, published_files FROM teams WHERE id=$1",
    [String(id)]
  );
  if (!team) return fail("That team does not exist anymore.", 404);

  const rows = await q<{ role: "user" | "assistant"; content: string; member_name: string | null; created_at: number }>(
    `SELECT x.role, x.content, x.created_at, m.name AS member_name
     FROM (SELECT * FROM messages WHERE team_id=$1 ORDER BY id DESC LIMIT 100) x
     LEFT JOIN members m ON m.id = x.member_id
     ORDER BY x.id`,
    [team.id]
  );

  const out: AdminTeamDetail = {
    team: { name: team.name, code: team.code, slug: team.slug },
    files: team.files || {},
    publishedFiles: team.published_files,
    messages: rows.map((r) => ({
      role: r.role,
      content: r.content,
      memberName: r.role === "assistant" ? "AI" : r.member_name || "Former member",
      createdAt: r.created_at,
    })),
  };
  return json(out);
}
