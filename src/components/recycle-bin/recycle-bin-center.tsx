"use client";

import React, {
  useState,
  useMemo,
  useTransition,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  RefreshCw,
  Folder,
  File,
  FileText,
  Image as ImageIcon,
  Archive,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Info,
  Calendar,
  HardDrive,
  Tag,
  ArrowUpDown,
  Filter,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  FolderPlus,
  ArrowRight,
  Undo2,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  restoreRecycleBinItemAction,
  restoreMultipleItemsAction,
  deleteMultipleItemsAction,
  emptyRecycleBinAction,
} from "@/actions/recycle-bin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubjectItem {
  id: string;
  name: string;
  color?: string | null;
  code?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  folders?: FolderItem[] | null;
  documents?: DocumentItem[] | null;
}

interface FolderItem {
  id: string;
  name: string;
  subject_id: string;
  parent_folder_id: string | null;
}

interface DocumentItem {
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
  uploads?: { file_size: number | null } | null;
}

interface RecycleBinCenterProps {
  subjects: SubjectItem[];
  folders: FolderItem[];
  documents: DocumentItem[];
  recycledSubjects: SubjectItem[];
  recycledDocuments: DocumentItem[];
}

type SortKey = "date" | "name" | "size" | "subject" | "type";
type SortDir = "asc" | "desc";
type FilterKey =
  | "all"
  | "files"
  | "folders"
  | "pdf"
  | "docx"
  | "pptx"
  | "image"
  | "assignment"
  | "note"
  | "lecture"
  | "ai";

const ITEMS_PER_PAGE = 15;

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === undefined || bytes === null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getRetentionDaysLeft(deletedAtStr: string | null | undefined): number {
  if (!deletedAtStr) return 10;
  try {
    const deletedAt = new Date(deletedAtStr);
    const now = new Date();
    const diffTime = now.getTime() - deletedAt.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const left = 10 - diffDays;
    return Math.max(0, left);
  } catch {
    return 10;
  }
}

function getFileIcon(type: string | null | undefined, className = "h-4 w-4") {
  const t = (type || "").toLowerCase();
  if (t === "pdf") return <FileText className={cn(className, "text-red-400")} />;
  if (t === "docx" || t === "doc") return <FileText className={cn(className, "text-blue-400")} />;
  if (t === "pptx" || t === "ppt") return <FileText className={cn(className, "text-orange-400")} />;
  if (t === "txt") return <FileText className={cn(className, "text-muted-foreground")} />;
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(t))
    return <ImageIcon className={cn(className, "text-emerald-400")} />;
  if (t === "zip" || t === "rar") return <Archive className={cn(className, "text-yellow-400")} />;
  return <File className={cn(className, "text-muted-foreground")} />;
}

function buildFolderPath(
  folderId: string | null,
  folders: FolderItem[]
): { path: string; exists: boolean } {
  if (!folderId) return { path: "Root", exists: true };
  const pathParts: string[] = [];
  let currentId: string | null = folderId;
  const maxDepth = 10;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const f = folders.find((folder) => folder.id === currentId);
    if (!f) {
      // Folder not found in list -> permanently deleted
      return { path: "Original location unavailable.", exists: false };
    }
    pathParts.unshift(f.name);
    currentId = f.parent_folder_id || null;
    depth++;
  }

  return { path: pathParts.join(" > "), exists: true };
}

// ---------------------------------------------------------------------------
// Main RecycleBinCenter Component
// ---------------------------------------------------------------------------

