// Small helper for the test scripts: log in as admin and set the event phase.
const BASE = process.env.BASE || "http://localhost:3000";
const phase = process.argv[2] || "hacking";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ passcode: process.env.ADMIN_PASSCODE || "admin-dev" }),
});
if (!login.ok) throw new Error("admin login failed: " + login.status);
const cookie = login.headers.get("set-cookie").split(";")[0];
const res = await fetch(`${BASE}/api/admin/action`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ action: "setPhase", phase }),
});
if (!res.ok) throw new Error("setPhase failed: " + (await res.text()));
console.log("phase is now", phase);
