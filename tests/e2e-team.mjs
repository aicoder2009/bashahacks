// Two students on one team: shared app, shared chat, live updates, one AI turn at a time.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "/var/tmp/bh-shots";
const eventCode = process.env.EVENT_CODE || execSync(`psql -h 127.0.0.1 -p 54329 -U postgres bh -tAc "SELECT value->>'eventCode' FROM settings WHERE key='event'"`).toString().trim();
const step = (s) => console.log("•", s);

const browser = await chromium.launch();
const errors = [];
async function student(name) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto(BASE + "/join");
  await page.waitForLoadState("networkidle");
  await page.fill("#code", eventCode);
  await page.click("text=Next");
  await page.fill("#name", name);
  await page.click("text=Next");
  await page.click("text=Looks good");
  return page;
}

step("Ana creates a team");
const ana = await student("Ana P");
await ana.click("text=Create a team");
await ana.fill("#tname", "Solar Foxes");
await ana.click("button:has-text('Create team')");
await ana.waitForSelector("text=Team Solar Foxes is ready");
const code = (await ana.locator("p.mono.pop-in").textContent()).trim();
await ana.screenshot({ path: `${SHOTS}/20-team-created.png` });
await ana.click("text=Start building");
await ana.waitForURL("**/build");

step(`Ben joins with code ${code}`);
const ben = await student("Ben K");
await ben.click("text=Join a team");
await ben.fill("#tcode", code);
await ben.click("button:has-text('Join team')");
await ben.waitForURL("**/build");

step("a third and fourth student: team size limit holds at 3");
const cy = await student("Cy L");
await cy.click("text=Join a team");
await cy.fill("#tcode", code);
await cy.click("button:has-text('Join team')");
await cy.waitForURL("**/build");
const dee = await student("Dee M");
await dee.click("text=Join a team");
await dee.fill("#tcode", code);
await dee.click("button:has-text('Join team')");
await dee.waitForSelector("text=That team is full");

step("Ana asks the AI; Ben sees the request, the busy note, and then the app");
await ana.fill("#chat-input", "Build a recycling quiz");
await ana.keyboard.press("Enter");
await ben.waitForSelector("text=Build a recycling quiz", { timeout: 15000 });
await ben.frameLocator("iframe[title='Your app']").locator("#add").waitFor({ timeout: 30000 });
await ana.frameLocator("iframe[title='Your app']").locator("#add").waitFor({ timeout: 30000 });
await ben.waitForTimeout(600);
await ben.screenshot({ path: `${SHOTS}/21-team-ben.png` });

step("only one AI turn at a time");
const results = await Promise.all(
  [ana, ben].map((p) =>
    p.evaluate(async () => {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Change the colors" }) });
      if (r.ok) await r.text();
      return r.status;
    })
  )
);
if (results.sort().join() !== "200,409") throw new Error("expected one 200 and one 409, got " + results.join());

step("Ben edits the code by hand and Ana sees it");
await ben.click("role=tab[name='Code']");
await ben.waitForSelector(".cm-content");
await ben.waitForTimeout(3500); // let the second AI turn settle and sync
await ben.locator(".cm-content").click();
await ben.keyboard.press("Control+End");
await ben.keyboard.type("\n<p id=\"ben\">Edited by Ben</p>");
await ana.frameLocator("iframe[title='Your app']").locator("#ben").waitFor({ timeout: 20000 });

step("Ben's own preview shows the edit, after Restart and after a page reload too");
await ben.click("role=tab[name='Preview']");
const benApp = ben.frameLocator("iframe[title='Your app']");
await benApp.locator("#ben").waitFor({ timeout: 5000 });
await ben.click("text=Restart");
await benApp.locator("#ben").waitFor({ timeout: 5000 });
await ben.reload();
await benApp.locator("#ben").waitFor({ timeout: 15000 });

step("Ben signs out and gets back in with the team code");
await ben.click("[title='Your team and code']");
ben.once("dialog", (d) => d.accept());
await ben.click("text=Sign out on this computer");
await ben.waitForURL(BASE + "/join");
await ben.click("text=Already joined?");
await ben.fill("#rcode", code);
await ben.click("button:has-text('Find my team')");
await ben.click("button:has-text('Ben K')");
await ben.waitForURL("**/build");
await ben.waitForSelector("text=Build a recycling quiz");

await browser.close();
if (errors.length) {
  console.log("BROWSER ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK: team flow passed");
