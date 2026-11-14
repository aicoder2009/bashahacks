import { describe, expect, it } from "vitest";
import { buildSrcdoc } from "../../src/lib/sandbox";
import { eventBudgetLeft, remainingMs } from "../../src/lib/event";
import { classify } from "../../src/lib/openrouter";
import { usageView, type TeamRow } from "../../src/lib/store";
import { cleanAvatar, cleanLink, cleanText, fmtClock, isRude, percentLeft } from "../../src/lib/text";
import type { EventSettings } from "../../src/lib/types";

const settings = { totalBudgetUsd: 50, aiPausedAll: false } as EventSettings;
const team = (over: Partial<TeamRow>) => ({ cap_usd: 2.5, spent_usd: 0, ai_paused: false, ...over }) as TeamRow;

describe("AI limits", () => {
  it("moves the usage bar on the first request and reads 0 only when used up", () => {
    expect(percentLeft(1)).toBe(100);
    expect(percentLeft(1 - 0.02 / 4)).toBe(99);
    expect(percentLeft(0.99)).toBe(99);
    expect(percentLeft(0.004)).toBe(1);
    expect(percentLeft(0.3, true)).toBe(0);
    expect(percentLeft(0)).toBe(0);
  });

  it("shows the share of AI a team has left and never a dollar amount", () => {
    const view = usageView(team({ spent_usd: 1 }), settings, 10);
    expect(view).toEqual({ pctLeft: 0.6, blocked: false, reason: "" });
  });

  it("blocks a team at its cap", () => {
    expect(usageView(team({ spent_usd: 2.5 }), settings, 10)).toMatchObject({ blocked: true, reason: "cap", pctLeft: 0 });
  });

  it("blocks everyone one dollar before the event budget runs out", () => {
    expect(eventBudgetLeft(settings, 48.9)).toBeCloseTo(0.1);
    expect(eventBudgetLeft(settings, 49)).toBe(0);
    expect(usageView(team({ spent_usd: 0.1 }), settings, 49.2)).toMatchObject({ blocked: true, reason: "event" });
  });

  it("respects a pause from the officers", () => {
    expect(usageView(team({ ai_paused: true }), settings, 0).reason).toBe("paused");
    expect(usageView(team({}), { ...settings, aiPausedAll: true }, 0).reason).toBe("paused");
  });
});

describe("timer", () => {
  it("counts down to the end time, or holds while paused", () => {
    expect(remainingMs({ endsAt: 10_000, pausedRemainingMs: null }, 4_000)).toBe(6_000);
    expect(remainingMs({ endsAt: 10_000, pausedRemainingMs: null }, 20_000)).toBe(0);
    expect(remainingMs({ endsAt: 10_000, pausedRemainingMs: 90_000 }, 4_000)).toBe(90_000);
  });
  it("formats the clock", () => {
    expect(fmtClock(2 * 3600_000 + 41 * 60_000 + 10_000)).toBe("02:41:10");
    expect(fmtClock(-5)).toBe("00:00:00");
  });
});

describe("text cleaning", () => {
  it("trims names and catches rude ones", () => {
    expect(cleanText("  Maya   R.  ", 24)).toBe("Maya R.");
    expect(isRude("Sh1t head".replace("1", "i"))).toBe(true);
    expect(isRude("Maya R")).toBe(false);
  });
  it("lets real names and ordinary words through", () => {
    for (const ok of ["Ana L", "Mariana L.", "Ishita P", "Harshit K", "Nazia M", "Yoshi T", "Grape Counter", "Cucumber Log", "Water Analyzer", "Sky Savers", "Peacock Park"]) {
      expect(isRude(ok), ok).toBe(false);
    }
    for (const bad of ["Shit", "the FUCKERS", "anal", "Team Sex", "bullshitters", "kys"]) {
      expect(isRude(bad), bad).toBe(true);
    }
  });
  it("keeps avatar parts in range", () => {
    expect(cleanAvatar({ s: 99, c: -1, e: 2, m: "3", a: null })).toEqual({ s: 0, c: 0, e: 2, m: 3, a: 0 });
  });
});

describe("app sandbox", () => {
  const files = {
    "index.html": '<!doctype html><html><head><title>T</title><link rel="stylesheet" href="style.css"></head><body><h1>Hi</h1><script src="script.js"></script></body></html>',
    "style.css": "h1 { color: red; }",
    "script.js": "document.title = '</script><b>x';",
  };
  it("inlines the css and js and adds a strict content policy", () => {
    const doc = buildSrcdoc(files, { saved: "1" });
    expect(doc).toContain("h1 { color: red; }");
    expect(doc).not.toContain('href="style.css"');
    expect(doc).not.toContain('src="script.js"');
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain('"saved":"1"');
  });
  it("cannot be broken out of with a closing script tag", () => {
    const doc = buildSrcdoc(files);
    expect(doc).not.toContain("'</script><b>x'");
    const evil = buildSrcdoc(files, { k: "</script><script>alert(1)</script>" });
    expect(evil).not.toContain("</script><script>alert(1)");
  });
  it("wraps a bare snippet in a full page", () => {
    const doc = buildSrcdoc({ "index.html": "<p>just a paragraph</p>" });
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<body><p>just a paragraph</p></body>");
  });
});

describe("AI errors", () => {
  it("treats a refusal by the model's provider as a short hiccup, not as a bad key", () => {
    const provider = '{"message":"Provider returned error","code":401,"metadata":{"raw":"Incorrect API key provided"}}';
    expect(classify(401, provider).kind).toBe("busy");
    expect(classify(401, '{"message":"No auth credentials found","code":401}').kind).toBe("auth");
    expect(classify(402, '{"message":"Insufficient credits"}').kind).toBe("limit");
    expect(classify(429, "").kind).toBe("busy");
  });
});

describe("links to projects built somewhere else", () => {
  it("keeps normal web links and adds https when it is missing", () => {
    expect(cleanLink("https://replit.com/@maya/shower-saver")).toBe("https://replit.com/@maya/shower-saver");
    expect(cleanLink("  github.com/maya/app  ")).toBe("https://github.com/maya/app");
    expect(cleanLink("http://example.com")).toBe("http://example.com/");
    expect(cleanLink("")).toBe("");
    expect(cleanLink(undefined)).toBe("");
  });

  it("refuses anything that is not a plain web link", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://example.com/x", "not a link", "localhost", "https://user:pw@example.com", "https://example.com/" + "a".repeat(400)]) {
      expect(cleanLink(bad), bad).toBeNull();
    }
  });
});
