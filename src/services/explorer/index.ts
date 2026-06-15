import { BreadcrumbSegment, FolderItem } from "@/types";

export function getPreviewUrl(fileUrl: string | null, fileType: string | null): string {
  if (!fileUrl) return "#";
  const ext = (fileType || "").toLowerCase();
  if (["docx", "pptx", "xlsx", "doc", "ppt", "xls"].includes(ext)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
  }
  if (ext === "pdf") {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}`;
  }
  return fileUrl;
}

export function buildBreadcrumbs(
  activeTab: "subjects" | "uploads" | "assignments" | "notes" | "recycle-bin",
  currentSubjectId: string | null,
  currentFolderId: string | null,
  activeSubjectName: string | undefined,
  initialFolders: FolderItem[]
): BreadcrumbSegment[] {
  if (activeTab === "recycle-bin") {
    return [{ label: "Recycle Bin", subjectId: null, folderId: null }];
  }
  if (activeTab === "uploads") {
    return [{ label: "All Uploads", subjectId: null, folderId: null }];
  }
  if (activeTab === "assignments") {
    return [{ label: "Assignments", subjectId: null, folderId: null }];
  }
  if (activeTab === "notes") {
    return [{ label: "Notes", subjectId: null, folderId: null }];
  }

  const segments: BreadcrumbSegment[] = [{ label: "Subjects", subjectId: null, folderId: null }];
  
  if (currentSubjectId) {
    segments.push({
      label: activeSubjectName || "Subject",
      subjectId: currentSubjectId,
      folderId: null,
    });

    if (currentFolderId) {
      // Find ancestor path of folder
      const path: FolderItem[] = [];
      let currId: string | null = currentFolderId;
      
      while (currId) {
        const f = initialFolders.find((folder) => folder.id === currId);
        if (f) {
          path.unshift(f);
          currId = f.parent_folder_id;
        } else {
          currId = null;
        }
      }

      path.forEach((f) => {
        segments.push({
          label: f.name,
          subjectId: currentSubjectId,
          folderId: f.id,
        });
      });
    }
  }

  return segments;
}
