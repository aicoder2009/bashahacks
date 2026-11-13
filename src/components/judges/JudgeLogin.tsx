"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { ErrorNote, Logo, ThemeToggle } from "@/components/ui";

export default function JudgeLogin({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/judges/login", { code, name });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="flex items-center justify-between">
          <Logo size="lg" />
          <ThemeToggle />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Judge sign in</h1>
        <p className="mt-1 text-sm text-muted">Type the passcode an officer gave you, then your name.</p>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label htmlFor="judge-code" className="label mb-1.5 block">
              Judge passcode
            </label>
            <input
              id="judge-code"
              className="input mono uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              required
            />
          </div>
          <div>
            <label htmlFor="judge-name" className="label mb-1.5 block">
              Your name
            </label>
            <input
              id="judge-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={30}
              required
            />
            <p className="mt-1.5 text-sm text-muted">Use the same name on every device so your scores stay together.</p>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
            {busy ? "Signing in" : "Start judging"}
          </button>
        </div>
      </form>
    </main>
  );
}
