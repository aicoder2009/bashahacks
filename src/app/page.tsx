import Link from "next/link";
import Avatar from "@/components/Avatar";
import { Logo, ThemeToggle } from "@/components/ui";
import type { AvatarSpec } from "@/lib/types";

const FACTS: [string, string][] = [
  ["When", "Saturday, November 14, 2026"],
  ["Time", "9:00 AM to 2:00 PM"],
  ["Where", "Room K105, Basha High School"],
  ["Theme", "Environment and sustainability"],
];

const STEPS: [string, string][] = [
  ["Notice a problem", "Wasted food, long showers, litter at school. Pick something you have seen at home, at school, or in your community."],
  ["Describe your app", "Tell the AI who it is for and what it should do. It writes the code while you watch."],
  ["Test and improve", "Click everything. Ask for changes one at a time, or change the code yourself."],
  ["Publish and present", "Press Publish to get a link anyone can open, then show your app to the room."],
];

const SCHEDULE: [string, string, string][] = [
  ["9:00", "Check in", "Sign in, find a seat, pick your character."],
  ["9:10", "Welcome", "The theme, the rules, and how judging works."],
  ["9:20", "Workshop: Brief the AI", "How to tell an AI exactly what to build, starting from a real problem."],
  ["9:30", "Building starts", "Short workshops along the way on working with AI properly: one change at a time, testing, debugging, and reading the code."],
  ["12:00", "Lunch", "Pizza and soda. Eat while you build."],
  ["1:00", "Building ends, presentations", "Each team shows its app on the big screen. Two minutes each."],
  ["1:40", "Winners", "Third, second, first."],
  ["2:00", "Done", ""],
];

const CRITERIA: [string, string][] = [
  ["Sustainability impact", "Does it tackle a real environmental problem, and would it help?"],
  ["Creativity", "Is the idea or the approach original?"],
  ["Does it work", "Can you actually use the app, start to finish?"],
  ["Design and ease of use", "Is it clear, good looking, and easy to figure out?"],
  ["Presentation", "Did the team explain the problem and their app well?"],
];

const FAQ: [string, string][] = [
  ["Do I need to know how to code?", "No. You describe your app in plain words and the AI writes the code. You will learn how to guide it, fix what breaks, and read a little of the code along the way."],
  ["Can I work with friends?", "Yes. Build solo or in a team of up to 3. You can start solo and invite a teammate later."],
  ["What do I need to bring?", "Your media and liability release forms, signed by a parent. You need them to get a seat. Computers are set up in the room."],
  ["Is there food?", "Yes. Pizza and soda around noon. You can eat while you build."],
  ["What can I build?", "Anything that helps the planet. A food waste tracker, a shower timer, a swap board, a cleanup log. There are starter ideas on the build screen if you are stuck."],
  ["What happens to my app afterward?", "When you press Publish, your app gets its own link. You can share it with family and friends."],
];

const STICKERS: { spec: AvatarSpec; cls: string }[] = [
  { spec: { s: 0, c: 0, e: 2, m: 1, a: 0 }, cls: "left-[5%] top-[18%] -rotate-12" },
  { spec: { s: 1, c: 2, e: 1, m: 0, a: 0 }, cls: "right-[6%] top-[14%] rotate-12" },
  { spec: { s: 2, c: 3, e: 0, m: 1, a: 5 }, cls: "left-[11%] bottom-[10%] rotate-6" },
  { spec: { s: 4, c: 3, e: 4, m: 5, a: 0 }, cls: "right-[10%] bottom-[14%] -rotate-6" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t border-line py-14">
      <h2 id={`${id}-h`} className="mb-6 text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
          <Logo />
          <nav aria-label="Sections" className="ml-auto hidden items-center gap-5 text-sm text-muted md:flex">
            <a className="hover:text-fg" href="#about">About</a>
            <a className="hover:text-fg" href="#schedule">Schedule</a>
            <a className="hover:text-fg" href="#judging">Judging</a>
            <a className="hover:text-fg" href="#faq">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ThemeToggle />
            <Link className="btn btn-primary btn-sm" href="/join">
              Check in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="relative py-20 text-center md:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden opacity-70 lg:block">
            {STICKERS.map((s, i) => (
              <div key={i} className={`absolute ${s.cls}`}>
                <Avatar spec={s.spec} size={84} />
              </div>
            ))}
          </div>
          <div className="relative">
            <p className="label mb-3">Basha High School DevOps Club</p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
              DevOps Basha <span className="text-accent">Hacks</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              Build an app that helps the planet, in one morning. No coding experience needed.
            </p>
            <p className="mono mt-5 text-sm">Sat, Nov 14 · 9:00 AM to 2:00 PM · Room K105</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link className="btn btn-primary btn-lg" href="/join">
                Sign in and check in
              </Link>
              <a className="btn btn-lg" href="#schedule">
                See the schedule
              </a>
            </div>
            <p className="mt-3 text-sm text-muted">Check in opens at 9:00. The event code is on the big screen in the room.</p>
          </div>
        </section>

        <dl className="grid grid-cols-2 gap-3 pb-14 md:grid-cols-4">
          {FACTS.map(([k, v]) => (
            <div key={k} className="card p-4">
              <dt className="label mb-1">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <Section id="about" title="What is Basha Hacks?">
          <p className="max-w-2xl text-muted">
            A beginner hackathon run by the DevOps Club. You pick an environmental problem you have noticed, describe an app that helps, and an AI builds it with you. You see the chat, the code, and a live preview side by side. By the end of the morning you have a real app with its own link.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="card p-4">
                <span className="mono mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-sm text-accent" aria-hidden>
                  {i + 1}
                </span>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="schedule" title="Schedule">
          <ol className="card divide-y divide-line">
            {SCHEDULE.map(([time, title, note]) => (
              <li key={time} className="flex gap-4 px-4 py-3">
                <span className="mono w-14 shrink-0 font-semibold tabular-nums text-accent">{time}</span>
                <span>
                  <span className="font-medium">{title}</span>
                  {note && <span className="block text-sm text-muted">{note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="judging" title="Judging and prizes">
          <p className="max-w-2xl text-muted">
            Each team shows its app to the room. Judges score five things, and the top three teams take the podium.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CRITERIA.map(([name, hint]) => (
              <li key={name} className="card p-4">
                <p className="font-medium">{name}</p>
                <p className="mt-1 text-sm text-muted">{hint}</p>
              </li>
            ))}
            <li className="card border-accent/50 bg-accent-soft p-4">
              <p className="font-medium">Prizes</p>
              <p className="mt-1 text-sm text-muted">Gift cards for the top projects, thanks to our club sponsor.</p>
            </li>
          </ul>
        </Section>

        <Section id="faq" title="Questions">
          <div className="card divide-y divide-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="mono text-muted group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-2xl text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        <section className="border-t border-line py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Here for the event?</h2>
          <p className="mt-2 text-muted">Sign in with the event code and start building.</p>
          <Link className="btn btn-primary btn-lg mt-6" href="/join">
            Sign in and check in
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted">
          <span>DevOps Club, Basha High School</span>
          <span>
            <Link className="underline underline-offset-4" href="/judges">
              Judges
            </Link>
            <span className="mx-2">·</span>
            <Link className="underline underline-offset-4" href="/admin">
              Officers
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
