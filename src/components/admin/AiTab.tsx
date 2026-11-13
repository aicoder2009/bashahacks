"use client";
import { useState } from "react";
import type { ModelInfo } from "@/lib/openrouter";
import { Empty, Field, Section, Stat, Toggle, useAdmin, useBusy, useDraft, usd } from "./shared";

const perM = (n: number) => "$" + (n < 1 ? n.toFixed(3) : n.toFixed(2));

function Budget() {
  const { state, act } = useAdmin();
  const { settings } = state;
  const total = useDraft(String(settings.totalBudgetUsd));
  const cap = useDraft(String(settings.defaultCapUsd));
  const [busy, run] = useBusy();
  const dirty = total.dirty || cap.dirty;
  const totalN = Number(total.value);
  const capN = Number(cap.value);
  const problem =
    !(totalN >= 1 && totalN <= 500) ? "The total budget needs to be from $1 to $500." : !(capN >= 0.1 && capN <= 20) ? "The starting amount per team needs to be from $0.10 to $20." : "";

  const save = () =>
    run(async () => {
      const patch: Record<string, number> = {};
      if (total.dirty) patch.totalBudgetUsd = totalN;
      if (cap.dirty) patch.defaultCapUsd = capN;
      const out = await act("updateSettings", { patch }, { success: "Budget saved." });
      if (out) {
        total.reset();
        cap.reset();
      }
    });

  return (
    <Section
      title="Budget"
      hint="AI stops for everyone $1 before the total budget is reached, so the event can never go over."
      actions={
        <>
          {dirty ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                total.reset();
                cap.reset();
              }}
            >
              Undo
            </button>
          ) : null}
          <button className="btn btn-primary btn-sm" disabled={!dirty || !!problem || busy} onClick={save}>
            Save budget
          </button>
        </>
      }
    >
      <div className="grid gap-3 min-[700px]:grid-cols-2">
        <Field label="Total budget for the event, in dollars" hint="From $1 to $500.">
          <input className="input mono" inputMode="decimal" value={total.value} onChange={(e) => total.set(e.target.value)} />
        </Field>
        <Field label="Starting amount per team, in dollars" hint="From $0.10 to $20. Used for new teams and new keys. Teams that already exist keep their limit.">
          <input className="input mono" inputMode="decimal" value={cap.value} onChange={(e) => cap.set(e.target.value)} />
        </Field>
      </div>
      {dirty && problem ? <p className="mt-2 text-sm text-amber">{problem}</p> : null}
      <div className="mt-4 border-t border-line pt-4">
        <Toggle
          label="Pause AI for everyone"
          checked={settings.aiPausedAll}
          disabled={busy}
          onChange={(v) => {
            if (v && !window.confirm("Pause AI for every team? Students can still edit code by hand.")) return;
            run(() => act("updateSettings", { patch: { aiPausedAll: v } }, { success: v ? "AI is paused for everyone." : "AI is back on for everyone." }));
          }}
          hint="Students see a note that AI is paused. Turn it back off to let them continue."
        />
      </div>
    </Section>
  );
}

