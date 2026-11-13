"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar, { SHAPE_NAMES } from "@/components/Avatar";
import { ErrorNote, Logo, ThemeToggle } from "@/components/ui";
import { api, ApiError } from "@/lib/client";
import { AVATAR_LIMITS, avatarFromSeed } from "@/lib/text";
import type { AvatarSpec } from "@/lib/types";

type Step = "code" | "name" | "avatar" | "mode" | "create" | "join" | "created" | "rejoin" | "rejoinPick";
type PublicInfo = { name: string; phase: string; teamsAllowed: boolean; maxTeamSize: number; teamName: string };

const rand = (n: number) => Math.floor(Math.random() * n);
const randomAvatar = (): AvatarSpec => ({
  s: rand(AVATAR_LIMITS.s),
  c: rand(AVATAR_LIMITS.c),
  e: rand(AVATAR_LIMITS.e),
  m: rand(AVATAR_LIMITS.m),
  a: rand(AVATAR_LIMITS.a),
});

const STICKERS: { spec: AvatarSpec; cls: string }[] = [
  { spec: { s: 0, c: 0, e: 2, m: 1, a: 0 }, cls: "left-[6%] top-[14%] -rotate-12" },
  { spec: { s: 1, c: 2, e: 1, m: 0, a: 0 }, cls: "right-[8%] top-[18%] rotate-12" },
  { spec: { s: 2, c: 3, e: 0, m: 1, a: 5 }, cls: "left-[10%] bottom-[12%] rotate-6" },
  { spec: { s: 4, c: 3, e: 4, m: 5, a: 0 }, cls: "right-[7%] bottom-[16%] -rotate-6" },
  { spec: { s: 3, c: 0, e: 5, m: 0, a: 3 }, cls: "left-[24%] top-[6%] rotate-3" },
  { spec: { s: 5, c: 1, e: 1, m: 4, a: 0 }, cls: "right-[24%] bottom-[5%] -rotate-3" },
];

