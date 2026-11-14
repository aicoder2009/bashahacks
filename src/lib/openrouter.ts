import { q, q1 } from "./db";
import { decrypt, encrypt } from "./auth";
import { randomId } from "./ids";

const BASE = "https://openrouter.ai/api/v1";

export const mockMode = () => process.env.AI_MOCK === "1";
export const hasManagementKey = () => !!process.env.OPENROUTER_MANAGEMENT_KEY;
export const hasBackupKey = () => !!process.env.OPENROUTER_API_KEY;

export class AiError extends Error {
  status: number;
  kind: "limit" | "auth" | "model" | "busy" | "other";
  constructor(message: string, status: number, kind: AiError["kind"]) {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

export function classify(status: number, body: string): AiError {
  const text = body.slice(0, 300);
  // The company behind the model refused the request, not OpenRouter. Our keys are fine, so switching
  // to the backup key would not help; these usually pass on a second try.
  if (/Provider returned error/i.test(body) && status !== 402) return new AiError(text, status, "busy");
  if (status === 402 || (status === 403 && /limit|credit|quota/i.test(body))) return new AiError(text, status, "limit");
  if (status === 401 || status === 403) return new AiError(text, status, "auth");
  if (status === 404 || (status === 400 && /model/i.test(body))) return new AiError(text, status, "model");
  if (status === 429 || status >= 500) return new AiError(text, status, "busy");
  return new AiError(text, status, "other");
}

async function mgmt(path: string, init: RequestInit = {}): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const key = process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!key) throw new AiError("No management key configured", 0, "auth");
  const res = await fetch(BASE + path, {
    ...init,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw classify(res.status, text);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export type KeyRow = {
  id: string;
  hash: string;
  key_enc: string;
  limit_usd: number;
  team_id: string | null;
  kind: string;
  disabled: boolean;
};

/** Creates a capped key on OpenRouter and stores it encrypted. */
export async function mintKey(name: string, limitUsd: number, kind: "team" | "test" = "team"): Promise<KeyRow> {
  const out = await mgmt("/keys", { method: "POST", body: JSON.stringify({ name, limit: limitUsd }) });
  const secret: string | undefined = out.key || out.data?.key;
  const hash: string | undefined = out.data?.hash || out.hash;
  if (!secret || !hash) throw new AiError("OpenRouter did not return a key", 0, "other");
  const row: KeyRow = {
    id: randomId(12),
    hash,
    key_enc: encrypt(secret),
    limit_usd: limitUsd,
    team_id: null,
    kind,
    disabled: false,
  };
  await q(
    "INSERT INTO ai_keys (id, hash, key_enc, limit_usd, team_id, kind, created_at) VALUES ($1,$2,$3,$4,NULL,$5,$6)",
    [row.id, row.hash, row.key_enc, row.limit_usd, row.kind, Date.now()]
  );
  return row;
}

export async function setKeyLimit(hash: string, limitUsd: number): Promise<void> {
  await mgmt(`/keys/${encodeURIComponent(hash)}`, { method: "PATCH", body: JSON.stringify({ limit: limitUsd }) });
}

export async function setKeyDisabled(hash: string, disabled: boolean): Promise<void> {
  await mgmt(`/keys/${encodeURIComponent(hash)}`, { method: "PATCH", body: JSON.stringify({ disabled }) });
}

export async function deleteKey(hash: string): Promise<void> {
  await mgmt(`/keys/${encodeURIComponent(hash)}`, { method: "DELETE" });
}

export async function getCredits(): Promise<{ total: number; used: number } | null> {
  try {
    const out = await mgmt("/credits");
    const d = out.data || out;
    if (typeof d.total_credits !== "number") return null;
    return { total: d.total_credits, used: d.total_usage || 0 };
  } catch {
    return null;
  }
}

export type ModelInfo = { id: string; name: string; inPerM: number; outPerM: number; context: number };

const gm = globalThis as unknown as { __bhModels?: { at: number; list: ModelInfo[] } };
export async function listModels(): Promise<ModelInfo[]> {
  if (gm.__bhModels && Date.now() - gm.__bhModels.at < 10 * 60_000) return gm.__bhModels.list;
  try {
    const res = await fetch(BASE + "/models", { signal: AbortSignal.timeout(15_000) });
    const out = await res.json();
    const list: ModelInfo[] = (out.data || [])
      .map((m: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: String(m.id),
        name: String(m.name || m.id),
        inPerM: Number(m.pricing?.prompt || 0) * 1e6,
        outPerM: Number(m.pricing?.completion || 0) * 1e6,
        context: Number(m.context_length || 0),
      }))
      .filter((m: ModelInfo) => m.outPerM > 0);
    gm.__bhModels = { at: Date.now(), list };
    return list;
  } catch {
    return gm.__bhModels?.list || [];
  }
}

// Coding models in order of preference. The first one OpenRouter actually offers is used unless an
// officer picks a different model in admin. GPT-5.6 Luna with high reasoning leads (Karthick's pick,
// Nov 13): even with heavy thinking it costs a fraction of Sonnet. Sonnet is the step up if Luna's
// apps disappoint; Haiku stays at the end as the cheapest fallback.
const PREFERRED = [
  /^openai\/gpt-5\.\d+-luna$/,
  /^anthropic\/claude-sonnet-5(\.\d+)?$/,
  /^anthropic\/claude-sonnet-4\.\d+$/,
  /^anthropic\/claude-haiku-5(\.\d+)?$/,
  /^anthropic\/claude-haiku-4\.5$/,
  /^google\/gemini-3\.\d-flash$/,
];
const FALLBACK_MODEL = "openai/gpt-5.6-luna";

export async function pickDefaultModel(): Promise<string> {
  const list = await listModels();
  for (const re of PREFERRED) {
    // Skip variants such as ":batch" or ":free" (anything with a colon) and preview builds: students need
    // the normal live model that streams its answer.
    const hits = list.filter((m) => re.test(m.id) && !/:|preview|beta/.test(m.id)).sort((a, b) => b.id.localeCompare(a.id));
    if (hits.length) return hits[0].id;
  }
  return FALLBACK_MODEL;
}

/** Finds the key a team should use: its own, one claimed from the pool, or the shared backup. */
export async function keyForTeam(teamId: string): Promise<{ key: string; source: "team" | "backup"; row?: KeyRow } | null> {
  let row = await q1<KeyRow>("SELECT * FROM ai_keys WHERE team_id=$1 AND kind='team' AND NOT disabled LIMIT 1", [teamId]);
  if (!row) {
    row = await q1<KeyRow>(
      `UPDATE ai_keys SET team_id=$1 WHERE id = (
         SELECT id FROM ai_keys WHERE team_id IS NULL AND kind='team' AND NOT disabled
         ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
       ) RETURNING *`,
      [teamId]
    );
    if (row) {
      const team = await q1<{ cap_usd: number }>("UPDATE teams SET key_id=$2, on_backup=false WHERE id=$1 RETURNING cap_usd", [teamId, row.id]);
      // Keep OpenRouter's hard cap in step with this team's cap if an officer changed it.
      if (team && Math.abs(team.cap_usd - row.limit_usd) > 0.001 && hasManagementKey()) {
        try {
          await setKeyLimit(row.hash, team.cap_usd);
          await q("UPDATE ai_keys SET limit_usd=$2 WHERE id=$1", [row.id, team.cap_usd]);
        } catch {}
      }
    }
  }
  if (row) {
    try {
      return { key: decrypt(row.key_enc), source: "team", row };
    } catch {}
  }
  const backup = process.env.OPENROUTER_API_KEY;
  if (backup) {
    await q("UPDATE teams SET on_backup=true WHERE id=$1 AND NOT on_backup", [teamId]);
    return { key: backup, source: "backup" };
  }
  return null;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "end"; cost: number; promptTokens: number; completionTokens: number; finishReason: string };

type Msg = { role: string; content: string };

export async function* streamChat(opts: {
  key: string;
  model: string;
  messages: Msg[];
  maxTokens: number;
  /** How hard a thinking model reasons before answering. Ignored by models that do not think. */
  reasoningEffort?: "off" | "low" | "medium" | "high";
  signal?: AbortSignal;
}): AsyncGenerator<StreamEvent> {
  if (mockMode()) {
    yield* mockStream(opts.messages);
    return;
  }
  const res = await fetch(BASE + "/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${opts.key}`,
      "content-type": "application/json",
      "http-referer": "https://bashahacks.vercel.app",
      "x-title": "DevOps Basha Hacks",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      ...(opts.reasoningEffort && opts.reasoningEffort !== "off"
        ? { reasoning: { effort: opts.reasoningEffort, exclude: true } }
        : { temperature: 0.6 }),
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw classify(res.status, await res.text().catch(() => ""));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let cost = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let finishReason = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let obj: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        obj = JSON.parse(data);
      } catch {
        continue;
      }
      if (obj.error) throw classify(Number(obj.error.code) || 500, JSON.stringify(obj.error));
      const choice = obj.choices?.[0];
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta) yield { type: "delta", text: delta };
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (obj.usage) {
        cost = Number(obj.usage.cost) || cost;
        promptTokens = Number(obj.usage.prompt_tokens) || promptTokens;
        completionTokens = Number(obj.usage.completion_tokens) || completionTokens;
      }
    }
  }
  yield { type: "end", cost, promptTokens, completionTokens, finishReason: finishReason || "stop" };
}

