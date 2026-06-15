export interface UserProfileDetails {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  email: string;
  bio?: string;
  university?: string;
  degree_program?: string;
  semester?: string;
  profile_image?: string;
  interests?: string[];
  study_goals?: string[];
  country?: string;
  timezone?: string;
  created_at: string;
  updated_at: string;
}
