import { fail, json } from "@/lib/auth";
import { q1 } from "@/lib/db";
import type { TeamRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const team = await q1<TeamRow>("SELECT * FROM teams WHERE slug=$1", [String(slug).toLowerCase()]);
  if (!team || !team.published_files) return fail("This app has not been published yet.", 404);
  return json({ title: team.app_title || "Untitled app", teamName: team.name, files: team.published_files, publishedAt: team.published_at });
}
