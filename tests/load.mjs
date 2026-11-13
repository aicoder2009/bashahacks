// Load check: N students polling every 2.5 seconds while some of them run AI turns.
// Usage: node tests/load.mjs [students=40] [aiTurns=12] [seconds=30]
import { execSync } from "node:child_process";

const BASE = process.env.BASE || "http://localhost:3000";
const N = Number(process.argv[2] || 40);
const AI = Number(process.argv[3] || 12);
const SECONDS = Number(process.argv[4] || 30);
const eventCode = process.env.EVENT_CODE || execSync(`psql -h 127.0.0.1 -p 54329 -U postgres bh -tAc "SELECT value->>'eventCode' FROM settings WHERE key='event'"`).toString().trim();

const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] || 0;

async function join(i) {
  const res = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventCode, name: `Load ${i}`, avatar: { s: i % 10, c: i % 8, e: 0, m: 0, a: 0 }, mode: "solo" }),
  });
  if (!res.ok) throw new Error(`join ${i} failed: ${res.status} ${await res.text()}`);
  return res.headers.get("set-cookie").split(";")[0];
}

console.log(`Joining ${N} students`);
const cookies = [];
for (let i = 0; i < N; i += 10) cookies.push(...(await Promise.all(Array.from({ length: Math.min(10, N - i) }, (_, k) => join(i + k)))));

const syncTimes = [];
let syncErrors = 0;
const end = Date.now() + SECONDS * 1000;

async function poll(cookie) {
  let v = -1;
  await new Promise((r) => setTimeout(r, Math.random() * 2500));
  while (Date.now() < end) {
    const t = performance.now();
    try {
      const res = await fetch(`${BASE}/api/sync?v=${v}&m=0&a=0`, { headers: { cookie } });
      const data = await res.json();
      if (!res.ok) syncErrors++;
      else v = data.team.version;
    } catch {
      syncErrors++;
    }
    syncTimes.push(performance.now() - t);
    await new Promise((r) => setTimeout(r, 2500));
  }
}

const chatTimes = [];
let chatErrors = 0;
async function chat(cookie) {
  await new Promise((r) => setTimeout(r, 1000 + Math.random() * 3000));
  const t = performance.now();
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ text: "Build a water tracker" }),
    });
    const text = await res.text();
    if (!res.ok || !text.includes('"t":"done"')) chatErrors++;
  } catch {
    chatErrors++;
  }
  chatTimes.push(performance.now() - t);
}

console.log(`Polling for ${SECONDS}s with ${AI} AI turns in flight`);
await Promise.all([...cookies.map(poll), ...cookies.slice(0, AI).map(chat)]);

const line = (name, arr) => `${name}: n=${arr.length} median=${pct(arr, 0.5).toFixed(0)}ms p95=${pct(arr, 0.95).toFixed(0)}ms max=${Math.max(...arr).toFixed(0)}ms`;
console.log(line("sync", syncTimes), `errors=${syncErrors}`);
console.log(line("chat", chatTimes), `errors=${chatErrors}`);
if (syncErrors || chatErrors) process.exit(1);
console.log("OK: load check passed");
