// Officers, judges, and the TV: one pass through a whole (tiny) event.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "/var/tmp/bh-shots";
const ADMIN = process.env.ADMIN_PASSCODE || "admin-dev";
const step = (s) => console.log("•", s);
const errors = [];

const browser = await chromium.launch();
const watch = (page, who) => {
  page.on("pageerror", (e) => errors.push(`${who} pageerror: ${e.message}`));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/Failed to load resource|hydrat/i.test(t)) errors.push(`${who} console: ${t}`);
  });
};

// --- Admin logs in through the page
const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const admin = await adminCtx.newPage();
watch(admin, "admin");
await admin.goto(`${BASE}/admin`);
await admin.waitForLoadState("networkidle");
await admin.screenshot({ path: `${SHOTS}/30-admin-login.png` });
step("admin: wrong passcode is rejected, right one gets in");
await admin.locator("input[type=password], input").first().fill("nope");
await admin.keyboard.press("Enter");
await admin.waitForTimeout(600);
await admin.locator("input[type=password], input").first().fill(ADMIN);
await admin.keyboard.press("Enter");
await admin.waitForSelector("text=Overview");

const act = (body) =>
  admin.evaluate(async (b) => {
    const r = await fetch("/api/admin/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    return { status: r.status, ...(await r.json()) };
  }, body);
const state = () => admin.evaluate(async () => (await fetch("/api/admin/state")).json());

step("admin: wipe old data, back to the lobby");
let out = await act({ action: "wipe", confirm: "nope" });
if (out.status !== 400) throw new Error("wipe without WIPE should fail");
out = await act({ action: "wipe", confirm: "WIPE" });
if (!out.ok) throw new Error("wipe failed: " + JSON.stringify(out));
let s = await state();
if (s.settings.phase !== "lobby" || s.teams.length !== 0) throw new Error("wipe did not reset");
const { eventCode, judgeCode, tvKey } = s.settings;

// --- TV in the lobby
const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await tvCtx.newPage();
watch(tv, "tv");
await tv.goto(`${BASE}/tv?key=wrong`);
await tv.waitForSelector("text=not valid");
await tv.goto(`${BASE}/tv?key=${tvKey}`);
await tv.waitForSelector(`text=${eventCode}`);

// --- Students join through the API (the join page has its own test)
async function student(name, mode, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  watch(page, name);
  await page.goto(BASE);
  const res = await page.evaluate(
    async (b) => {
      const r = await fetch("/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      return { status: r.status, ...(await r.json()) };
    },
    { eventCode, name, avatar: { s: name.length % 10, c: name.charCodeAt(0) % 8, e: 1, m: 1, a: name.length % 7 }, mode, ...extra }
  );
  if (res.status !== 200) throw new Error(`join ${name}: ${JSON.stringify(res)}`);
  return { page, team: res.team };
}
const call = (page, path, body) =>
  page.evaluate(
    async ([p, b]) => {
      const r = await fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      const text = await r.text();
      return { status: r.status, text };
    },
    [path, body]
  );

step("students join; the TV lobby shows them");
const maya = await student("Maya R", "solo");
const ana = await student("Ana P", "create", { teamName: "Solar Foxes" });
const ben = await student("Ben K", "join", { teamCode: ana.team.code });
const leo = await student("Leo T", "solo");
await tv.waitForSelector("text=Solar Foxes");
await tv.waitForTimeout(800);
await tv.screenshot({ path: `${SHOTS}/40-tv-lobby.png` });

step("building is closed in the lobby");
out = await call(maya.page, "/api/chat", { text: "Build a water tracker" });
if (out.status !== 403) throw new Error("chat should be closed in the lobby, got " + out.status);

step("admin starts building; the TV switches to the countdown");
out = await act({ action: "setPhase", phase: "hacking" });
if (!out.ok) throw new Error("setPhase failed");
await tv.waitForSelector("text=/time left/i", { timeout: 10000 });

step("students build, publish, and submit");
for (const [st, idea] of [[maya, "Shower timer"], [ana, "Lunch waste tracker"], [leo, "Recycling quiz"]]) {
  out = await call(st.page, "/api/chat", { text: `Build a ${idea}` });
  if (out.status !== 200 || !out.text.includes('"t":"done"')) throw new Error("chat failed: " + out.text.slice(0, 200));
}
for (const [st, title] of [[maya, "Shower Saver"], [ana, "Lunch Rescue"]]) {
  out = await call(st.page, "/api/submit", { title, problem: "We noticed a lot of waste every single day.", solution: "Our app tracks it so people can cut back.", category: "school" });
  if (out.status !== 200) throw new Error("submit failed: " + out.text);
}
await maya.page.goto(`${BASE}/build`);
await maya.page.waitForSelector("text=Submitted ✓");
await ben.page.goto(`${BASE}/build`);
await ben.page.waitForSelector("iframe[title='Your app']");

step("announcement reaches students (banner) and the TV (takeover)");
out = await act({ action: "announce", body: "Lunch is here. Grab a slice in K105.", urgent: false });
if (!out.ok) throw new Error("announce failed");
await maya.page.waitForSelector("text=Lunch is here. Grab a slice in K105.", { timeout: 10000 });
await tv.waitForSelector("text=Lunch is here. Grab a slice in K105.", { timeout: 10000 });
await tv.waitForTimeout(500);
await tv.screenshot({ path: `${SHOTS}/41-tv-announcement.png` });
await maya.page.screenshot({ path: `${SHOTS}/31-student-banner.png` });
await maya.page.click("button:has-text('Got it')");
step("urgent announcement needs a click to dismiss");
await act({ action: "announce", body: "Fire drill. Leave everything and line up at the door.", urgent: true });
await maya.page.waitForSelector("text=Important announcement", { timeout: 10000 });
await maya.page.screenshot({ path: `${SHOTS}/32-student-urgent.png` });
await maya.page.click("button:has-text('I got it')");

step("AI limits: a team at its cap is blocked, and a top-up unblocks it");
s = await state();
const mayaTeam = s.teams.find((t) => t.members.some((m) => m.name === "Maya R"));
out = await act({ action: "setCap", teamId: mayaTeam.id, capUsd: 0.02 });
if (!out.ok) throw new Error("setCap down failed: " + JSON.stringify(out));
out = await call(maya.page, "/api/chat", { text: "Add a chart" });
if (out.status !== 402) throw new Error("expected 402 at the cap, got " + out.status);
await maya.page.waitForSelector("text=used all of its AI", { timeout: 10000 });
await maya.page.screenshot({ path: `${SHOTS}/33-student-out-of-ai.png` });
out = await act({ action: "setCap", teamId: mayaTeam.id, capUsd: 9999 });
if (out.status !== 400) throw new Error("a cap above the budget must be refused");
out = await act({ action: "setCap", teamId: mayaTeam.id, capUsd: 60 });
if (out.status !== 400) throw new Error("a top-up past the event budget must be refused, got " + out.status);
out = await act({ action: "setCap", teamId: mayaTeam.id, capUsd: 2.5 });
if (!out.ok) throw new Error("top-up failed");
out = await call(maya.page, "/api/chat", { text: "Add a chart" });
if (out.status !== 200) throw new Error("chat should work again after the top-up, got " + out.status);

step("pause AI for everyone, then turn it back on");
await act({ action: "updateSettings", patch: { aiPausedAll: true } });
out = await call(leo.page, "/api/chat", { text: "Change the colors" });
if (out.status !== 402) throw new Error("expected 402 while paused");
await act({ action: "updateSettings", patch: { aiPausedAll: false } });

step("admin pages");
await admin.waitForTimeout(3500);
await admin.screenshot({ path: `${SHOTS}/34-admin-overview.png` });
for (const tab of ["Event", "Announce", "Teams", "AI", "Judging", "Settings"]) {
  await admin.locator(`nav >> text=${tab}`).first().click();
  await admin.waitForTimeout(700);
  await admin.screenshot({ path: `${SHOTS}/35-admin-${tab.toLowerCase()}.png`, fullPage: true });
}

step("time is up: building closes, the TV shows judging");
out = await act({ action: "setPhase", phase: "judging" });
out = await call(maya.page, "/api/chat", { text: "One more thing" });
if (out.status !== 403) throw new Error("chat should be closed after time is up");
out = await call(maya.page, "/api/publish", {});
if (out.status !== 403) throw new Error("publish should be closed after time is up");
await tv.waitForSelector("text=/judging/i", { timeout: 10000 });
await tv.waitForTimeout(600);
await tv.screenshot({ path: `${SHOTS}/42-tv-judging.png` });

// --- Judges, on a phone
step("judge: wrong passcode is rejected, then scores on a phone");
const judgeCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const judge = await judgeCtx.newPage();
watch(judge, "judge");
await judge.goto(`${BASE}/judges`);
await judge.waitForLoadState("networkidle");
await judge.screenshot({ path: `${SHOTS}/50-judge-login.png` });
const jcall = (path, body) =>
  judge.evaluate(
    async ([p, b]) => {
      const r = await fetch(p, { method: b ? "POST" : "GET", headers: b ? { "content-type": "application/json" } : undefined, body: b ? JSON.stringify(b) : undefined });
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    },
    [path, body]
  );
out = await jcall("/api/judges/login", { code: "WRONG", name: "Ms. Rivera" });
if (out.status === 200) throw new Error("wrong judge code accepted");
out = await jcall("/api/judges/state");
if (out.status !== 401) throw new Error("judge state should need a login");
const inputs = judge.locator("input");
await inputs.nth(0).fill(judgeCode);
await inputs.nth(1).fill("Ms. Rivera");
await judge.keyboard.press("Enter");
await judge.waitForSelector("text=Shower Saver");
await judge.waitForTimeout(400);
await judge.screenshot({ path: `${SHOTS}/51-judge-list.png` });
await judge.click("text=Shower Saver");
await judge.waitForSelector("text=Sustainability impact");
await judge.waitForTimeout(600);
await judge.screenshot({ path: `${SHOTS}/52-judge-score.png`, fullPage: true });

let js = await jcall("/api/judges/state");
const crit = js.criteria.map((c) => c.id);
const byTitle = Object.fromEntries(js.teams.map((t) => [t.appTitle, t.teamId]));
if (!byTitle["Shower Saver"] || !byTitle["Lunch Rescue"]) throw new Error("judge list is missing submissions: " + Object.keys(byTitle));
step("judge: taps a score in the page, and it is saved");
await judge.locator("button:has-text('5')").first().click();
await judge.waitForTimeout(900);
js = await jcall("/api/judges/state");
const tapped = js.teams.find((t) => t.teamId === byTitle["Shower Saver"]).scores;
if (!Object.values(tapped).includes(5)) throw new Error("tapped score was not saved: " + JSON.stringify(tapped));

const other = Object.keys(byTitle).find((k) => !["Shower Saver", "Lunch Rescue"].includes(k));
const plan = { "Shower Saver": 5, "Lunch Rescue": 4, [other]: 2 };
for (const [title, value] of Object.entries(plan)) {
  for (const c of crit) {
    out = await jcall("/api/judges/score", { teamId: byTitle[title], criterionId: c, value });
    if (out.status !== 200) throw new Error("score failed: " + JSON.stringify(out));
  }
}
out = await jcall("/api/judges/score", { teamId: byTitle["Shower Saver"], criterionId: crit[0], value: 9 });
if (out.status === 200) throw new Error("a score of 9 must be refused");
out = await jcall("/api/judges/score", { teamId: byTitle["Shower Saver"], comment: "Clear demo, great idea." });
if (out.status !== 200) throw new Error("comment failed");

step("a second judge on a laptop; the leaderboard averages both");
const j2ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const j2 = await j2ctx.newPage();
watch(j2, "judge2");
await j2.goto(`${BASE}/judges`);
await j2.evaluate(
  async ([code]) => {
    await fetch("/api/judges/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name: "Mr. Chen" }) });
  },
  [judgeCode]
);
for (const c of crit) {
  await j2.evaluate(
    async ([teamId, criterionId]) => {
      await fetch("/api/judges/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId, criterionId, value: 3 }) });
    },
    [byTitle["Shower Saver"], c]
  );
}
await j2.reload();
await j2.waitForSelector("text=Shower Saver");
await j2.click("text=Shower Saver");
await j2.waitForSelector("text=Sustainability impact");
await j2.waitForTimeout(1200);
await j2.screenshot({ path: `${SHOTS}/53-judge-laptop.png` });

s = await state();
const top = s.leaderboard.slice(0, 3).map((r) => `${r.appTitle}:${r.score}`);
// Shower Saver: judges gave 5 and 3, so 4 of 5 = 80. Lunch Rescue: 4 of 5 = 80. Third: 2 of 5 = 40.
if (s.leaderboard[0].score !== 80 || s.leaderboard[1].score !== 80 || s.leaderboard[2].score !== 40) throw new Error("leaderboard is wrong: " + top);
if (s.leaderboard[0].appTitle !== "Shower Saver") throw new Error("tie should go to the team with more judges: " + top);

step("results download");
const csv = await admin.evaluate(async () => (await fetch("/api/admin/export")).text());
if (!csv.includes("Shower Saver") || !csv.split("\n")[0].toLowerCase().includes("rank")) throw new Error("CSV looks wrong: " + csv.slice(0, 200));

step("winners reveal on the TV, one place at a time");
out = await act({ action: "lockPodium" });
if (!out.ok) throw new Error("lockPodium failed: " + JSON.stringify(out));
await tv.waitForSelector("text=/winners are/i", { timeout: 10000 });
await tv.screenshot({ path: `${SHOTS}/43-tv-podium-0.png` });
for (const n of [1, 2, 3]) {
  await act({ action: "podiumStep", step: n });
  await tv.waitForTimeout(3600);
  await tv.screenshot({ path: `${SHOTS}/43-tv-podium-${n}.png` });
}
if (!(await tv.locator("text=Shower Saver").count())) throw new Error("first place is not on the TV");
out = await jcall("/api/judges/score", { teamId: byTitle["Shower Saver"], criterionId: crit[0], value: 1 });
if (out.status !== 403) throw new Error("scores must be locked once results are locked");

step("no secrets leak to the TV or to students");
const tvJson = await tv.evaluate(async (k) => (await fetch(`/api/tv?key=${k}`)).text(), tvKey);
if (tvJson.includes(judgeCode) || /spent|cap_usd|capUsd/i.test(tvJson)) throw new Error("TV payload leaks private data");
const syncJson = await maya.page.evaluate(async () => (await fetch("/api/sync?v=-1")).text());
if (/usd|judgeCode|tvKey|sk-or/i.test(syncJson)) throw new Error("student payload leaks private data");
out = await call(maya.page, "/api/admin/action", { action: "wipe", confirm: "WIPE" });
if (out.status !== 401) throw new Error("students must not reach admin actions");

await act({ action: "setPhase", phase: "done" });
await tv.waitForTimeout(3000);
await tv.screenshot({ path: `${SHOTS}/44-tv-done.png` });

await browser.close();
if (errors.length) {
  console.log("BROWSER ERRORS:\n" + [...new Set(errors)].join("\n"));
  process.exit(1);
}
console.log("OK: event flow passed");
