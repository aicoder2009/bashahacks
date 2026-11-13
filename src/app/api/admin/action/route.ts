import { decrypt, fail, isAdmin, json } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { eventBudgetLeft, forgetSpendCache, getSettings, totalSpend, updateSettings } from "@/lib/event";
import { randomId } from "@/lib/ids";
import {
  AiError,
  getCredits,
  hasManagementKey,
  listModels,
  mintKey,
  mockMode,
  pickDefaultModel,
  setKeyLimit,
  streamChat,
  type KeyRow,
} from "@/lib/openrouter";
import { leaderboard, podiumFrom } from "@/lib/store";
import { cleanMultiline, cleanText } from "@/lib/text";
import type { EventSettings, Phase, ScheduleItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = Record<string, unknown>;
type Result = Record<string, unknown> | void;

class ActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function bad(message: string, status = 400): never {
  throw new ActionError(message, status);
}

const PHASES: Phase[] = ["lobby", "hacking", "judging", "winners", "done"];
const MINUTE = 60_000;

function num(value: unknown, min: number, max: number, what: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) bad(`${what} needs to be a number from ${min} to ${max}.`);
  return n;
}

function int(value: unknown, min: number, max: number, what: string): number {
  const n = num(value, min, max, what);
  if (!Number.isInteger(n)) bad(`${what} needs to be a whole number from ${min} to ${max}.`);
  return n;
}

function bool(value: unknown, what: string): boolean {
  if (typeof value !== "boolean") bad(`${what} needs to be on or off.`);
  return value as boolean;
}

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const normCode = (value: unknown) => str(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const money = (n: number) => "$" + n.toFixed(2);

function aiProblem(e: unknown): string {
  if (e instanceof AiError) {
    if (e.kind === "auth") return "OpenRouter did not accept the key.";
    if (e.kind === "limit") return "OpenRouter says the key or the account is out of credit.";
    if (e.kind === "model") return "OpenRouter does not know that model. Pick another one on the AI tab.";
    if (e.kind === "busy") return "OpenRouter is busy right now. Try again in a few seconds.";
    return "OpenRouter returned an error" + (e.status ? ` (${e.status})` : "") + ".";
  }
  if (e instanceof Error && e.name === "TimeoutError") return "OpenRouter took too long to answer.";
  return "Could not reach OpenRouter.";
}

type TeamLite = { id: string; name: string; solo: boolean; cap_usd: number; spent_usd: number };

async function needTeam(id: unknown): Promise<TeamLite> {
  const team = await q1<TeamLite>("SELECT id, name, solo, cap_usd, spent_usd FROM teams WHERE id=$1", [str(id)]);
  if (!team) bad("That team does not exist anymore.", 404);
  return team as TeamLite;
}

async function needMember(id: unknown): Promise<{ id: string; team_id: string; name: string }> {
  const member = await q1<{ id: string; team_id: string; name: string }>("SELECT id, team_id, name FROM members WHERE id=$1", [str(id)]);
  if (!member) bad("That student is not on a team anymore.", 404);
  return member as { id: string; team_id: string; name: string };
}

/** Checks an officer's settings edit against the whitelist and returns only the safe parts. */
function cleanSettingsPatch(input: unknown, current: EventSettings): Partial<EventSettings> {
  if (!input || typeof input !== "object" || Array.isArray(input)) bad("Nothing to save.");
  const src = input as Body;
  const patch: Partial<EventSettings> = {};

  if ("eventName" in src) {
    const v = cleanText(src.eventName, 60);
    if (v.length < 2) bad("The event name needs at least 2 characters.");
    patch.eventName = v;
  }
  if ("eventCode" in src) {
    const v = str(src.eventCode).trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(v)) bad("The event code needs 4 to 10 letters and digits, with no spaces.");
    patch.eventCode = v;
  }
  if ("judgeCode" in src) {
    const v = cleanText(src.judgeCode, 40);
    if (v.length < 4) bad("The judge passcode needs at least 4 characters.");
    patch.judgeCode = v;
  }
  if ("teamsAllowed" in src) patch.teamsAllowed = bool(src.teamsAllowed, "Teams allowed");
  if ("maxTeamSize" in src) patch.maxTeamSize = int(src.maxTeamSize, 1, 6, "Team size");
  if ("model" in src) patch.model = cleanText(src.model, 120);
  if ("defaultCapUsd" in src) patch.defaultCapUsd = num(src.defaultCapUsd, 0.1, 20, "The starting AI amount per team");
  if ("totalBudgetUsd" in src) patch.totalBudgetUsd = num(src.totalBudgetUsd, 1, 500, "The total AI budget");
  if ("autoStart" in src) patch.autoStart = bool(src.autoStart, "Auto start");
  if ("autoEnd" in src) patch.autoEnd = bool(src.autoEnd, "Auto end");
  if ("aiPausedAll" in src) patch.aiPausedAll = bool(src.aiPausedAll, "Pause AI for everyone");

  const time = (value: unknown, what: string) => {
    const n = Number(value);
    if (typeof value !== "number" || !Number.isFinite(n) || n < Date.UTC(2020, 0, 1) || n > Date.UTC(2100, 0, 1)) {
      bad(`${what} is not a time I can read.`);
    }
    return Math.round(n);
  };
  if ("startsAt" in src) patch.startsAt = time(src.startsAt, "The start time");
  if ("endsAt" in src) patch.endsAt = time(src.endsAt, "The end time");
  if (patch.startsAt != null || patch.endsAt != null) {
    const start = patch.startsAt ?? current.startsAt;
    const end = patch.endsAt ?? current.endsAt;
    if (end <= start) bad("The end time needs to be after the start time.");
  }

  if ("schedule" in src) {
    if (!Array.isArray(src.schedule)) bad("The schedule needs to be a list.");
    const rows = src.schedule as unknown[];
    if (rows.length > 12) bad("The schedule can have up to 12 rows.");
    const schedule: ScheduleItem[] = [];
    for (const row of rows) {
      const r = (row && typeof row === "object" ? row : {}) as Body;
      const item = { time: cleanText(r.time, 12), label: cleanText(r.label, 60) };
      if (!item.time && !item.label) continue;
      if (!item.label) bad("Every schedule row needs a label.");
      schedule.push(item);
    }
    patch.schedule = schedule;
  }

  if (Object.keys(patch).length === 0) bad("Nothing to save.");
  return patch;
}

