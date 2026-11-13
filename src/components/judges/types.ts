import type { AvatarSpec, Phase } from "@/lib/types";

export type JudgeCriterion = { id: number; name: string; hint: string; weight: number };

export type JudgeTeam = {
  teamId: string;
  teamName: string;
  slug: string;
  solo: boolean;
  appTitle: string;
  submitted: boolean;
  category: string;
  problem: string;
  solution: string;
  members: { name: string; avatar: AvatarSpec }[];
  scores: Record<number, number>;
  comment: string;
  complete: boolean;
};

export type JudgeState = {
  now: number;
  judge: { id: string; name: string };
  eventName: string;
  phase: Phase;
  locked: boolean;
  criteria: JudgeCriterion[];
  teams: JudgeTeam[];
};

export type SaveState = "idle" | "saving" | "saved" | "error";

export function isComplete(criteria: JudgeCriterion[], scores: Record<number, number>): boolean {
  return criteria.length > 0 && criteria.every((c) => scores[c.id] != null);
}

export function scoredCount(criteria: JudgeCriterion[], scores: Record<number, number>): number {
  return criteria.filter((c) => scores[c.id] != null).length;
}

export function totalOf(criteria: JudgeCriterion[], scores: Record<number, number>): number {
  return criteria.reduce((sum, c) => sum + (scores[c.id] || 0), 0);
}

export function categoryLabel(category: string): string {
  return category ? category.charAt(0).toUpperCase() + category.slice(1) : "";
}