export default function JoinPage() {
  const router = useRouter();
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [step, setStep] = useState<Step>("code");
  const [eventCode, setEventCode] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarSpec>({ s: 0, c: 0, e: 0, m: 0, a: 0 });
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null);
  const [rejoin, setRejoin] = useState<{ teamName: string; members: { id: string; name: string; avatar: AvatarSpec }[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Already joined on this computer? Go straight to the build screen.
    api("/api/sync?v=-1")
      .then(() => router.replace("/build"))
      .catch(() => {});
    api<PublicInfo>("/api/public")
      .then((d) => {
        setInfo(d);
        setTeamName(d.teamName);
      })
      .catch(() => {});
  }, [router]);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const checkCode = () =>
    run(async () => {
      await api("/api/join", { step: "check", eventCode });
      setStep("name");
    });

  const join = (mode: "solo" | "create" | "join") =>
    run(async () => {
      const out = await api<{ team: { name: string; code: string; solo: boolean } }>("/api/join", {
        eventCode,
        name,
        avatar,
        mode,
        teamName,
        teamCode,
      });
      if (mode === "create") {
        setCreated({ name: out.team.name, code: out.team.code });
        setStep("created");
      } else router.push("/build");
    });

  const lookupRejoin = () =>
    run(async () => {
      const out = await api<{ teamName: string; members: { id: string; name: string; avatar: AvatarSpec }[] }>(
        `/api/rejoin?code=${encodeURIComponent(teamCode)}`
      );
      setRejoin(out);
      setStep("rejoinPick");
    });

  const doRejoin = (memberId: string) =>
    run(async () => {
      await api("/api/rejoin", { code: teamCode, memberId });
      router.push("/build");
    });

  const cycle = (k: keyof AvatarSpec, dir: number) =>
    setAvatar((a) => ({ ...a, [k]: (a[k] + dir + AVATAR_LIMITS[k]) % AVATAR_LIMITS[k] }));

  const back = (to: Step) => {
    setError("");
    setStep(to);
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden opacity-70 md:block">
        {STICKERS.map((s, i) => (
          <div key={i} className={`absolute ${s.cls}`}>
            <Avatar spec={s.spec} size={84} />
          </div>
        ))}
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <Logo />
        <ThemeToggle />
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="label mb-2">Basha High School DevOps Club</p>
            <h1 className="text-3xl font-semibold tracking-tight">{info?.name || "DevOps Basha Hacks"}</h1>
            <p className="mt-2 text-muted">Build an app that helps the planet. No coding experience needed.</p>
          </div>

          <div className="card p-6">
            {step === "code" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  checkCode();
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="code" className="mb-1.5 block font-medium">
                    Enter the event code
                  </label>
                  <p className="mb-3 text-sm text-muted">It is on the big screen at the front of the room.</p>
                  <input
                    id="code"
                    className="input mono !h-14 text-center text-2xl uppercase tracking-[0.3em]"
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <ErrorNote>{error}</ErrorNote>
                <button className="btn btn-primary btn-lg w-full" disabled={busy || eventCode.length < 3}>
                  Next
                </button>
                <button type="button" className="w-full text-center text-sm text-muted underline underline-offset-4" onClick={() => back("rejoin")}>
                  Already joined? Get back in with your team code
                </button>
              </form>
            )}

            {step === "name" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim().length < 2) return setError("Please type your first name and last initial.");
                  setError("");
                  setAvatar(avatarFromSeed(name.trim().toLowerCase() + Date.now()));
                  setStep("avatar");
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="name" className="mb-1.5 block font-medium">
                    What is your name?
                  </label>
                  <p className="mb-3 text-sm text-muted">First name and last initial, like Maya R.</p>
                  <input id="name" className="input !h-12 text-lg" value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} autoFocus autoComplete="off" />
                </div>
                <ErrorNote>{error}</ErrorNote>
                <div className="flex gap-3">
                  <button type="button" className="btn btn-lg" onClick={() => back("code")}>
                    Back
                  </button>
                  <button className="btn btn-primary btn-lg flex-1">Next</button>
                </div>
              </form>
            )}

            {step === "avatar" && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="font-medium">Pick your character</p>
                  <p className="text-sm text-muted">This is how you show up on the big screen.</p>
                </div>
                <div className="flex justify-center py-1">
                  <div key={JSON.stringify(avatar)} className="pop-in">
                    <Avatar spec={avatar} size={132} title={`${name}'s character`} />
                  </div>
                </div>
                <div className="space-y-2">
                  {(
                    [
                      ["s", "Character", SHAPE_NAMES[avatar.s]],
                      ["c", "Color", `${avatar.c + 1} of ${AVATAR_LIMITS.c}`],
                      ["e", "Eyes", `${avatar.e + 1} of ${AVATAR_LIMITS.e}`],
                      ["m", "Mouth", `${avatar.m + 1} of ${AVATAR_LIMITS.m}`],
                      ["a", "Extra", avatar.a === 0 ? "None" : `${avatar.a} of ${AVATAR_LIMITS.a - 1}`],
                    ] as [keyof AvatarSpec, string, string][]
                  ).map(([k, label, value]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="label w-24">{label}</span>
                      <button className="btn btn-sm !px-2.5" onClick={() => cycle(k, -1)} aria-label={`Previous ${label.toLowerCase()}`}>
                        ‹
                      </button>
                      <span className="mono flex-1 text-center text-sm">{value}</span>
                      <button className="btn btn-sm !px-2.5" onClick={() => cycle(k, 1)} aria-label={`Next ${label.toLowerCase()}`}>
                        ›
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button className="btn btn-lg" onClick={() => back("name")}>
                    Back
                  </button>
                  <button className="btn btn-lg" onClick={() => setAvatar(randomAvatar())}>
                    Shuffle
                  </button>
                  <button className="btn btn-primary btn-lg flex-1" onClick={() => back("mode")}>
                    Looks good
                  </button>
                </div>
              </div>
            )}

            {step === "mode" && (
              <div className="space-y-3">
                <p className="text-center font-medium">How do you want to build, {name.split(" ")[0]}?</p>
                <button className="card flex w-full items-center gap-4 p-4 text-left hover:bg-panel2" onClick={() => join("solo")} disabled={busy}>
                  <Avatar spec={avatar} size={44} />
                  <span>
                    <span className="block font-semibold">Go solo</span>
                    <span className="block text-sm text-muted">Build your own app. You can invite a teammate later.</span>
                  </span>
                </button>
                {info?.teamsAllowed !== false && (
                  <>
                    <button className="card flex w-full items-center gap-4 p-4 text-left hover:bg-panel2" onClick={() => back("create")} disabled={busy}>
                      <span className="mono flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-xl text-accent">+</span>
                      <span>
                        <span className="block font-semibold">Create a team</span>
                        <span className="block text-sm text-muted">Start a team and get a code to share. Up to {info?.maxTeamSize || 3} people.</span>
                      </span>
                    </button>
                    <button className="card flex w-full items-center gap-4 p-4 text-left hover:bg-panel2" onClick={() => back("join")} disabled={busy}>
                      <span className="mono flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-lg text-accent">#</span>
                      <span>
                        <span className="block font-semibold">Join a team</span>
                        <span className="block text-sm text-muted">Your teammate already made one and has a code.</span>
                      </span>
                    </button>
                  </>
                )}
                <ErrorNote>{error}</ErrorNote>
                <button className="btn w-full" onClick={() => back("avatar")}>
                  Back
                </button>
              </div>
            )}

            {step === "create" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  join("create");
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="tname" className="mb-1.5 block font-medium">
                    Name your team
                  </label>
                  <p className="mb-3 text-sm text-muted">We picked one for you. Change it if you like.</p>
                  <input id="tname" className="input !h-12 text-lg" value={teamName} onChange={(e) => setTeamName(e.target.value.slice(0, 28))} autoFocus autoComplete="off" />
                </div>
                <ErrorNote>{error}</ErrorNote>
                <div className="flex gap-3">
                  <button type="button" className="btn btn-lg" onClick={() => back("mode")}>
                    Back
                  </button>
                  <button className="btn btn-primary btn-lg flex-1" disabled={busy}>
                    Create team
                  </button>
                </div>
              </form>
            )}

            {step === "join" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  join("join");
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="tcode" className="mb-1.5 block font-medium">
                    Enter your team code
                  </label>
                  <p className="mb-3 text-sm text-muted">Four letters. Your teammate can see it at the top of their screen.</p>
                  <input
                    id="tcode"
                    className="input mono !h-14 text-center text-2xl uppercase tracking-[0.4em]"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <ErrorNote>{error}</ErrorNote>
                <div className="flex gap-3">
                  <button type="button" className="btn btn-lg" onClick={() => back("mode")}>
                    Back
                  </button>
                  <button className="btn btn-primary btn-lg flex-1" disabled={busy || teamCode.length < 4}>
                    Join team
                  </button>
                </div>
              </form>
            )}

            {step === "created" && created && (
              <div className="space-y-4 text-center">
                <p className="font-medium">Team {created.name} is ready</p>
                <p className="text-sm text-muted">Tell your teammates this code so they can join you.</p>
                <p className="mono pop-in rounded-xl border border-line bg-bg py-5 text-5xl font-semibold tracking-[0.35em] text-accent">{created.code}</p>
                <p className="text-sm text-muted">You can always find it at the top of your build screen.</p>
                <button className="btn btn-primary btn-lg w-full" onClick={() => router.push("/build")}>
                  Start building
                </button>
              </div>
            )}

            {step === "rejoin" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  lookupRejoin();
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="rcode" className="mb-1.5 block font-medium">
                    Enter your team code
                  </label>
                  <p className="mb-3 text-sm text-muted">Solo builders have one too. If you lost it, ask an officer.</p>
                  <input
                    id="rcode"
                    className="input mono !h-14 text-center text-2xl uppercase tracking-[0.4em]"
                    value={teamCode}
                    onChange={(e) => setTeamCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <ErrorNote>{error}</ErrorNote>
                <div className="flex gap-3">
                  <button type="button" className="btn btn-lg" onClick={() => back("code")}>
                    Back
                  </button>
                  <button className="btn btn-primary btn-lg flex-1" disabled={busy || teamCode.length < 4}>
                    Find my team
                  </button>
                </div>
              </form>
            )}

            {step === "rejoinPick" && rejoin && (
              <div className="space-y-3">
                <p className="text-center font-medium">Who are you on {rejoin.teamName}?</p>
                {rejoin.members.map((m) => (
                  <button key={m.id} className="card flex w-full items-center gap-3 p-3 text-left hover:bg-panel2" onClick={() => doRejoin(m.id)} disabled={busy}>
                    <Avatar spec={m.avatar} size={40} />
                    <span className="font-medium">{m.name}</span>
                  </button>
                ))}
                <ErrorNote>{error}</ErrorNote>
                <button className="btn w-full" onClick={() => back("rejoin")}>
                  Back
                </button>
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-sm text-muted">
            <a className="underline underline-offset-4" href="/judges">
              Judges
            </a>
            <span className="mx-2">·</span>
            <a className="underline underline-offset-4" href="/admin">
              Officers
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
