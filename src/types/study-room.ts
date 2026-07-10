export interface StudyRoom {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  topic?: string | null;
  is_active: boolean;
  member_count?: number;
}

export interface StudyRoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string;
    profile_image: string | null;
  } | null;
}
