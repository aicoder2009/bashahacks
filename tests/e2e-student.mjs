// End-to-end check of the solo student flow against a local server with the fake AI.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "/var/tmp/bh-shots";
const eventCode = process.env.EVENT_CODE || execSync(`psql -h 127.0.0.1 -p 54329 -U postgres bh -tAc "SELECT value->>'eventCode' FROM settings WHERE key='event'"`).toString().trim();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  const t = m.text();
  // Expected noise: rejected logins show up as failed requests, and screenshots trip a dev-only hydration note.
  if (m.type() === "error" && !/Failed to load resource|hydrat/i.test(t)) errors.push("console: " + t);
});

const step = (s) => console.log("•", s);

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${SHOTS}/01-join-code.png` });
step("wrong event code is rejected");
await page.fill("#code", "ZZZZ99");
await page.click("text=Next");
await page.waitForSelector("text=does not match");
await page.fill("#code", eventCode);
await page.click("text=Next");
await page.fill("#name", "Maya R");
await page.click("text=Next");
await page.waitForSelector("text=Pick your character");
await page.click("text=Shuffle");
await page.screenshot({ path: `${SHOTS}/02-join-avatar.png` });
await page.click("text=Looks good");
await page.screenshot({ path: `${SHOTS}/03-join-mode.png` });
step("go solo");
await page.click("text=Go solo");
await page.waitForURL("**/build");
await page.waitForSelector("text=What problem have you noticed?");
await page.screenshot({ path: `${SHOTS}/04-build-empty.png` });

step("idea card fills the prompt");
await page.click("text=Water use");
await page.click("text=Build a shower timer");
await page.screenshot({ path: `${SHOTS}/05-build-idea.png` });
await page.click("button:has-text('Send')");
await page.waitForSelector("text=wrote script.js", { timeout: 30000 });
await page.waitForSelector("text=Try next", { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/06-build-app.png` });

step("the preview runs and its storage works");
const frame = page.frameLocator("iframe[title='Your app']");
await frame.locator("#add").click();
await frame.locator("#add").click();
const count = await frame.locator("#count").textContent();
if (count !== "2") throw new Error("preview counter expected 2, got " + count);

step("sandbox: the app cannot read the site's cookies or storage");
const probe = await page.evaluate(async () => {
  const f = document.querySelector("iframe[title='Your app']");
  let sameOrigin = true;
  try { void f.contentWindow.document.body; } catch { sameOrigin = false; }
  return { sameOrigin, sandbox: f.getAttribute("sandbox") };
});
if (probe.sameOrigin || /same-origin/.test(probe.sandbox)) throw new Error("iframe is not isolated: " + JSON.stringify(probe));

step("code tab shows the files");
await page.click("role=tab[name='Code']");
await page.waitForSelector(".cm-content");
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/07-build-code.png` });
await page.click("role=tab[name='Preview']");

step("second request updates the app, then undo brings it back");
await page.fill("#chat-input", "Add a weekly chart");
await page.keyboard.press("Enter");
await page.waitForSelector("text=Latest change", { timeout: 30000 }).catch(() => {});
await frame.locator("text=Latest change").waitFor({ timeout: 30000 });
await page.click("button:has-text('Undo')");
await frame.locator("text=Idea:").waitFor({ timeout: 15000 });

step("publish");
await page.click("button:has-text('Publish')");
await page.waitForSelector("text=Your app is live");
const link = await page.inputValue("input[aria-label='Link to your app']");
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/08-publish.png` });
await page.keyboard.press("Escape");

step("published link opens for a logged-out visitor: " + link);
const anon = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const pub = await anon.newPage();
await pub.goto(link);
await pub.frameLocator("iframe").locator("#add").click();
await pub.screenshot({ path: `${SHOTS}/09-published.png` });
await anon.close();

step("submit");
await page.click("header >> button:has-text('Submit')");
await page.fill("#s-problem", "People in my house take very long showers and waste water.");
await page.fill("#s-solution", "The app times each shower and shows how many gallons were used.");
await page.click("text=At home");
await page.screenshot({ path: `${SHOTS}/10-submit.png` });
await page.click("form >> button:has-text('Submit')");
await page.waitForSelector("text=Your app is in");
await page.click("text=Back to building");
await page.waitForSelector("text=Submitted ✓");

step("team dialog shows the code");
await page.click("[title='Your team and code']");
await page.waitForSelector("text=Your code to get back in");
await page.screenshot({ path: `${SHOTS}/11-team.png` });
await page.keyboard.press("Escape");

step("light theme");
await page.click("[title='Light or dark']");
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/12-build-light.png` });

await browser.close();
if (errors.length) {
  console.log("BROWSER ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK: student flow passed");
