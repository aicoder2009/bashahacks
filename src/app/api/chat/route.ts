import { after } from "next/server";
import { fail, getStudent } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { forgetSpendCache, getSettings, totalSpend, updateSettings } from "@/lib/event";
import { buildMessages } from "@/lib/ai-prompt";
import { AiError, keyForTeam, listModels, mockMode, pickDefaultModel, streamChat } from "@/lib/openrouter";
import { appTitle, applyFiles, hasApp, parseAiOutput } from "@/lib/parse-files";
import { getMember, getTeam, usageView } from "@/lib/store";
import { cleanMultiline } from "@/lib/text";
import type { ChatMessage, Files } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOCK_MS = 200_000;
const RETRY_WAIT_MS = 1500;
// Thinking models count their hidden reasoning against this limit, so it has to leave room for both
// the thinking and the full app files. At GPT-5.6 Luna prices the worst case is about 4 cents.
const MAX_TOKENS = 9000;
const MAX_TOKENS_WITH_REASONING = 32000;

const BLOCK_MESSAGE = {
  cap: "Your team has used all of its AI for now. Ask an officer for more.",
  paused: "AI is paused for your team right now. Ask an officer.",
  event: "AI is paused for everyone for a moment. An officer will turn it back on.",
};

export async function POST(req: Request) {
  const session = getStudent(req);
  if (!session) return fail("Please join first.", 401);
  const body = await req.json().catch(() => ({}));
  const text = cleanMultiline(body.text, 2000);
  if (!text) return fail("Type what you want to build or change.");

  const [s, team, me, spent] = await Promise.all([getSettings(), getTeam(session.teamId), getMember(session.memberId), totalSpend()]);
  if (!team || !me || me.team_id !== team.id) return fail("Please join again.", 401);
  if (s.phase !== "hacking") return fail("Building is not open right now.", 403);
  const usage = usageView(team, s, spent);
  if (usage.blocked) return fail(BLOCK_MESSAGE[usage.reason || "cap"], 402);

  let model = s.model;
  if (!model) {
    model = await pickDefaultModel();
    if (!mockMode()) await updateSettings({ model });
  }

  const t = Date.now();
  const locked = await q1<{ files: Files; version: number }>(
    "UPDATE teams SET busy_until=$2, busy_by=$3 WHERE id=$1 AND busy_until < $4 RETURNING files, version",
    [team.id, t + LOCK_MS, me.id, t]
  );
  if (!locked) return fail("A teammate is already asking the AI. Wait for it to finish.", 409);

  // The key is picked only after the lock is held. Otherwise teammates who press Send at the same
  // moment would each claim a different prepared key for the same team.
  let keyInfo: Awaited<ReturnType<typeof keyForTeam>> = null;
  try {
    keyInfo = mockMode() ? { key: "mock", source: "team" } : await keyForTeam(team.id);
  } finally {
    if (!keyInfo) await q("UPDATE teams SET busy_until=0, busy_by=NULL WHERE id=$1", [team.id]).catch(() => {});
  }
  if (!keyInfo) return fail("The AI is not set up yet. Tell an officer.", 503);

  const historyRows = await q<{ id: number; role: "user" | "assistant"; member_id: string | null; content: string; meta: ChatMessage["meta"]; created_at: number }>(
    "SELECT * FROM (SELECT * FROM messages WHERE team_id=$1 ORDER BY id DESC LIMIT 8) x ORDER BY id",
    [team.id]
  );
  const history: ChatMessage[] = historyRows.map((m) => ({ id: m.id, role: m.role, memberId: m.member_id, content: m.content, meta: m.meta || {}, createdAt: m.created_at }));

  const userMsg = await q1<{ id: number }>(
    "INSERT INTO messages (team_id, role, member_id, content, created_at) VALUES ($1,'user',$2,$3,$4) RETURNING id",
    [team.id, me.id, text, t]
  );
  await q("UPDATE teams SET milestones = $2::jsonb || milestones WHERE id=$1", [team.id, JSON.stringify({ idea: t })]);

  const messages = buildMessages(history, locked.files || {}, text, me.name);
  const encoder = new TextEncoder();
  const out: { c: ReadableStreamDefaultController<Uint8Array> | null } = { c: null };
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      out.c = c;
    },
    cancel() {
      out.c = null;
    },
  });
  const send = (obj: object) => {
    try {
      out.c?.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
    } catch {
      out.c = null; // the browser went away; keep working so the result is still saved
    }
  };

  const work = (async () => {
    let raw = "";
    let cost = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason = "stop";
    let errorMessage = "";
    try {
      send({ t: "start", userMessageId: userMsg?.id });
      let triedBackup = false;
      let retried = false;
      for (;;) {
        try {
          for await (const ev of streamChat({ key: keyInfo!.key, model, messages, maxTokens: s.reasoningEffort === "off" ? MAX_TOKENS : MAX_TOKENS_WITH_REASONING, reasoningEffort: s.reasoningEffort })) {
            if (ev.type === "delta") {
              raw += ev.text;
              send({ t: "d", v: ev.text });
            } else {
              cost = ev.cost;
              promptTokens = ev.promptTokens;
              completionTokens = ev.completionTokens;
              finishReason = ev.finishReason;
            }
          }
          break;
        } catch (e) {
          const err = e instanceof AiError ? e : new AiError(String(e), 0, "other");
          console.error("[chat] AI error", err.status, err.kind, err.message);
          // If this team's own key was refused before anything arrived, fall back to the shared backup key once.
          const backup = process.env.OPENROUTER_API_KEY;
          if (!triedBackup && !raw && keyInfo!.source === "team" && backup && (err.kind === "auth" || err.kind === "limit")) {
            triedBackup = true;
            await q("UPDATE teams SET on_backup=true WHERE id=$1", [team.id]);
            keyInfo = { key: backup, source: "backup" };
            continue;
          }
          // A busy or failing AI provider often works a moment later, so try once more before telling the student.
          if (!retried && !raw && err.kind === "busy") {
            retried = true;
            await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
            continue;
          }
          if (err.kind === "limit" && keyInfo!.source === "team") {
            await q("UPDATE teams SET spent_usd = GREATEST(spent_usd, cap_usd) WHERE id=$1", [team.id]);
            errorMessage = BLOCK_MESSAGE.cap;
          } else if (err.kind === "busy") errorMessage = "The AI is busy right now. Try again in a few seconds.";
          else errorMessage = "The AI had a problem with that one. Try again, and tell an officer if it keeps happening.";
          break;
        }
      }

      if (!cost && !mockMode() && (promptTokens || completionTokens || raw)) {
        // Fallback if the provider did not report a cost: estimate from the model's list price.
        const info = (await listModels()).find((m) => m.id === model);
        const outTokens = completionTokens || Math.ceil(raw.length / 3.5);
        cost = ((promptTokens || 2000) * (info?.inPerM ?? 1) + outTokens * (info?.outPerM ?? 5)) / 1e6;
      }

      const parsed = parseAiOutput(raw);
      const { files, changed } = applyFiles(locked.files || {}, parsed.files);
      const truncated = finishReason === "length" || parsed.files.some((f) => !f.complete);
      const done = Date.now();
      let content = parsed.text;
      if (!content) content = changed.length ? "Done. I updated your app." : errorMessage ? "" : "I could not finish that one. Try asking again in a smaller step.";
      if (truncated && !errorMessage) content += (content ? "\n\n" : "") + "That change was too big to finish in one go, so part of it was left out. Try asking for it in smaller steps.";

      const milestones: Record<string, number> = {};
      if (changed.length && hasApp(files)) milestones.build = done;
      const updated = await q1<{ version: number }>(
        `UPDATE teams SET files = CASE WHEN $2::boolean THEN $3::jsonb ELSE files END,
           version = version + CASE WHEN $2::boolean THEN 1 ELSE 0 END,
           spent_usd = spent_usd + $4, app_title = COALESCE($5, app_title),
           milestones = $6::jsonb || milestones, busy_until = 0, busy_by = NULL
         WHERE id=$1 RETURNING version`,
        [team.id, changed.length > 0, JSON.stringify(files), cost, changed.length ? appTitle(files) : null, JSON.stringify(milestones)]
      );
      if (changed.length) {
        await q("INSERT INTO versions (team_id, files, label, kind, member_id, created_at) VALUES ($1,$2::jsonb,$3,'ai',$4,$5)", [
          team.id,
          JSON.stringify(files),
          text.slice(0, 80),
          me.id,
          done,
        ]);
      }
      const meta: ChatMessage["meta"] = { files: changed, suggestions: parsed.suggestions };
      if (errorMessage) meta.error = errorMessage;
      if (truncated) meta.truncated = true;
      await q("INSERT INTO messages (team_id, role, member_id, content, meta, created_at) VALUES ($1,'assistant',NULL,$2,$3::jsonb,$4)", [
        team.id,
        content,
        JSON.stringify(meta),
        done,
      ]);
      if (cost > 0 || promptTokens > 0) {
        await q(
          "INSERT INTO usage_log (team_id, member_id, model, cost, prompt_tokens, completion_tokens, source, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [team.id, me.id, model, cost, promptTokens, completionTokens, keyInfo!.source, done]
        );
        forgetSpendCache();
      }
      send({ t: "done", version: updated?.version, error: errorMessage || undefined });
    } catch (e) {
      console.error("[chat] failed", e);
      await q("UPDATE teams SET busy_until=0, busy_by=NULL WHERE id=$1", [team.id]).catch(() => {});
      send({ t: "done", error: "Something went wrong while saving. Try again." });
    } finally {
      try {
        out.c?.close();
      } catch {}
    }
  })();

  // Keep the function alive until the work is saved, even if the student closes the tab.
  after(() => work);

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
  });
}
