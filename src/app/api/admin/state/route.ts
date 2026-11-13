import { fail, isAdmin, json } from "@/lib/auth";
import { adminState } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return fail("Admin login needed.", 401);
  return json(await adminState());
}
