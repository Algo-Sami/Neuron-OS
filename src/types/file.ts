export interface DocumentItem {
  id: string;
  title: string;
  file_type: string | null;
  file_url: string | null;
  created_at: string;
  deleted_at?: string | null;
  subject_id: string | null;
  folder_id: string | null;
  summary_status: string | null;
  quiz_status: string | null;
  ai_subject: string | null;
  ai_topic: string | null;
  ai_doc_type?: string | null;
  uploads?: {
    file_size: number;
  } | null;
}
