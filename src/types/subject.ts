import { FolderItem } from './folder';
import { DocumentItem } from './file';

export interface SubjectItem {
  id: string;
  name: string;
  color?: string | null;
  code?: string | null;
  created_at: string;
  deleted_at?: string | null;
  folders?: FolderItem[];
  documents?: DocumentItem[];
}