export function RecycleBinCenter({
  subjects,
  folders,
  documents,
  recycledSubjects,
  recycledDocuments,
}: RecycleBinCenterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search, Filters & Sorting
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Detail panel state
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  // Dialog states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Location resolution specific states
  const [resolutionItem, setResolutionItem] = useState<{
    id: string;
    name: string;
    originalSubjectId: string | null;
    originalSubjectName: string | null;
  } | null>(null);
  const [resolutionOption, setResolutionOption] = useState<"recreate" | "root" | "new">("root");
  const [recreateName, setRecreateName] = useState("Restored Folder");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newFolderId, setNewFolderId] = useState("");

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Active subjects map & list
  const activeSubjects = useMemo(() => subjects, [subjects]);
  const activeSubjectsMap = useMemo(() => {
    const m = new Map<string, string>();
    activeSubjects.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [activeSubjects]);

  // Unified list of deleted items (Subjects and Files)
  const recycledList = useMemo(() => {
    const list: {
      id: string;
      name: string;
      type: "subject" | "file";
      fileType: string | null;
      size: number | null;
      deletedAt: string;
      originalSubjectId: string | null;
      originalSubjectName: string | null;
      originalFolderId: string | null;
      originalFolderName: string | null;
      originalFolderPath: string;
      isLocationAvailable: boolean;
      sizeText: string;
      aiDocType: string | null;
      summaryStatus: string | null;
      quizStatus: string | null;
    }[] = [];

    // Add soft-deleted subjects
    recycledSubjects.forEach((s) => {
      list.push({
        id: s.id,
        name: s.name,
        type: "subject",
        fileType: null,
        size: null,
        deletedAt: s.deleted_at || s.created_at || "",
        originalSubjectId: null,
        originalSubjectName: "—",
        originalFolderId: null,
        originalFolderName: null,
        originalFolderPath: "Root",
        isLocationAvailable: true,
        sizeText: "—",
        aiDocType: null,
        summaryStatus: null,
        quizStatus: null,
      });
    });

    // Add soft-deleted files
    recycledDocuments.forEach((d) => {
      const isSubActive = d.subject_id ? activeSubjectsMap.has(d.subject_id) : false;
      const subName = d.subject_id ? (activeSubjectsMap.get(d.subject_id) || "Deleted Subject") : "Unclassified";

      const folderRes = buildFolderPath(d.folder_id, folders);

      // Location is available if the subject exists and (the folder is null or exists)
      const isLocAvail = (d.subject_id ? isSubActive : true) && folderRes.exists;

      list.push({
        id: d.id,
        name: d.title,
        type: "file",
        fileType: d.file_type,
        size: d.uploads?.file_size || 0,
        deletedAt: d.deleted_at || d.created_at,
        originalSubjectId: d.subject_id,
        originalSubjectName: subName,
        originalFolderId: d.folder_id,
        originalFolderName: d.folder_id ? (folders.find(f => f.id === d.folder_id)?.name || null) : null,
        originalFolderPath: isSubActive ? folderRes.path : "Original Subject Deleted",
        isLocationAvailable: isLocAvail,
        sizeText: formatFileSize(d.uploads?.file_size),
        aiDocType: d.ai_doc_type || null,
        summaryStatus: d.summary_status || null,
        quizStatus: d.quiz_status || null,
      });
    });

    return list;
  }, [recycledSubjects, recycledDocuments, activeSubjectsMap, folders]);

  // Overview stats computations
  const stats = useMemo(() => {
    let fileCount = recycledDocuments.length;
    let folderCount = 0;
    let totalSize = 0;
    let newestDeleted: typeof recycledList[0] | null = null;

    // Add contents of recycled subjects to statistics
    recycledSubjects.forEach((s) => {
      folderCount += s.folders?.length || 0;
      fileCount += s.documents?.length || 0;

      s.documents?.forEach((d) => {
        // Assume default size or size from nested uploads
        // Since documents nested inside recycledSubjects might not have uploads pre-fetched, we check
        // but typically size is zero or negligible for metadata. Let's sum sizes if available.
        totalSize += 0;
      });
    });

    recycledDocuments.forEach((d) => {
      totalSize += d.uploads?.file_size || 0;
    });

    // Find latest deleted item
    if (recycledList.length > 0) {
      const sortedByDeleteDate = [...recycledList].sort(
        (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
      );
      newestDeleted = sortedByDeleteDate[0];
    }

    return {
      fileCount,
      folderCount,
      totalSizeText: formatFileSize(totalSize),
      lastDeletedName: newestDeleted ? newestDeleted.name : "None",
      lastDeletedTime: newestDeleted ? newestDeleted.deletedAt : null,
    };
  }, [recycledSubjects, recycledDocuments, recycledList]);

  // Filtering
  const filteredList = useMemo(() => {
    return recycledList.filter((item) => {
      // Search term match
      if (search) {
        const q = search.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSubject = (item.originalSubjectName || "").toLowerCase().includes(q);
        const matchesLocation = item.originalFolderPath.toLowerCase().includes(q);
        if (!matchesName && !matchesSubject && !matchesLocation) return false;
      }

      // Filter tabs
      if (filter === "files") return item.type === "file";
      if (filter === "folders") return item.type === "subject"; // Soft-deleted subjects display as folders

      if (item.type === "file") {
        const ft = (item.fileType || "").toLowerCase();
        const type = (item.aiDocType || "").toLowerCase();

        if (filter === "pdf") return ft === "pdf";
        if (filter === "docx") return ft === "docx" || ft === "doc";
        if (filter === "pptx") return ft === "pptx" || ft === "ppt";
        if (filter === "image") return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ft);
        if (filter === "assignment") return type === "assignment" || item.name.toLowerCase().includes("assignment");
        if (filter === "note") return ["notes", "note"].includes(type) || item.name.toLowerCase().includes("note");
        if (filter === "lecture") return ["lecture", "slides"].includes(type) || item.name.toLowerCase().includes("lecture");
        if (filter === "ai") return ["summary", "quiz"].includes(type) || item.summaryStatus !== null || item.quizStatus !== null;
      } else {
        // Subjects are folders, so exclude them from specific file type filters
        if (filter !== "all") return false;
      }

      return true;
    });
  }, [recycledList, search, filter]);

  // Sorting
  const sortedList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "date") {
        cmp = new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime();
      } else if (sortKey === "size") {
        cmp = (a.size || 0) - (b.size || 0);
      } else if (sortKey === "subject") {
        cmp = (a.originalSubjectName || "").localeCompare(b.originalSubjectName || "");
      } else if (sortKey === "type") {
        cmp = a.type.localeCompare(b.type);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredList, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedList.length / ITEMS_PER_PAGE));
  const pageStart = (page - 1) * ITEMS_PER_PAGE;
  const paginatedList = sortedList.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  // Active details item
  const selectedDetailItem = useMemo(() => {
    return recycledList.find((i) => i.id === detailItemId) || null;
  }, [recycledList, detailItemId]);

  // Handlers
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedList.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      showToast("success", "Recycle bin refreshed successfully");
    });
  };

  const handleRestoreItem = async (item: typeof recycledList[0]) => {
    if (!item.isLocationAvailable) {
      // Show location resolution dialog
      setResolutionItem({
        id: item.id,
        name: item.name,
        originalSubjectId: item.originalSubjectId,
        originalSubjectName: item.originalSubjectName,
      });
      setResolutionOption("root");
      setRecreateName(item.originalFolderName || "Restored Folder");
      setNewSubjectId("");
      setNewFolderId("");
      setResolutionOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        await restoreRecycleBinItemAction(item.id, item.type);
        showToast("success", `"${item.name}" restored successfully.`);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        if (detailItemId === item.id) setDetailItemId(null);
      } catch (err: any) {
        showToast("error", err.message || "Failed to restore item.");
      }
    });
  };

  const handleResolutionSubmit = async () => {
    if (!resolutionItem) return;

    startTransition(async () => {
      try {
        const opts: Record<string, any> = {};

        if (resolutionOption === "recreate") {
          opts.recreateFolderName = recreateName.trim() || "Restored Folder";
          opts.targetSubjectId = resolutionItem.originalSubjectId || activeSubjects[0]?.id;
        } else if (resolutionOption === "root") {
          opts.toRoot = true;
          opts.targetSubjectId = resolutionItem.originalSubjectId || activeSubjects[0]?.id;
        } else if (resolutionOption === "new") {
          opts.targetSubjectId = newSubjectId;
          opts.targetFolderId = newFolderId || null;
        }

        if (!opts.targetSubjectId) {
          throw new Error("No active subjects available to restore to. Create a subject first.");
        }

        await restoreRecycleBinItemAction(resolutionItem.id, "file", opts);
        showToast("success", `"${resolutionItem.name}" restored successfully.`);
        setResolutionOpen(false);
        setResolutionItem(null);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(resolutionItem.id);
          return next;
        });
        if (detailItemId === resolutionItem.id) setDetailItemId(null);
      } catch (err: any) {
        showToast("error", err.message || "Failed to restore item.");
      }
    });
  };

  const handleRestoreSelected = async () => {
    if (selectedIds.size === 0) return;

    const selectedItems = recycledList.filter((item) => selectedIds.has(item.id));
    const locationUnavailableItems = selectedItems.filter((item) => !item.isLocationAvailable);

    if (locationUnavailableItems.length > 0) {
      // If any selected files have unavailable locations, restore them one by one or prompt resolution
      showToast("error", "One or more selected files have unavailable locations. Restore them individually to resolve their paths.");
      return;
    }

    startTransition(async () => {
      try {
        await restoreMultipleItemsAction(
          selectedItems.map((item) => ({ id: item.id, type: item.type }))
        );
        showToast("success", `${selectedIds.size} items restored successfully.`);
        setSelectedIds(new Set());
        setDetailItemId(null);
      } catch (err: any) {
        showToast("error", err.message || "Failed to restore selected items.");
      }
    });
  };

  const handleRestoreAll = async () => {
    const hasUnavailable = recycledList.some((item) => !item.isLocationAvailable);
    if (hasUnavailable) {
      showToast("error", "Some files have unavailable original locations. Please restore those items individually.");
      return;
    }

    startTransition(async () => {
      try {
        await restoreMultipleItemsAction(
          recycledList.map((item) => ({ id: item.id, type: item.type }))
        );
        showToast("success", "All recoverable items restored successfully.");
        setSelectedIds(new Set());
        setDetailItemId(null);
      } catch (err: any) {
        showToast("error", err.message || "Failed to restore all items.");
      }
    });
  };

  const handleDeletePermanently = async () => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      try {
        const selectedItems = recycledList.filter((item) => selectedIds.has(item.id));
        await deleteMultipleItemsAction(
          selectedItems.map((item) => ({ id: item.id, type: item.type }))
        );
        showToast("success", `${selectedIds.size} items permanently deleted.`);
        setSelectedIds(new Set());
        setConfirmDeleteOpen(false);
        setDetailItemId(null);
      } catch (err: any) {
        showToast("error", err.message || "Failed to delete selected items.");
      }
    });
  };

  const handleEmptyRecycleBin = async () => {
    startTransition(async () => {
      try {
        await emptyRecycleBinAction();
        showToast("success", "Recycle bin emptied successfully.");
        setSelectedIds(new Set());
        setConfirmEmptyOpen(false);
        setDetailItemId(null);
      } catch (err: any) {
        showToast("error", err.message || "Failed to empty recycle bin.");
      }
    });
  };

  // Subfolder options for chosen subject in Location Resolution dropdown
  const foldersForSelectedSubject = useMemo(() => {
    if (!newSubjectId) return [];
    return folders.filter((f) => f.subject_id === newSubjectId);
  }, [newSubjectId, folders]);

  return (
    <div className="space-y-6 select-none relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md animate-in slide-in-from-top-4 duration-300",
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          )}
          <span className="text-xs font-medium">{toast.msg}</span>
        </div>
      )}

      {/* SECTION 1: RECYCLE BIN OVERVIEW CARD */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 rounded-2xl border border-border/60 bg-card/45 backdrop-blur-sm p-6 flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute top-0 right-0 h-40 w-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-300" />
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Workspace Recovery Center</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Manage recently deleted subject notebooks and document uploads
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-secondary/40 border border-border/30 rounded-xl p-3">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Deleted Files</p>
                <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{stats.fileCount}</p>
              </div>
              <div className="bg-secondary/40 border border-border/30 rounded-xl p-3">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Deleted Folders</p>
                <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{stats.folderCount}</p>
              </div>
              <div className="bg-secondary/40 border border-border/30 rounded-xl p-3">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Storage Used</p>
                <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{stats.totalSizeText}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl border border-border/60 bg-card/45 backdrop-blur-sm p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="space-y-4">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Retention Period</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <p className="text-2xl font-bold text-foreground">10 Days</p>
                <p className="text-[10px] text-muted-foreground font-semibold">Remaining Limit</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                Items are kept for 10 days before being permanently erased.
              </p>
            </div>
            <div className="border-t border-border/30 pt-3 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Last Deleted Item</p>
                <p className="text-xs font-semibold text-foreground truncate mt-0.5" title={stats.lastDeletedName}>
                  {stats.lastDeletedName}
                </p>
                {stats.lastDeletedTime && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {formatDate(stats.lastDeletedTime)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS TOOLBAR */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 border border-border/60 p-3 rounded-xl backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0 || isPending}
              onClick={handleRestoreSelected}
              className="text-xs h-8 cursor-pointer gap-1.5 border-border/80"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Selected ({selectedIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={recycledList.length === 0 || isPending}
              onClick={handleRestoreAll}
              className="text-xs h-8 cursor-pointer gap-1.5 border-border/80"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Restore All
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0 || isPending}
              onClick={() => setConfirmDeleteOpen(true)}
              className="text-xs h-8 cursor-pointer gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Permanently
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={recycledList.length === 0 || isPending}
              onClick={() => setConfirmEmptyOpen(true)}
              className="text-xs h-8 cursor-pointer gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Empty Recycle Bin
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                type="text"
                placeholder="Search deleted items..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 h-8 text-xs bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-primary rounded-lg w-full"
              />
            </div>
            <button
              onClick={handleRefresh}
              disabled={isPending}
              title="Refresh recycle bin"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-border/60 bg-background/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin text-primary")} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {([
            { key: "all", label: "All Items" },
            { key: "files", label: "Files" },
            { key: "folders", label: "Folders" },
            { key: "pdf", label: "PDF" },
            { key: "docx", label: "DOCX" },
            { key: "pptx", label: "PPTX" },
            { key: "image", label: "Images" },
            { key: "assignment", label: "Assignments" },
            { key: "note", label: "Notes" },
            { key: "lecture", label: "Lectures" },
            { key: "ai", label: "AI Generated" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFilter(tab.key);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap",
                filter === tab.key
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-secondary/30 border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/65"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 2: HISTORY LISTING / DETAILS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Table & Cards (Left) */}
        <div className={cn("lg:col-span-3 space-y-4", detailItemId && "lg:col-span-3")}>
          {paginatedList.length === 0 ? (
            /* Empty State */
            <div className="rounded-2xl border border-border/60 bg-card/30 py-16 px-6 text-center backdrop-blur-xs flex flex-col items-center">
              <div className="h-16 w-16 rounded-2xl bg-secondary/80 border border-border/40 flex items-center justify-center text-muted-foreground mb-4">
                <Trash2 className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-base font-bold text-foreground">Recycle Bin is Empty</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Deleted subjects and notes reside here temporarily for 10 days before permanent erasure.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <Button
                  onClick={() => router.push("/subjects")}
                  size="sm"
                  className="text-xs h-8 cursor-pointer"
                >
                  Go to Subjects
                </Button>
                <Button
                  onClick={() => router.push("/uploads")}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 cursor-pointer border-border/80"
                >
                  Go to Uploads
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-border/60 bg-card/45 backdrop-blur-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/25">
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={
                            paginatedList.length > 0 &&
                            paginatedList.every((item) => selectedIds.has(item.id))
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-border/60 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                        />
                      </th>
                      <th
                        onClick={() => handleSort("name")}
                        className="p-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortKey === "name" && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("type")}
                        className="p-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      >
                        <div className="flex items-center gap-1">
                          Type
                          {sortKey === "type" && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("subject")}
                        className="p-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      >
                        <div className="flex items-center gap-1">
                          Original Subject
                          {sortKey === "subject" && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </th>
                      <th className="p-3 text-xs font-semibold text-muted-foreground">
                        Original Location
                      </th>
                      <th
                        onClick={() => handleSort("date")}
                        className="p-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      >
                        <div className="flex items-center gap-1">
                          Deleted Date
                          {sortKey === "date" && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("size")}
                        className="p-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      >
                        <div className="flex items-center gap-1">
                          Size
                          {sortKey === "size" && (
                            <ArrowUpDown className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </th>
                      <th className="p-3 w-24 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedList.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const daysLeft = getRetentionDaysLeft(item.deletedAt);

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setDetailItemId(item.id)}
                          className={cn(
                            "border-b border-border/20 last:border-0 hover:bg-secondary/15 transition-colors group cursor-pointer",
                            isSelected && "bg-primary/[0.02] hover:bg-primary/[0.04]"
                          )}
                        >
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                handleSelectItem(item.id, e.target.checked)
                              }
                              className="rounded border-border/60 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                            />
                          </td>
                          <td className="p-3 font-medium max-w-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.type === "subject" ? (
                                <Folder className="h-4.5 w-4.5 text-primary shrink-0" />
                              ) : (
                                getFileIcon(item.fileType, "h-4.5 w-4.5 shrink-0")
                              )}
                              <span
                                className="text-xs text-foreground font-semibold truncate"
                                title={item.name}
                              >
                                {item.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground bg-secondary/65 border border-border/30 px-1.5 py-0.5 rounded-md">
                              {item.type === "subject"
                                ? "Subject Notebook"
                                : item.fileType?.toUpperCase() || "File"}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground font-medium truncate">
                            {item.originalSubjectName}
                          </td>
                          <td className="p-3 text-xs">
                            <span
                              className={cn(
                                "font-medium truncate block max-w-[150px]",
                                item.isLocationAvailable
                                  ? "text-muted-foreground"
                                  : "text-amber-400 flex items-center gap-1"
                              )}
                              title={item.originalFolderPath}
                            >
                              {!item.isLocationAvailable && (
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                              )}
                              {item.originalFolderPath}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(item.deletedAt)}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground tabular-nums">
                            {item.sizeText}
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button className="h-7 w-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                }
                              />
                              <DropdownMenuContent
                                align="end"
                                className="w-44 bg-card border border-border/70 shadow-xl backdrop-blur-md"
                              >
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer gap-2"
                                  onClick={() => handleRestoreItem(item)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                                  onClick={() => {
                                    setSelectedIds(new Set([item.id]));
                                    setConfirmDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Forever
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-border/30 rounded-xl border border-border/60 bg-card/45 overflow-hidden">
                {paginatedList.map((item) => {
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => setDetailItemId(item.id)}
                      className={cn(
                        "p-4 flex items-start gap-3 cursor-pointer hover:bg-secondary/10",
                        isSelected && "bg-primary/[0.01]"
                      )}
                    >
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSelectItem(item.id, e.target.checked)
                          }
                          className="rounded border-border/60 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                        />
                      </div>
                      <div className="h-9 w-9 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
                        {item.type === "subject" ? (
                          <Folder className="h-4.5 w-4.5 text-primary" />
                        ) : (
                          getFileIcon(item.fileType, "h-4.5 w-4.5")
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold bg-secondary/65 border border-border/30 px-1 py-0.25 rounded">
                            {item.type === "subject" ? "Folder" : item.fileType || "File"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {item.originalSubjectName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {item.sizeText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                          <span className="text-muted-foreground">Deleted: {formatDate(item.deletedAt)}</span>
                        </div>
                        {!item.isLocationAvailable && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mt-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Original location unavailable
                          </div>
                        )}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button className="h-7 w-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors cursor-pointer shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            }
                          />
                          <DropdownMenuContent
                            align="end"
                            className="w-44 bg-card border border-border/70 shadow-xl backdrop-blur-md"
                          >
                            <DropdownMenuItem
                              className="text-xs cursor-pointer gap-2"
                              onClick={() => handleRestoreItem(item)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                              onClick={() => {
                                setSelectedIds(new Set([item.id]));
                                setConfirmDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Forever
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/20 pt-4 bg-background">
                  <span className="text-xs text-muted-foreground font-semibold">
                    Page {page} of {totalPages} ({sortedList.length} items)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="text-xs h-8 cursor-pointer px-3 border-border/80"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="text-xs h-8 cursor-pointer px-3 border-border/80"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* SIDE DETAIL PANEL (Right) */}
        {selectedDetailItem && (
          <div className="rounded-xl border border-border/60 bg-card/65 backdrop-blur-sm p-5 space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
                  {selectedDetailItem.type === "subject" ? (
                    <Folder className="h-4.5 w-4.5 text-primary" />
                  ) : (
                    getFileIcon(selectedDetailItem.fileType, "h-4.5 w-4.5")
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate" title={selectedDetailItem.name}>
                    {selectedDetailItem.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                    {selectedDetailItem.type === "subject"
                      ? "Subject Folder"
                      : selectedDetailItem.fileType || "File"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailItemId(null)}
                className="p-1 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-secondary/40 rounded-lg px-3 py-2 border border-border/30">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wide">Deleted Date</span>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {formatDate(selectedDetailItem.deletedAt)}
                </p>
              </div>

              <div className="bg-secondary/40 rounded-lg px-3 py-2 border border-border/30">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Tag className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wide">Original Subject</span>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {selectedDetailItem.originalSubjectName}
                </p>
              </div>

              <div className="bg-secondary/40 rounded-lg px-3 py-2 border border-border/30">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wide">Size</span>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {selectedDetailItem.sizeText}
                </p>
              </div>

              <div className="bg-secondary/40 rounded-lg px-3 py-2 border border-border/30">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Folder className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wide">Original Path</span>
                </div>
                <p
                  className={cn(
                    "text-xs font-semibold truncate",
                    selectedDetailItem.isLocationAvailable ? "text-foreground" : "text-amber-400"
                  )}
                  title={selectedDetailItem.originalFolderPath}
                >
                  {selectedDetailItem.originalFolderPath}
                </p>
              </div>

              {/* Retention Warning Countdown */}
              <div
                className={cn(
                  "p-3 rounded-lg border text-[11px] leading-relaxed font-medium",
                  getRetentionDaysLeft(selectedDetailItem.deletedAt) <= 3
                    ? "bg-destructive/5 border-destructive/15 text-destructive"
                    : "bg-amber-500/5 border-amber-500/15 text-amber-500"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Auto-Erasure Notice</span>
                </div>
                This item is stored securely but will be deleted permanently in{" "}
                <span className="font-bold">{getRetentionDaysLeft(selectedDetailItem.deletedAt)} days</span>.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 cursor-pointer gap-1.5"
                onClick={() => handleRestoreItem(selectedDetailItem)}
                disabled={isPending}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive cursor-pointer gap-1.5"
                onClick={() => {
                  setSelectedIds(new Set([selectedDetailItem.id]));
                  setConfirmDeleteOpen(true);
                }}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Forever
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRM PERMANENT DELETE DIALOG */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border/80 shadow-2xl p-6 rounded-2xl relative overflow-hidden">
          <DialogHeader className="gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Delete Permanently
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="my-4">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete the selected {selectedIds.size} item(s)?
              This action is <span className="font-bold text-destructive">irreversible</span> and will free up any occupied storage.
            </DialogDescription>
          </div>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={isPending}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeletePermanently}
              disabled={isPending}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/95 text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM EMPTY RECYCLE BIN DIALOG */}
      <Dialog open={confirmEmptyOpen} onOpenChange={setConfirmEmptyOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border/80 shadow-2xl p-6 rounded-2xl relative overflow-hidden">
          <DialogHeader className="gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Empty Recycle Bin
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              You are about to permanently clear all items in your recovery trash. This action will wipe all deleted subjects, folders, and documents.
            </DialogDescription>
            <div className="p-3 bg-secondary/40 border border-border/30 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Total Files to Erase:</span>
                <span className="text-foreground font-bold">{stats.fileCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Total Folders to Erase:</span>
                <span className="text-foreground font-bold">{stats.folderCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Recovered Storage:</span>
                <span className="text-foreground font-bold text-emerald-400">{stats.totalSizeText}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmEmptyOpen(false)}
              disabled={isPending}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleEmptyRecycleBin}
              disabled={isPending}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/95 text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
              )}
              Empty Recycle Bin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LOCATION RESOLUTION MODAL */}
      <Dialog open={resolutionOpen} onOpenChange={setResolutionOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border/80 shadow-2xl p-6 rounded-2xl relative overflow-hidden">
          <DialogHeader className="gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Original Location Unavailable
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="my-4 space-y-4">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              The original parent folder for <span className="font-bold text-foreground">"{resolutionItem?.name}"</span> has been permanently deleted or is in the Recycle Bin. How would you like to restore it?
            </DialogDescription>

            <div className="space-y-2.5">
              {/* Option 1: Recreate */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 hover:bg-secondary/20 transition-all cursor-pointer">
                <input
                  type="radio"
                  name="resolution"
                  value="recreate"
                  checked={resolutionOption === "recreate"}
                  onChange={() => setResolutionOption("recreate")}
                  className="mt-0.5 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FolderPlus className="h-3.5 w-3.5 text-primary" />
                    Recreate Missing Folder
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Creates a new folder with this name inside the original subject
                  </p>
                </div>
              </label>

              {resolutionOption === "recreate" && (
                <div className="pl-8 pr-2">
                  <Input
                    type="text"
                    value={recreateName}
                    onChange={(e) => setRecreateName(e.target.value)}
                    className="h-8 text-xs bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-primary rounded-lg w-full"
                    placeholder="Enter folder name..."
                  />
                </div>
              )}

              {/* Option 2: Restore to Root */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 hover:bg-secondary/20 transition-all cursor-pointer">
                <input
                  type="radio"
                  name="resolution"
                  value="root"
                  checked={resolutionOption === "root"}
                  onChange={() => setResolutionOption("root")}
                  className="mt-0.5 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    Restore To Root Subject Folder
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Restores the file directly to the main notebook list of the original subject:{" "}
                    <span className="font-semibold">{resolutionItem?.originalSubjectName || "Unclassified"}</span>
                  </p>
                </div>
              </label>

              {/* Option 3: Choose New Location */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 hover:bg-secondary/20 transition-all cursor-pointer">
                <input
                  type="radio"
                  name="resolution"
                  value="new"
                  checked={resolutionOption === "new"}
                  onChange={() => {
                    setResolutionOption("new");
                    if (activeSubjects.length > 0 && !newSubjectId) {
                      setNewSubjectId(activeSubjects[0].id);
                    }
                  }}
                  className="mt-0.5 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <div className="space-y-1 w-full">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-primary" />
                    Choose New Location
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Select any active subject notebook and folder to restore this file to
                  </p>
                </div>
              </label>

              {resolutionOption === "new" && (
                <div className="pl-8 space-y-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Select Subject</span>
                    <select
                      value={newSubjectId}
                      onChange={(e) => {
                        setNewSubjectId(e.target.value);
                        setNewFolderId("");
                      }}
                      className="w-full rounded-lg border border-border/60 bg-secondary/50 text-foreground text-xs px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                    >
                      {activeSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}{sub.code ? ` (${sub.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Select Folder (Optional)</span>
                    <select
                      value={newFolderId}
                      onChange={(e) => setNewFolderId(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-secondary/50 text-foreground text-xs px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                    >
                      <option value="">Root level (No folder)</option>
                      {foldersForSelectedSubject.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setResolutionOpen(false);
                setResolutionItem(null);
              }}
              disabled={isPending}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleResolutionSubmit}
              disabled={isPending}
              className="w-full sm:w-auto text-xs font-bold gap-1.5 cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              )}
              Restore File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