const actions: Record<string, (b: Body) => Promise<Result>> = {
  /* ---------- Event ---------- */

  async setPhase(b) {
    const phase = str(b.phase) as Phase;
    if (!PHASES.includes(phase)) bad("Pick one of the five phases.");
    const s = await getSettings(true);
    const t = Date.now();
    const patch: Partial<EventSettings> = { phase, pausedRemainingMs: null };
    // Without this the timer would move the event straight back to building.
    if (phase === "lobby") patch.autoStart = false;
    if (phase === "hacking") {
      // If building is paused right now, keep the time that was left.
      if (s.phase === "hacking" && s.pausedRemainingMs != null) patch.endsAt = t + Math.max(0, s.pausedRemainingMs);
      if ((patch.endsAt ?? s.endsAt) <= t) patch.endsAt = t + 30 * MINUTE;
    }
    return { settings: await updateSettings(patch) };
  },

  async pause() {
    const s = await getSettings(true);
    if (s.phase !== "hacking") bad("The timer can only be paused while building is open.");
    if (s.pausedRemainingMs != null) bad("The timer is already paused.");
    return { settings: await updateSettings({ pausedRemainingMs: Math.max(0, s.endsAt - Date.now()) }) };
  },

  async resume() {
    const s = await getSettings(true);
    if (s.pausedRemainingMs == null) bad("The timer is not paused.");
    const left = Math.max(0, s.pausedRemainingMs as number);
    return { settings: await updateSettings({ endsAt: Date.now() + left, pausedRemainingMs: null }) };
  },

  async addTime(b) {
    const minutes = int(b.minutes, 1, 240, "Minutes");
    const s = await getSettings(true);
    const t = Date.now();
    let patch: Partial<EventSettings>;
    if (s.phase === "judging") {
      // Reopen building for a short while.
      patch = { phase: "hacking", endsAt: t + minutes * MINUTE, pausedRemainingMs: null };
    } else if (s.pausedRemainingMs != null) {
      patch = { pausedRemainingMs: Math.max(0, s.pausedRemainingMs) + minutes * MINUTE };
    } else if (s.phase === "hacking") {
      patch = { endsAt: Math.max(s.endsAt, t) + minutes * MINUTE };
    } else {
      patch = { endsAt: s.endsAt + minutes * MINUTE };
    }
    return { settings: await updateSettings(patch) };
  },

  async updateSettings(b) {
    const current = await getSettings(true);
    const patch = cleanSettingsPatch(b.patch, current);
    return { settings: await updateSettings(patch) };
  },

  async regenTvKey() {
    return { settings: await updateSettings({ tvKey: randomId(10) }) };
  },

  /* ---------- Announcements ---------- */

  async announce(b) {
    const body = cleanMultiline(b.body, 280);
    if (!body) bad("Type a message first.");
    const row = await q1<{ id: number; body: string; urgent: boolean; created_at: number }>(
      "INSERT INTO announcements (body, urgent, created_at) VALUES ($1,$2,$3) RETURNING *",
      [body, b.urgent === true, Date.now()]
    );
    return { announcement: row ? { id: row.id, body: row.body, urgent: row.urgent, createdAt: row.created_at } : null };
  },

  async deleteAnnouncement(b) {
    await q("DELETE FROM announcements WHERE id=$1", [int(b.id, 1, 2_000_000_000, "The announcement id")]);
  },

  /* ---------- Teams ---------- */

  async renameTeam(b) {
    const team = await needTeam(b.teamId);
    const name = cleanText(b.name, 28);
    if (name.length < 2) bad("The team name needs at least 2 characters.");
    await q("UPDATE teams SET name=$2 WHERE id=$1", [team.id, name]);
  },

  async renameMember(b) {
    const member = await needMember(b.memberId);
    const name = cleanText(b.name, 24);
    if (name.length < 2) bad("The name needs at least 2 characters.");
    await q("UPDATE members SET name=$2 WHERE id=$1", [member.id, name]);
  },

  async removeMember(b) {
    const member = await needMember(b.memberId);
    await q("DELETE FROM members WHERE id=$1", [member.id]);
    await q("UPDATE teams SET busy_by=NULL WHERE id=$1 AND busy_by=$2", [member.team_id, member.id]);
  },

  async moveMember(b) {
    const member = await needMember(b.memberId);
    const code = normCode(b.teamCode);
    if (!code) bad("Type the code of the team to move them to.");
    const target = await q1<{ id: string; name: string }>("SELECT id, name FROM teams WHERE code=$1", [code]);
    if (!target) bad("No team has that code.", 404);
    const to = target as { id: string; name: string };
    if (to.id === member.team_id) bad("They are already on that team.");
    const s = await getSettings();
    const count = await q1<{ n: number }>("SELECT COUNT(*)::int AS n FROM members WHERE team_id=$1", [to.id]);
    if ((count?.n || 0) >= s.maxTeamSize) bad(`That team is full. Teams can have up to ${s.maxTeamSize} people.`);
    await q("UPDATE members SET team_id=$2 WHERE id=$1", [member.id, to.id]);
    await q("UPDATE teams SET solo=false WHERE id=$1", [to.id]);
    await q("UPDATE teams SET busy_by=NULL WHERE id=$1 AND busy_by=$2", [member.team_id, member.id]);
    return { teamName: to.name };
  },

  async setSolo(b) {
    const team = await needTeam(b.teamId);
    const solo = bool(b.solo, "Solo");
    if (solo) {
      const count = await q1<{ n: number }>("SELECT COUNT(*)::int AS n FROM members WHERE team_id=$1", [team.id]);
      if ((count?.n || 0) > 1) bad("This team has more than one person, so it cannot be marked solo.");
    }
    await q("UPDATE teams SET solo=$2 WHERE id=$1", [team.id, solo]);
  },

  async deleteTeam(b) {
    const team = await needTeam(b.teamId);
    await q("UPDATE ai_keys SET team_id=NULL WHERE team_id=$1", [team.id]);
    for (const table of ["members", "messages", "versions", "submissions", "scores", "judge_notes"]) {
      await q(`DELETE FROM ${table} WHERE team_id=$1`, [team.id]);
    }
    await q("DELETE FROM teams WHERE id=$1", [team.id]);
  },

  async pauseTeam(b) {
    const team = await needTeam(b.teamId);
    await q("UPDATE teams SET ai_paused=$2 WHERE id=$1", [team.id, bool(b.paused, "Paused")]);
  },

  async setCap(b) {
    const team = await needTeam(b.teamId);
    const capUsd = Math.round(num(b.capUsd, 0, 100, "The AI amount") * 100) / 100;
    const s = await getSettings(true);
    const left = eventBudgetLeft(s, await totalSpend(true));
    if (capUsd - team.spent_usd > left + 0.0001) {
      bad(
        `That is more than the event has left. There is ${money(left)} left in the event budget, so the most this team can be set to is ${money(
          Math.floor((team.spent_usd + left) * 100) / 100
        )}. Raise the total budget on the AI tab if you need more.`
      );
    }
    await q("UPDATE teams SET cap_usd=$2 WHERE id=$1", [team.id, capUsd]);

    let warning: string | undefined;
    const key = await q1<KeyRow>("SELECT * FROM ai_keys WHERE team_id=$1 AND kind='team' ORDER BY created_at LIMIT 1", [team.id]);
    if (key && hasManagementKey()) {
      try {
        await setKeyLimit(key.hash, capUsd);
        await q("UPDATE ai_keys SET limit_usd=$2 WHERE id=$1", [key.id, capUsd]);
      } catch (e) {
        console.error("[admin] setKeyLimit failed", e);
        warning = `Saved here, but OpenRouter did not update the limit on this team's key. ${aiProblem(e)} Try again in a moment.`;
      }
    }
    return { capUsd, warning };
  },

  /* ---------- AI ---------- */

  async prepareKeys(b) {
    const count = int(b.count, 1, 30, "The number of keys");
    if (mockMode()) {
      return { created: 0, note: "The AI is in practice mode, so no real keys are needed. Nothing was made." };
    }
    if (!hasManagementKey()) bad("The OpenRouter management key is not set on the server, so team keys cannot be made.", 503);
    const s = await getSettings(true);
    let created = 0;
    let error: string | undefined;
    for (let i = 0; i < count; i++) {
      try {
        await mintKey("bashahacks-team-" + randomId(6), s.defaultCapUsd);
        created++;
      } catch (e) {
        console.error("[admin] mintKey failed", e);
        error = aiProblem(e);
        break;
      }
    }
    return { created, asked: count, error };
  },

  async testAi() {
    const s = await getSettings(true);
    const model = s.model || (await pickDefaultModel());

    let key = "mock";
    let stored: KeyRow | null = null;
    if (!mockMode()) {
      key = "";
      const rows = await q<KeyRow>("SELECT * FROM ai_keys WHERE kind='test' AND NOT disabled ORDER BY created_at DESC LIMIT 3");
      for (const row of rows) {
        try {
          key = decrypt(row.key_enc);
          stored = row;
          break;
        } catch {}
      }
      if (!key && hasManagementKey()) {
        try {
          const row = await mintKey("bashahacks-test-" + randomId(6), 3, "test");
          key = decrypt(row.key_enc);
        } catch (e) {
          console.error("[admin] test key failed", e);
          bad(`Could not make a test key. ${aiProblem(e)}`, 502);
        }
      }
      // With no management key, the shared backup key is the only thing students could use, so test that.
      if (!key) key = process.env.OPENROUTER_API_KEY || "";
      if (!key) bad("No AI key is set up on the server yet, so there is nothing to test.", 503);
    }

    let reply = "";
    let cost = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    try {
      const stream = streamChat({
        key,
        model,
        messages: [{ role: "user", content: "Reply with one short friendly sentence." }],
        maxTokens: 60,
        signal: AbortSignal.timeout(40_000),
      });
      for await (const ev of stream) {
        if (ev.type === "delta") reply += ev.text;
        else {
          cost = ev.cost;
          promptTokens = ev.promptTokens;
          completionTokens = ev.completionTokens;
        }
      }
    } catch (e) {
      console.error("[admin] testAi failed", e);
      if (stored && e instanceof AiError && (e.kind === "auth" || e.kind === "limit")) {
        await q("UPDATE ai_keys SET disabled=true WHERE id=$1", [stored.id]);
        bad(`The saved test key stopped working, so it was retired. Press Test AI again to make a fresh one. ${aiProblem(e)}`, 502);
      }
      bad(`The AI test did not work with ${model}. ${aiProblem(e)}`, 502);
    }

    if (!cost && !mockMode() && (promptTokens || completionTokens)) {
      const info = (await listModels()).find((m) => m.id === model);
      if (info) cost = (promptTokens * info.inPerM + completionTokens * info.outPerM) / 1e6;
    }
    await q(
      "INSERT INTO usage_log (team_id, member_id, model, cost, prompt_tokens, completion_tokens, source, created_at) VALUES (NULL,NULL,$1,$2,$3,$4,'test',$5)",
      [model, cost, promptTokens, completionTokens, Date.now()]
    );
    forgetSpendCache();

    reply = reply.replace(/\s+/g, " ").trim();
    if (reply.length > 300) reply = reply.slice(0, 300) + "...";
    return { reply: reply || "(The AI answered, but with no text.)", model, cost };
  },

  async models() {
    const [list, s, auto] = await Promise.all([listModels(), getSettings(), pickDefaultModel()]);
    const models = [...list].sort((a, b) => a.id.localeCompare(b.id));
    return { models, current: s.model, auto };
  },

  async credits() {
    return { credits: await getCredits() };
  },

  /* ---------- Judging ---------- */

  async saveCriteria(b) {
    if (!Array.isArray(b.criteria)) bad("The rubric needs to be a list.");
    const rows = b.criteria as unknown[];
    if (rows.length < 1 || rows.length > 12) bad("The rubric needs between 1 and 12 rows.");
    const clean = rows.map((row, i) => {
      const r = (row && typeof row === "object" ? row : {}) as Body;
      const name = cleanText(r.name, 40);
      if (!name) bad(`Row ${i + 1} of the rubric needs a name.`);
      const id = Number.isInteger(r.id) ? (r.id as number) : null;
      return { id, name, hint: cleanText(r.hint, 160), weight: Math.round(num(r.weight ?? 1, 0.1, 10, `The weight in row ${i + 1}`) * 100) / 100 };
    });

    const existing = await q<{ id: number }>("SELECT id FROM criteria");
    const known = new Set(existing.map((r) => r.id));
    const kept = new Set<number>();
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (c.id != null && known.has(c.id) && !kept.has(c.id)) {
        await q("UPDATE criteria SET name=$2, hint=$3, weight=$4, position=$5 WHERE id=$1", [c.id, c.name, c.hint, c.weight, i]);
        kept.add(c.id);
      } else {
        const row = await q1<{ id: number }>("INSERT INTO criteria (name, hint, weight, position) VALUES ($1,$2,$3,$4) RETURNING id", [
          c.name,
          c.hint,
          c.weight,
          i,
        ]);
        if (row) kept.add(row.id);
      }
    }
    const gone = existing.map((r) => r.id).filter((id) => !kept.has(id));
    if (gone.length) {
      await q("DELETE FROM scores WHERE criterion_id = ANY($1::int[])", [gone]);
      await q("DELETE FROM criteria WHERE id = ANY($1::int[])", [gone]);
    }
    return { criteria: await q("SELECT id, name, hint, weight, position FROM criteria ORDER BY position, id"), removed: gone.length };
  },

  async removeJudge(b) {
    const id = str(b.judgeId);
    const judge = await q1<{ id: string }>("SELECT id FROM judges WHERE id=$1", [id]);
    if (!judge) bad("That judge is already gone.", 404);
    await q("DELETE FROM scores WHERE judge_id=$1", [id]);
    await q("DELETE FROM judge_notes WHERE judge_id=$1", [id]);
    await q("DELETE FROM judges WHERE id=$1", [id]);
  },

  async lockPodium() {
    const podium = podiumFrom(await leaderboard());
    if (podium.length < 1) bad("No team has a score yet, so there is nothing to reveal.");
    return { settings: await updateSettings({ podium, podiumStep: 0, phase: "winners", pausedRemainingMs: null }) };
  },

  async podiumStep(b) {
    const step = int(b.step, 0, 3, "The step");
    const s = await getSettings(true);
    if (!s.podium) bad("Lock the results first.");
    return { settings: await updateSettings({ podiumStep: step }) };
  },

  async clearPodium() {
    return { settings: await updateSettings({ podium: null, podiumStep: 0, phase: "judging" }) };
  },

  /* ---------- Danger zone ---------- */

  async wipe(b) {
    if (b.confirm !== "WIPE") bad("Type WIPE in capital letters to confirm.");
    await q("UPDATE ai_keys SET team_id=NULL WHERE team_id IS NOT NULL");
    // Plain deletes keep the id counters going, so screens that remember the last announcement id stay correct.
    // The AI spending log is kept on purpose: money spent during a practice round is still spent,
    // so the event-wide budget stop has to keep counting it.
    for (const table of ["teams", "members", "versions", "messages", "announcements", "submissions", "judges", "scores", "judge_notes"]) {
      await q(`DELETE FROM ${table}`);
    }
    forgetSpendCache();
    return { settings: await updateSettings({ phase: "lobby", podium: null, podiumStep: 0, pausedRemainingMs: null }) };
  },
};

export async function POST(req: Request) {
  if (!isAdmin(req)) return fail("Admin login needed.", 401);
  const body = (await req.json().catch(() => null)) as Body | null;
  const name = body && typeof body === "object" ? str(body.action) : "";
  const run = Object.prototype.hasOwnProperty.call(actions, name) ? actions[name] : null;
  if (!body || !run) return fail("Unknown action.");
  try {
    const out = await run(body);
    return json({ ok: true, ...(out || {}) });
  } catch (e) {
    if (e instanceof ActionError) return fail(e.message, e.status);
    console.error(`[admin] action ${name} failed`, e);
    return fail("Something went wrong on the server. Try again.", 500);
  }
}
