import { SubjectItem } from './subject';
import { FolderItem } from './folder';
import { DocumentItem } from './file';

export type ViewMode =
  | "large-icons"
  | "medium-icons"
  | "small-icons"
  | "list"
  | "details"
  | "tiles";

export interface RecentItem {
  id: string;
  name: string;
  type: "subject" | "folder" | "file";
  subjectId: string | null;
  folderId: string | null;
  openedAt: string; // ISO timestamp
}

export interface ExplorerItemData {
  id: string;
  name: string;
  type: 'subject' | 'folder' | 'file';
  color?: string | null;
  code?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt: string;
  modifiedAt?: string | null;
  lastStudied?: string | null;
  // AI status
  summaryStatus?: string | null;
  quizStatus?: string | null;
  aiStatus?: "processed" | "processing" | "failed" | "pending" | null;
  aiSubject?: string | null;
  aiTopic?: string | null;
  fileUrl?: string | null;
  // Subject/Folder details
  folderCount?: number;
  documentCount?: number;
  subjectId?: string | null;
  parentFolderId?: string | null;
  // UI state
  isFavorite?: boolean;
}

export interface BreadcrumbSegment {
  label: string;
  subjectId: string | null;
  folderId: string | null;
  color?: string | null;
}

export interface SidebarSubject {
  id: string;
  name: string;
  color?: string | null;
  code?: string | null;
}

export interface SidebarFolder {
  id: string;
  name: string;
  subject_id: string;
  parent_folder_id: string | null;
}
