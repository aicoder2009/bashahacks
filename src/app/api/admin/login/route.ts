import { fail, json, safeEqual, sessionCookie, tooManyAttempts } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = (process.env.ADMIN_PASSCODE || "").trim();
  if (!expected) return fail("The admin passcode is not set up yet.", 503);
  if (tooManyAttempts(req, "admin", 20)) return fail("Too many tries. Wait a minute and try again.", 429);

  const body = await req.json().catch(() => ({}));
  const given = String(body?.passcode ?? "").trim();
  if (!given || !safeEqual(given, expected)) return fail("That passcode is not right.", 403);

  return json({ ok: true }, { cookies: [sessionCookie("admin", { admin: true })] });
}
