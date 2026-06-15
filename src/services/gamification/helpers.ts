import { Achievement, UserProgress } from "@/types";
import { DEFAULT_ACHIEVEMENTS } from "@/constants";

export { DEFAULT_ACHIEVEMENTS };

// 2. XP thresholds and Rank calculations
export function getXpThresholdForLevel(level: number): number {
  return level * 1000; // e.g., Level 1 requires 1000 XP, Level 2 requires 2000 XP
}

export function getRankName(level: number): string {
  if (level >= 20) return "Polymath (Master Thinker)";
  if (level >= 15) return "Archmage (Knowledge Curator)";
  if (level >= 10) return "Sage (Adept Investigator)";
  if (level >= 5) return "Scholar (Consistent Learner)";
  return "Novice (Basic Student)";
}
