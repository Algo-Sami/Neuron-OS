export interface FolderItem {
  id: string;
  name: string;
  subject_id: string;
  parent_folder_id: string | null;
  created_at: string;
}
