export interface UserProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  username: string;
  email: string;
  bio?: string | null;
  university?: string | null;
  degree_program?: string | null;
  semester?: string | null;
  profile_image?: string | null;
  interests?: string[] | null;
  study_goals?: string[] | null;
  country?: string | null;
  timezone?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SignUpFields {
  fullName: string;
  username: string;
  email: string;
  password?: string;
  bio: string;
  university: string;
  degreeProgram: string;
  semester: string;
  profileImage: string | null;
  interests: string[];
  studyGoals: string[];
  country: string;
  timezone: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  xp_reward: number;
}

export interface UserProgress {
  user_id: string;
  total_xp: number;
  current_level: number;
  rank_name: string;
  xp_to_next_level: number;
  progress_percent: number;
}
