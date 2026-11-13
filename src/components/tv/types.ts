import type { AvatarSpec, Phase, PodiumEntry, ScheduleItem } from "@/lib/types";

export type TvAnnouncement = { id: number; body: string; urgent: boolean; createdAt: number };

export type TvTeam = {
  id: string;
  name: string;
  solo: boolean;
  members: { name: string; avatar: AvatarSpec }[];
  published: boolean;
  submitted: boolean;
};

export type TvData = {
  now: number;
  event: {
    name: string;
    phase: Phase;
    startsAt: number;
    endsAt: number;
    pausedRemainingMs: number | null;
    eventCode: string;
    schedule: ScheduleItem[];
    podium: PodiumEntry[] | null;
    podiumStep: number;
  };
  announcement: TvAnnouncement | null;
  teams: TvTeam[];
  counts: { students: number; teams: number; published: number; submitted: number };
};

export type ModeProps = { data: TvData; now: number; host: string; origin: string };
