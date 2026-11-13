import { fail, json, safeEqual, sessionCookie, tooManyAttempts } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { getSettings } from "@/lib/event";
import { randomId } from "@/lib/ids";
import { cleanText } from "@/lib/text";

export const dynamic = "force-dynamic";

const norm = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (tooManyAttempts(req, "judge", 30)) return fail("Too many tries. Wait a minute and try again.", 429);

  const s = await getSettings();
  const code = norm(body.code);
  const expected = norm(s.judgeCode);
  if (!code || !expected || !safeEqual(code, expected)) {
    return fail("That passcode does not match. Ask an officer for the judge passcode.", 403);
  }

  const name = cleanText(body.name, 30);
  if (name.length < 2) return fail("Please type your name.");

  // The same name always maps to the same judge, so logging in on a second device keeps their scores.
  let judge = await q1<{ id: string; name: string }>(
    "SELECT id, name FROM judges WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1",
    [name]
  );
  if (!judge) {
    judge = { id: randomId(12), name };
    await q("INSERT INTO judges (id, name, created_at) VALUES ($1,$2,$3)", [judge.id, judge.name, Date.now()]);
  }

  return json(
    { ok: true, judge: { id: judge.id, name: judge.name } },
    { cookies: [sessionCookie("judge", { judgeId: judge.id, name: judge.name })] }
  );
}