/** A fake AI for local development and automated tests. It builds a small working counter app. */
async function* mockStream(messages: Msg[]): AsyncGenerator<StreamEvent> {
  const last = messages[messages.length - 1]?.content || "";
  const request = (last.split("Request from ").pop() || "").replace(/^[^:]*:\s*/, "").trim();
  const hadApp = !last.startsWith("There is no app yet.");
  const title = (request.replace(/[<>&"]/g, "").slice(0, 40) || "My Eco App").replace(/^\w/, (c) => c.toUpperCase());
  const out = hadApp
    ? `I updated your app for "${title}".
<file name="index.html">
<!doctype html>
<html>
<head>
<title>Eco Tracker</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<h1>Eco Tracker</h1>
<p class="note">Latest change: ${title}</p>
<p>Count: <span id="count">0</span></p>
<button id="add">Add one</button>
<button id="reset">Reset</button>
<script src="script.js"></script>
</body>
</html>
</file>
<suggestions>
Add a weekly chart
Change the colors
</suggestions>`
    : `I built a first version for you. It counts each time you do something good for the planet and remembers the number.
<file name="index.html">
<!doctype html>
<html>
<head>
<title>Eco Tracker</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<h1>Eco Tracker</h1>
<p class="note">Idea: ${title}</p>
<p>Count: <span id="count">0</span></p>
<button id="add">Add one</button>
<button id="reset">Reset</button>
<script src="script.js"></script>
</body>
</html>
</file>
<file name="style.css">
/* Page look */
body { font-family: sans-serif; background: #eaf6ea; color: #1d3b24; text-align: center; padding: 40px; }
button { font-size: 20px; padding: 10px 18px; border-radius: 10px; border: none; background: #2f7d4f; color: white; cursor: pointer; }
#count { font-size: 48px; font-weight: bold; }
</file>
<file name="script.js">
// Load the saved number, or start at zero
let count = Number(localStorage.getItem('count') || 0);
const el = document.getElementById('count');
el.textContent = count;
// Add one and save it
document.getElementById('add').addEventListener('click', () => {
  count += 1;
  localStorage.setItem('count', count);
  el.textContent = count;
});
document.getElementById('reset').addEventListener('click', () => {
  count = 0;
  localStorage.setItem('count', count);
  el.textContent = count;
});
</file>
<suggestions>
Add a weekly chart
Let me pick a goal
Change the colors
</suggestions>`;
  const delay = Number(process.env.AI_MOCK_DELAY_MS || 15);
  for (let i = 0; i < out.length; i += 40) {
    yield { type: "delta", text: out.slice(i, i + 40) };
    await new Promise((r) => setTimeout(r, delay));
  }
  yield { type: "end", cost: 0.02, promptTokens: 800, completionTokens: 600, finishReason: "stop" };
}
