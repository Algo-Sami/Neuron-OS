export const LEADERBOARD_CONFIG = {
  topRankThreshold: 10,
  refreshIntervalMs: 30_000,
  rankNames: {
    20: "Polymath (Master Thinker)",
    15: "Archmage (Knowledge Curator)",
    10: "Sage (Adept Investigator)",
    5: "Scholar (Consistent Learner)",
    0: "Novice (Basic Student)"
  }
} as const;
