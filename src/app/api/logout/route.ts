import { clearCookie, json } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const role = body.role === "judge" || body.role === "admin" ? body.role : "student";
  return json({ ok: true }, { cookies: [clearCookie(role)] });
}
