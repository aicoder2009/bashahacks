import { json } from "@/lib/auth";
import { checkDatabase, findDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public status check. It says which settings are present and whether the database answers,
// but never returns a value, a key, or the database address.
export async function GET() {
  const db = findDatabaseUrl();
  const database = db ? { found: true, variable: db.name, ...(await checkDatabase()) } : { found: false, ok: false };
  return json({
    ok: database.ok,
    database,
    settings: {
      appSecret: !!process.env.APP_SECRET && process.env.APP_SECRET.length >= 8,
      adminPasscode: !!process.env.ADMIN_PASSCODE,
      openrouterManagementKey: !!process.env.OPENROUTER_MANAGEMENT_KEY,
      openrouterBackupKey: !!process.env.OPENROUTER_API_KEY,
      practiceAi: process.env.AI_MOCK === "1",
    },
  });
}
