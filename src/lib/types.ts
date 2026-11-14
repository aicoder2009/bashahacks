export type ReasoningEffort = "off" | "low" | "medium" | "high";

export type Phase = "lobby" | "hacking" | "judging" | "winners" | "done";

export type AvatarSpec = { s: number; c: number; e: number; m: number; a: number };

export type Files = Record<string, string>;
export const FILE_NAMES = ["index.html", "style.css", "script.js"] as const;

export type ScheduleItem = { time: string; label: string };

export type PodiumEntry = {
  place: number;
  teamId: string;
  teamName: string;
  appTitle: string;
  score: number;
  members: { name: string; avatar: AvatarSpec }[];
};

export type EventSettings = {
  eventName: string;
  phase: Phase;
  startsAt: number;
  endsAt: number;
  autoStart: boolean;
  autoEnd: boolean;
  pausedRemainingMs: number | null;
  eventCode: string;
  judgeCode: string;
  tvKey: string;
  teamsAllowed: boolean;
  maxTeamSize: number;
  model: string;
  reasoningEffort: ReasoningEffort;
  defaultCapUsd: number;
  totalBudgetUsd: number;
  aiPausedAll: boolean;
  schedule: ScheduleItem[];
  podium: PodiumEntry[] | null;
  podiumStep: number;
  /** The team whose app is on the TV during judging. */
  presentingTeamId: string | null;
};

export type PublicEvent = {
  name: string;
  phase: Phase;
  startsAt: number;
  endsAt: number;
  pausedRemainingMs: number | null;
  teamsAllowed: boolean;
  schedule: ScheduleItem[];
};

export type MemberView = { id: string; name: string; avatar: AvatarSpec; online: boolean };

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  memberId: string | null;
  content: string;
  meta: { files?: string[]; suggestions?: string[]; error?: string; truncated?: boolean };
  createdAt: number;
};

export type Announcement = { id: number; body: string; urgent: boolean; createdAt: number };

export type Submission = {
  title: string;
  problem: string;
  solution: string;
  category: string;
  submittedAt: number;
  updatedAt: number;
};

export type UsageView = { pctLeft: number; blocked: boolean; reason: "" | "cap" | "paused" | "event" };

export type SyncResponse = {
  now: number;
  event: PublicEvent;
  me: { id: string; name: string; avatar: AvatarSpec };
  team: {
    id: string;
    name: string;
    code: string;
    slug: string;
    solo: boolean;
    version: number;
    busy: { memberId: string; name: string } | null;
    usage: UsageView;
    members: MemberView[];
    publishedAt: number | null;
    publishedVersion: number | null;
    appTitle: string | null;
    milestones: Record<string, number>;
  };
  files?: Files;
  messages: ChatMessage[];
  announcements: Announcement[];
  submission: Submission | null;
};

export type Criterion = { id: number; name: string; hint: string; weight: number; position: number };