function ModelPicker() {
  const { state, act } = useAdmin();
  const current = state.settings.model;
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [auto, setAuto] = useState("");
  const [query, setQuery] = useState("");
  const [busy, run] = useBusy();

  const load = () =>
    run(async () => {
      const out = await act<{ models: ModelInfo[]; auto: string }>("models", {}, { success: "" });
      if (out) {
        setModels(out.models);
        setAuto(out.auto);
      }
    });
  const choose = (id: string) => run(() => act("updateSettings", { patch: { model: id } }, { success: id ? `Model set to ${id}.` : "Model set to auto pick." }));

  const needle = query.trim().toLowerCase();
  const matches = (models || []).filter((m) => !needle || m.id.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle));
  const shown = matches.slice(0, 60);

  return (
    <Section
      title="Model"
      hint="The AI every team builds with. Auto pick chooses a good, affordable coding model."
      actions={
        <button className="btn btn-sm" disabled={busy} onClick={load}>
          {models ? "Reload models" : "Load models"}
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="label">In use</span>
        <span className="mono rounded-md border border-line bg-bg px-2 py-1">{current || "auto pick"}</span>
        {!current && auto ? <span className="text-muted">Auto pick would use {auto}.</span> : null}
        {current ? (
          <button className="btn btn-sm" disabled={busy} onClick={() => choose("")}>
            Use auto pick
          </button>
        ) : null}
      </div>

      {models ? (
        <div className="mt-4">
          <Field label="Search models">
            <input className="input !h-9 text-sm" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example haiku, gemini, gpt" />
          </Field>
          {models.length === 0 ? (
            <div className="mt-3">
              <Empty>OpenRouter did not send a model list. Check the internet connection and press Reload models.</Empty>
            </div>
          ) : (
            <>
              <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-panel">
                    <tr className="border-b border-line text-left">
                      <th scope="col" className="label px-3 py-2 font-normal">
                        Model
                      </th>
                      <th scope="col" className="label px-3 py-2 text-right font-normal">
                        In, per 1M tokens
                      </th>
                      <th scope="col" className="label px-3 py-2 text-right font-normal">
                        Out, per 1M tokens
                      </th>
                      <th scope="col" className="label px-3 py-2 text-right font-normal">
                        Pick
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((m) => (
                      <tr key={m.id} className="border-b border-line last:border-b-0">
                        <td className="px-3 py-1.5">
                          <div className="mono text-[0.82rem]">{m.id}</div>
                          <div className="text-xs text-muted">{m.name}</div>
                        </td>
                        <td className="mono px-3 py-1.5 text-right">{perM(m.inPerM)}</td>
                        <td className="mono px-3 py-1.5 text-right">{perM(m.outPerM)}</td>
                        <td className="px-3 py-1.5 text-right">
                          {m.id === current ? (
                            <span className="pill pill-green">In use</span>
                          ) : (
                            <button className="btn btn-sm" disabled={busy} onClick={() => choose(m.id)} aria-label={`Use ${m.id}`}>
                              Use
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">
                Showing {shown.length} of {matches.length} matches. {matches.length > shown.length ? "Type more to narrow it down." : ""}
              </p>
            </>
          )}
        </div>
      ) : null}
    </Section>
  );
}

function KeyPool() {
  const { state, act, toast } = useAdmin();
  const { ai } = state;
  const [count, setCount] = useState("20");
  const [busy, run] = useBusy();
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 1 && n <= 30;

  const prepare = () =>
    run(async () => {
      const out = await act<{ created: number; asked?: number; error?: string; note?: string }>("prepareKeys", { count: n }, { success: "" });
      if (!out) return;
      if (out.note) toast("warn", out.note);
      else if (out.error) toast("error", `Made ${out.created} of ${out.asked ?? n} keys, then stopped. ${out.error}`);
      else toast("ok", out.created === 1 ? "Made 1 team key." : `Made ${out.created} team keys.`);
    });

  return (
    <Section
      title="Team keys"
      hint="Each team gets its own OpenRouter key with a hard spending limit. Make them before the event so joining is instant."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-sm">
          <div className="label">Ready to hand out</div>
          <div className="mono text-2xl font-semibold">
            {ai.poolFree} <span className="text-sm font-normal text-muted">of {ai.poolTotal} made</span>
          </div>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <Field label="How many to make (1 to 30)">
            <input className="input mono !h-9 !w-28 text-sm" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <button className="btn btn-primary btn-sm !h-9" disabled={busy || !valid || (!ai.hasManagementKey && !ai.mockMode)} onClick={prepare}>
            {busy ? "Making keys" : "Prepare team keys"}
          </button>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Management key: <span className={ai.hasManagementKey ? "text-accent" : "text-amber"}>{ai.hasManagementKey ? "set" : "missing"}</span>
          {ai.hasManagementKey ? "" : ". Add OPENROUTER_MANAGEMENT_KEY on the server to make team keys."}
        </li>
        <li>
          Backup key: <span className={ai.hasBackupKey ? "text-accent" : "text-amber"}>{ai.hasBackupKey ? "set" : "missing"}</span>
          {ai.hasBackupKey ? ". Teams fall back to it if their own key fails." : ". Add OPENROUTER_API_KEY on the server as a safety net."}
        </li>
        <li>
          Teams on the backup key: <span className="mono text-fg">{ai.teamsOnBackup}</span>
        </li>
        {ai.mockMode ? <li className="text-amber">Practice mode is on (AI_MOCK=1), so students get a pretend AI and no keys are used.</li> : null}
      </ul>
    </Section>
  );
}

function Checks() {
  const { act } = useAdmin();
  const [test, setTest] = useState<{ reply: string; model: string; cost: number } | null>(null);
  const [credits, setCredits] = useState<{ total: number; used: number } | "none" | null>(null);
  const [testing, runTest] = useBusy();
  const [checking, runCheck] = useBusy();

  const doTest = () =>
    runTest(async () => {
      const out = await act<{ reply: string; model: string; cost: number }>("testAi", {}, { success: "The AI answered." });
      setTest(out);
    });
  const doCredits = () =>
    runCheck(async () => {
      const out = await act<{ credits: { total: number; used: number } | null }>("credits", {}, { success: "" });
      if (out) setCredits(out.credits || "none");
    });

  return (
    <Section title="Checks" hint="Run these before the event, and any time the AI seems off.">
      <div className="grid gap-4 min-[900px]:grid-cols-2">
        <div>
          <button className="btn btn-sm" disabled={testing} onClick={doTest}>
            {testing ? "Asking the AI" : "Test AI"}
          </button>
          <p className="mt-1 text-xs text-muted">Sends one tiny question with the current model. Costs a fraction of a cent.</p>
          {test ? (
            <dl className="mt-2 space-y-1 rounded-lg border border-line bg-bg p-3 text-sm" aria-live="polite">
              <div>
                <dt className="label">Reply</dt>
                <dd>{test.reply}</dd>
              </div>
              <div className="flex gap-6">
                <div>
                  <dt className="label">Model</dt>
                  <dd className="mono text-[0.82rem]">{test.model}</dd>
                </div>
                <div>
                  <dt className="label">Cost</dt>
                  <dd className="mono text-[0.82rem]">${test.cost.toFixed(5)}</dd>
                </div>
              </div>
            </dl>
          ) : null}
        </div>
        <div>
          <button className="btn btn-sm" disabled={checking} onClick={doCredits}>
            {checking ? "Checking" : "Check OpenRouter balance"}
          </button>
          <p className="mt-1 text-xs text-muted">Shows the credit on the OpenRouter account that pays for all of this.</p>
          {credits === "none" ? (
            <p className="mt-2 rounded-lg border border-line bg-bg p-3 text-sm text-muted" aria-live="polite">
              OpenRouter did not share a balance. This needs the management key.
            </p>
          ) : credits ? (
            <dl className="mt-2 flex gap-6 rounded-lg border border-line bg-bg p-3 text-sm" aria-live="polite">
              <div>
                <dt className="label">Left</dt>
                <dd className="mono">{usd(credits.total - credits.used)}</dd>
              </div>
              <div>
                <dt className="label">Used</dt>
                <dd className="mono">{usd(credits.used)}</dd>
              </div>
              <div>
                <dt className="label">Bought</dt>
                <dd className="mono">{usd(credits.total)}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

export function AiTab() {
  const { state } = useAdmin();
  const { ai, settings } = state;
  const pct = settings.totalBudgetUsd > 0 ? Math.min(100, Math.round((ai.totalSpent / settings.totalBudgetUsd) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        <Stat label="Spent so far" value={usd(ai.totalSpent)} sub={`${pct}% of the budget`} />
        <Stat label="Left to spend" value={usd(ai.budgetLeft)} sub="before AI stops for everyone" />
        <Stat label="Total budget" value={usd(settings.totalBudgetUsd)} sub={`${usd(settings.defaultCapUsd)} per new team`} />
        <Stat label="Keys ready" value={ai.poolFree} sub={`of ${ai.poolTotal} made`} />
      </div>
      <Budget />
      <KeyPool />
      <Checks />
      <ModelPicker />
    </div>
  );
}
