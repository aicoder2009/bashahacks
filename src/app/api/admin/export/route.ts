import { fail, isAdmin } from "@/lib/auth";
import { csvRow } from "@/lib/admin";
import { q } from "@/lib/db";
import { leaderboard } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return fail("Admin login needed.", 401);

  const [board, subs] = await Promise.all([
    leaderboard(),
    q<{ team_id: string; category: string; problem: string; solution: string }>(
      "SELECT team_id, category, problem, solution FROM submissions"
    ),
  ]);
  const subByTeam = new Map(subs.map((s) => [s.team_id, s]));

  const lines = [
    csvRow(["rank", "team", "members", "app title", "score", "judges count", "submitted", "category", "problem", "solution", "published link", "outside project link"]),
  ];
  let rank = 0;
  for (const row of board) {
    const sub = subByTeam.get(row.teamId);
    // Only teams that at least one judge scored get a rank.
    const place = row.judgeCount > 0 ? ++rank : "";
    lines.push(
      csvRow([
        place,
        row.teamName,
        row.members.map((m) => m.name).join("; "),
        row.appTitle,
        row.score,
        row.judgeCount,
        row.submitted ? "yes" : "no",
        sub?.category || "",
        sub?.problem || "",
        sub?.solution || "",
        `/p/${row.slug}`,
        row.link,
      ])
    );
  }

  // The byte order mark makes Excel read names with accents correctly.
  return new Response(String.fromCharCode(0xfeff) + lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="basha-hacks-results.csv"',
      "cache-control": "no-store",
    },
  });
}
