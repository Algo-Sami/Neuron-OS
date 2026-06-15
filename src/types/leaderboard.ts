export interface LeaderboardEntry {
  user_id: string;
  full_name: string | null;
  username: string;
  profile_image: string | null;
  total_xp: number;
  current_level: number;
  rank: number;
}
