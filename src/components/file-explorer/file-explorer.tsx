"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExplorerToolbar } from "./explorer-toolbar";
import { ExplorerMain } from "./explorer-main";
import { ExplorerDetails } from "./explorer-details";
import { ExplorerContextMenu } from "./explorer-context-menu";
import { ExplorerStatusBar } from "./explorer-statusbar";
import { ExplorerQuickAccess } from "./explorer-quickaccess";
import { UploadZone } from "@/components/shared/upload-zone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, FolderOpen, BookOpen } from "lucide-react";

// Server action imports
import {
  createFolderAction,
  renameFolderAction,
  deleteFolderAction,
  moveFolderAction,
  moveDocumentAction,
  duplicateDocumentAction,
  duplicateFolderAction,
  linkFilesToFolder,
} from "@/actions/folders";
import { renameSubject, moveToRecycleBin, restoreFromRecycleBin, deleteSubjectPermanently, createSubject } from "@/actions/subjects";
import { renameDocument, moveDocumentToRecycleBin, restoreDocumentFromRecycleBin, deleteDocumentPermanently, createFileAction } from "@/actions/uploads";

import { DocumentItem, FolderItem, SubjectItem, ExplorerItemData, BreadcrumbSegment, ViewMode, RecentItem, SortProperty } from "@/types";
import { getPreviewUrl, buildBreadcrumbs } from "@/services/explorer";
import { useSubjectScaffold } from "@/hooks/use-subject-scaffold";
import { UserPreferences, setClientPreferences } from "@/lib/preferences";

function getFolderStats(folderId: string, allFolders: FolderItem[], allDocuments: DocumentItem[]) {
  let folderCount = 0;
  let fileCount = 0;
  let totalSize = 0;
  
  const getDescendants = (fid: string) => {
    const subfolders = allFolders.filter(f => f.parent_folder_id === fid);
    folderCount += subfolders.length;
    
    const files = allDocuments.filter(d => d.folder_id === fid && d.deleted_at === null);
    fileCount += files.length;
    totalSize += files.reduce((sum, d) => sum + (d.size ?? d.uploads?.file_size ?? 0), 0);
    
    subfolders.forEach(sf => getDescendants(sf.id));
  };
  
  getDescendants(folderId);
  return { folderCount, fileCount, totalSize };
}

function getSubjectStats(subjectId: string, allFolders: FolderItem[], allDocuments: DocumentItem[]) {
  const folders = allFolders.filter(f => f.subject_id === subjectId);
  const files = allDocuments.filter(d => d.subject_id === subjectId && d.deleted_at === null);
  
  const folderCount = folders.filter(f => f.parent_folder_id === null).length;
  const fileCount = files.length;
  const totalSize = files.reduce((sum, d) => sum + (d.size ?? d.uploads?.file_size ?? 0), 0);
  
  return { folderCount, fileCount, totalSize };
}

function getFolderLastModified(folderId: string, createdAt: string, allFolders: FolderItem[], allDocuments: DocumentItem[]): string {
  let latestDate = new Date(createdAt).getTime();

  const checkDescendants = (fid: string) => {
    const subfolders = allFolders.filter(f => f.parent_folder_id === fid);
    subfolders.forEach(sf => {
      const sfTime = new Date(sf.created_at).getTime();
      if (sfTime > latestDate) latestDate = sfTime;
      checkDescendants(sf.id);
    });

    const files = allDocuments.filter(d => d.folder_id === fid && d.deleted_at === null);
    files.forEach(d => {
      const fileTime = new Date(d.created_at).getTime();
      if (fileTime > latestDate) latestDate = fileTime;
    });
  };

  checkDescendants(folderId);
  return new Date(latestDate).toISOString();
}

function getSubjectLastModified(subjectId: string, createdAt: string, allFolders: FolderItem[], allDocuments: DocumentItem[]): string {
  let latestDate = new Date(createdAt).getTime();
  
  const folders = allFolders.filter(f => f.subject_id === subjectId);
  folders.forEach(f => {
    const fTime = new Date(f.created_at).getTime();
    if (fTime > latestDate) latestDate = fTime;
  });

  const files = allDocuments.filter(d => d.subject_id === subjectId && d.deleted_at === null);
  files.forEach(d => {
    const fileTime = new Date(d.created_at).getTime();
    if (fileTime > latestDate) latestDate = fileTime;
  });

  return new Date(latestDate).toISOString();
}

function getFolderAiStatus(folderId: string, allFolders: FolderItem[], allDocuments: DocumentItem[]): "processed" | "processing" | "failed" | "pending" {
  const files: DocumentItem[] = [];
  const getFiles = (fid: string) => {
    files.push(...allDocuments.filter(d => d.folder_id === fid && d.deleted_at === null));
    allFolders.filter(f => f.parent_folder_id === fid).forEach(sf => getFiles(sf.id));
  };
  getFiles(folderId);

  if (files.length === 0) return "pending";
  const processedCount = files.filter(d => {
    const status = d.summary_status || d.quiz_status;
    return status === "completed" || status === "processed" || status === "generated";
  }).length;

  if (processedCount === files.length) return "processed";
  if (processedCount > 0) return "processing";
  return "pending";
}

function getSubjectAiStatus(subjectId: string, allFolders: FolderItem[], allDocuments: DocumentItem[]): "processed" | "processing" | "failed" | "pending" {
  const files = allDocuments.filter(d => d.subject_id === subjectId && d.deleted_at === null);
  if (files.length === 0) return "pending";
  const processedCount = files.filter(d => {
    const status = d.summary_status || d.quiz_status;
    return status === "completed" || status === "processed" || status === "generated";
  }).length;

  if (processedCount === files.length) return "processed";
  if (processedCount > 0) return "processing";
  return "pending";
}

function getAcademicStats(folderId: string, isSubject: boolean, allFolders: FolderItem[], allDocuments: DocumentItem[]) {
  let notesCount = 0;
  let lecturesCount = 0;
  let assignmentsCount = 0;
  let aiIndexedCount = 0;

  const files: DocumentItem[] = [];
  if (isSubject) {
    files.push(...allDocuments.filter(d => d.subject_id === folderId && d.deleted_at === null));
  } else {
    const getDescendantFiles = (fid: string) => {
      files.push(...allDocuments.filter(d => d.folder_id === fid && d.deleted_at === null));
      allFolders.filter(f => f.parent_folder_id === fid).forEach(sf => getDescendantFiles(sf.id));
    };
    getDescendantFiles(folderId);
  }

  files.forEach(d => {
    const title = d.title.toLowerCase();
    const type = (d.ai_doc_type || "").toLowerCase();
    const ext = (d.file_type || "").toLowerCase();

    if (type === "notes" || type === "note" || title.includes("note")) {
      notesCount++;
    } else if (type === "lecture" || title.includes("lecture") || title.includes("slide")) {
      lecturesCount++;
    } else if (type === "assignment" || title.includes("assignment")) {
      assignmentsCount++;
    } else if (ext === "txt" || ext === "md") {
      notesCount++;
    }

    if (d.summary_status === "completed" || d.summary_status === "processed" || d.quiz_status === "generated") {
      aiIndexedCount++;
    }
  });

  return { notesCount, lecturesCount, assignmentsCount, aiIndexedCount };
}

interface FileExplorerProps {
  initialSubjects: SubjectItem[];
  initialFolders: FolderItem[];
  initialDocuments: DocumentItem[];
  initialRecycledSubjects?: SubjectItem[];
  initialRecycledDocuments?: DocumentItem[];
  activeRoute: "subjects" | "uploads" | "recycle-bin";
  preFocusedSubjectId?: string | null;
  userId?: string;
  initialPreferences?: UserPreferences;
}

export function FileExplorer({
  initialSubjects = [],
  initialFolders = [],
  initialDocuments = [],
  initialRecycledSubjects = [],
  initialRecycledDocuments = [],
  activeRoute,
  preFocusedSubjectId = null,
  userId,
  initialPreferences,
}: FileExplorerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { scaffolding, scaffoldSubject } = useSubjectScaffold();

  // Active state
  const [activeTab, setActiveTab] = useState<"subjects" | "uploads" | "assignments" | "notes" | "recycle-bin">(
    activeRoute === "recycle-bin" ? "recycle-bin" : activeRoute === "uploads" ? "uploads" : "subjects"
  );
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(preFocusedSubjectId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const folderParam = searchParams ? searchParams.get("folder") : null;
  const [prevFolderParam, setPrevFolderParam] = useState<string | null>(null);
  if (folderParam !== prevFolderParam) {
    setPrevFolderParam(folderParam);
    if (folderParam) {
      setCurrentFolderId(folderParam);
    }
  }

  const selectParam = searchParams ? (searchParams.get("select") || searchParams.get("file")) : null;
  const [prevSelectParam, setPrevSelectParam] = useState<string | null>(null);

  // Settings / Toolbar state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(initialPreferences?.viewMode || "details");
  const [sortBy, setSortBy] = useState<SortProperty>(initialPreferences?.sortBy || "name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialPreferences?.sortOrder || "asc");

  // Selection (pre-populated with selected file if coming from Open File Location)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => (selectParam ? new Set([selectParam]) : new Set())
  );

  if (selectParam !== prevSelectParam) {
    setPrevSelectParam(selectParam);
    if (selectParam) {
      setSelectedIds(new Set([selectParam]));
    }
  }

  // Selection memory (persistence when navigating back up)
  // Use refs to track previous values — avoids setState-in-effect cascading renders
  const prevFolderIdRef = useRef<string | null>(null);
  const prevSubjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevFolderId = prevFolderIdRef.current;
    if (prevFolderId && prevFolderId !== currentFolderId) {
      const prevFolderObj = initialFolders.find(f => f.id === prevFolderId);
      if (prevFolderObj && prevFolderObj.parent_folder_id === currentFolderId) {
        setSelectedIds(new Set([prevFolderId]));
      }
    }
    prevFolderIdRef.current = currentFolderId;
  }, [currentFolderId, initialFolders]);

  useEffect(() => {
    const prevSubjectId = prevSubjectIdRef.current;
    if (prevSubjectId && prevSubjectId !== currentSubjectId && currentSubjectId === null) {
      setSelectedIds(new Set([prevSubjectId]));
    }
    prevSubjectIdRef.current = currentSubjectId;
  }, [currentSubjectId]);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "subject" | "folder" | "file" | "background";
    itemId: string | null;
  } | null>(null);

  // Clipboard (Copy/Cut/Paste)
  const [clipboard, setClipboard] = useState<{
    type: "copy" | "cut";
    ids: string[];
    types: ("subject" | "folder" | "file")[];
  } | null>(null);

  // Favorites & Recents — initialized as empty arrays to match server-side rendering and prevent hydration mismatch
  const [favorites, setFavorites] = useState<RecentItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // ── User-scoped localStorage keys ─────────────────────────────────────────
  // IMPORTANT: Always prefix with userId so that Quick Access data is NEVER
  // shared between different accounts on the same browser/device.
  const favoritesKey = userId ? `neuron-explorer-favorites-${userId}` : null;
  const recentKey    = userId ? `neuron-explorer-recent-${userId}`    : null;

  useEffect(() => {
    if (!favoritesKey || !recentKey) return; // No user, skip loading
    const loadFromLocalStorage = () => {
      try {
        const storedFavorites = localStorage.getItem(favoritesKey);
        if (storedFavorites) {
          const parsed = JSON.parse(storedFavorites) as RecentItem[];
          const filtered = parsed.filter(item => item.type !== "folder");
          setFavorites(filtered);
          if (filtered.length !== parsed.length) {
            localStorage.setItem(favoritesKey, JSON.stringify(filtered));
          }
        }
      } catch {
        // Ignored
      }
      try {
        const storedRecent = localStorage.getItem(recentKey);
        if (storedRecent) {
          const parsed = JSON.parse(storedRecent) as RecentItem[];
          const filtered = parsed.filter(item => item.type !== "folder");
          setRecentItems(filtered);
          if (filtered.length !== parsed.length) {
            localStorage.setItem(recentKey, JSON.stringify(filtered));
          }
        }
      } catch {
        // Ignored
      }
    };
    
    // Run asynchronously in the next frame to avoid synchronous state-updates in effect warning
    const handle = requestAnimationFrame(loadFromLocalStorage);
    return () => cancelAnimationFrame(handle);
  }, [favoritesKey, recentKey]);
  const [showQuickAccess, setShowQuickAccess] = useState(
    initialPreferences?.showQuickAccess !== undefined ? initialPreferences.showQuickAccess : true
  );

  // Preview pane toggle (persisted in preferences)
  const [showPreview, setShowPreview] = useState(
    (initialPreferences as any)?.showPreview !== undefined ? (initialPreferences as any).showPreview : false
  );

  // Quick Access stale-item notification (shown when user clicks a deleted/missing item)
  const [quickAccessNotification, setQuickAccessNotification] = useState<string | null>(null);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createFolderError, setCreateFolderError] = useState("");
  const [renameFolderError, setRenameFolderError] = useState("");
  const [renameFileError, setRenameFileError] = useState("");
  const [createSubjectError, setCreateSubjectError] = useState("");
  const [renameSubjectError, setRenameSubjectError] = useState("");

  // Delete dialog state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // New File dialog state
  const [isNewFileOpen, setIsNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState("txt");
  const [createFileError, setCreateFileError] = useState("");

  // Optimistic UI updates
  const [optimisticItems, setOptimisticItems] = useState<ExplorerItemData[]>([]);

  // ── Background task status tracking ────────────────────────────────────────
  // Lightweight type — only the fields we need for status badges
  type SlimTask = {
    id: string;
    document_id: string;
    status: string; // e.g. "Queued" | "Downloading File" | ... | "Completed" | "Failed"
    progress: { stages?: Record<string, { status: string; errorMessage?: string }> } | null;
    doc_title: string;
  };

  const [backgroundTasks, setBackgroundTasks] = useState<SlimTask[]>([]);
  const [supabaseClient] = useState(() => createClient());
  const taskPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track previous task statuses to detect completions and trigger a folder refresh
  const prevTaskStatusesRef = useRef<Record<string, string>>({});

  const fetchBackgroundTasks = useCallback(async () => {
    if (!userId) return;
    const client = supabaseClient;
    const { data: taskData } = await client
      .from("background_tasks")
      .select("id, document_id, status, progress")
      .eq("user_id", userId)
      .eq("task_type", "study_pack")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!taskData || taskData.length === 0) {
      setBackgroundTasks([]);
      return;
    }

    const docIds = [...new Set(taskData.map((t: any) => t.document_id).filter(Boolean))];
    const titleMap: Record<string, string> = {};
    if (docIds.length > 0) {
      const { data: docData } = await client
        .from("documents")
        .select("id, title")
        .in("id", docIds);
      if (docData) {
        docData.forEach((d: any) => { titleMap[d.id] = d.title; });
      }
    }

    const shaped: SlimTask[] = taskData
      .filter((t: any) => t.document_id && titleMap[t.document_id])
      .map((t: any) => ({ ...t, doc_title: titleMap[t.document_id] }));

    setBackgroundTasks(shaped);

    // Detect any task that just transitioned to completed or failed → refresh folders
    const prev = prevTaskStatusesRef.current;
    let needsRefresh = false;
    const DONE_STATUSES = new Set(["completed", "Completed", "failed", "Failed"]);
    const ACTIVE_STATUSES = new Set([
      "processing", "pending",
      "Queued", "Downloading File", "Extracting Text", "Cleaning Text",
      "Validating Text", "Saving Text",
      "Chunking Content", "Generating Summary", "Generating Key Points",
      "Generating Flashcards", "Generating Quiz", "Creating PDFs", "Saving Results"
    ]);
    for (const task of shaped) {
      const wasActive = ACTIVE_STATUSES.has(prev[task.id] ?? "");
      const isDone = DONE_STATUSES.has(task.status);
      if (wasActive && isDone) { needsRefresh = true; }
    }
    // Update previous statuses
    const next: Record<string, string> = {};
    for (const task of shaped) { next[task.id] = task.status; }
    prevTaskStatusesRef.current = next;
    if (needsRefresh) {
      startTransition(() => router.refresh());
    }

    // Stop polling if no active tasks remain
    const hasActive = shaped.some(t => ACTIVE_STATUSES.has(t.status));
    if (!hasActive && taskPollRef.current) {
      clearInterval(taskPollRef.current);
      taskPollRef.current = null;
    }
  }, [userId, supabaseClient, router]);


  useEffect(() => {
    if (!userId) return;
    const client = supabaseClient;
    const handle = setTimeout(() => fetchBackgroundTasks(), 0);

    const channel = client
      .channel(`file-explorer-tasks-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "background_tasks", filter: `user_id=eq.${userId}` },
        () => { fetchBackgroundTasks(); }
      )
      .subscribe();

    // Start polling; fetchBackgroundTasks will clear it when tasks are done
    taskPollRef.current = setInterval(() => fetchBackgroundTasks(), 3000);

    return () => {
      clearTimeout(handle);
      client.removeChannel(channel);
      if (taskPollRef.current) clearInterval(taskPollRef.current);
    };
  }, [userId, supabaseClient, fetchBackgroundTasks]);

  // Compute a map from doc_title (lowercased, no extension) → task status info
  const taskStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; stage: string; errorMessage: string | null }>();
    const DONE_STATUSES = new Set(["completed", "Completed", "failed", "Failed"]);

    for (const task of backgroundTasks) {
      if (!task.doc_title) continue;
      // Normalize doc_title: strip extension and collapse spaces/underscores
      const rawTitle = task.doc_title.replace(/\.[^/.]+$/, "").toLowerCase().trim();
      const normalizedKey = rawTitle.replace(/[_\s]+/g, " ");

      // Since backgroundTasks are ordered created_at DESC, newest task takes precedence
      if (map.has(rawTitle) || map.has(normalizedKey)) continue;

      const stages = task.progress?.stages;

      // Use the detailed status string directly as the stage label
      let stage = task.status;
      if (stage === "pending" || stage === "Queued") stage = "Queued";
      else if (stage === "completed" || stage === "Completed") stage = "Ready";
      else if (stage === "failed" || stage === "Failed") stage = "Failed";
      // For all other pipeline states (e.g. "Generating Summary"), use as-is

      // Collect the deepest error message
      let errorMessage: string | null = null;
      if (DONE_STATUSES.has(task.status) && stages) {
        for (const s of Object.values(stages)) {
          if ((s as any).errorMessage) errorMessage = (s as any).errorMessage;
        }
      }

      const info = { status: task.status, stage, errorMessage };
      map.set(rawTitle, info);
      map.set(normalizedKey, info);
    }
    return map;
  }, [backgroundTasks]);

  // Build a set of folder ids that are AI Generated ROOT folders (depth=0 under subject)
  // and a set of category folder ids (depth=1 under AI Generated)
  // This allows us to detect a "document subfolder" (depth=2) during folder mapping.
  const aiGeneratedRootIds = useMemo(() => {
    return new Set(
      initialFolders
        .filter(f => f.parent_folder_id === null && f.name.trim().toLowerCase() === "ai generated")
        .map(f => f.id)
    );
  }, [initialFolders]);

  const aiCategoryFolderIds = useMemo(() => {
    return new Set(
      initialFolders
        .filter(f => f.parent_folder_id !== null && aiGeneratedRootIds.has(f.parent_folder_id))
        .map(f => f.id)
    );
  }, [initialFolders, aiGeneratedRootIds]);

  // New Subject dialog state
  const [isNewSubjectOpen, setIsNewSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#F4C542");
  // Enhancement states
  const [subjectCreationStep, setSubjectCreationStep] = useState<"idle" | "loading" | "success">("idle");
  const [isColorManuallySelected, setIsColorManuallySelected] = useState(false);
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);

  // Modal state reset is handled inline in onOpenChange (see Dialog below)

  // Keyword → color suggestions (standardized to Windows Folder Color)
  const getSuggestedColor = (_name: string): string => {
    return "#F4C542";
  };

  // Generate course code from name
  const getSuggestedCode = (name: string): string => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    let prefix = "";
    if (words.length === 1) {
      prefix = words[0].substring(0, 4).toUpperCase();
    } else {
      prefix = words
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .substring(0, 4);
    }
    const level = words.length > 2 ? "301" : "201";
    return `${prefix}-${level}`;
  };

  // Handlers for name changes (auto-suggest color + code)
  const handleSubjectNameChange = (val: string) => {
    setNewSubjectName(val);
    if (!isColorManuallySelected && val.trim()) {
      setNewSubjectColor(getSuggestedColor(val));
    }
    if (!isCodeManuallyEdited && val.trim()) {
      setNewSubjectCode(getSuggestedCode(val));
    } else if (!val.trim() && !isCodeManuallyEdited) {
      setNewSubjectCode("");
    }
  };

  // Default folders list (for preview – does NOT change folder generation)
  const DEFAULT_SUBJECT_FOLDERS = [
    "Lectures", "Assignments", "Quizzes", "AI Generated",
  ];

  // Render-time state adjustments for optimistic items
  const [prevInitialDocs, setPrevInitialDocs] = useState(initialDocuments);
  if (initialDocuments !== prevInitialDocs) {
    setPrevInitialDocs(initialDocuments);
    setOptimisticItems((prev) =>
      prev.filter((opt) => {
        if (opt.type === "file") {
          return !initialDocuments.some(
            (d) =>
              d.title === opt.name &&
              d.subject_id === opt.subjectId &&
              d.folder_id === opt.parentFolderId
          );
        }
        return true;
      })
    );
  }

  // Sync activeTab when route changes (during render to avoid cascading useEffect renders)
  const [prevActiveRoute, setPrevActiveRoute] = useState(activeRoute);
  const [prevPreFocusedSubjectId, setPrevPreFocusedSubjectId] = useState(preFocusedSubjectId);

  if (activeRoute !== prevActiveRoute || preFocusedSubjectId !== prevPreFocusedSubjectId) {
    setPrevActiveRoute(activeRoute);
    setPrevPreFocusedSubjectId(preFocusedSubjectId);
    setActiveTab(activeRoute === "recycle-bin" ? "recycle-bin" : activeRoute === "uploads" ? "uploads" : "subjects");
    setCurrentSubjectId(preFocusedSubjectId);
    setCurrentFolderId(null);
    setSelectedIds(new Set());
  }


  // Save preferences immediately when they change
  useEffect(() => {
    if (userId) {
      setClientPreferences(userId, {
        viewMode,
        sortBy,
        sortOrder,
        showQuickAccess,
        ...({ showPreview } as any),
      });
    }
  }, [userId, viewMode, sortBy, sortOrder, showQuickAccess, showPreview]);

  // Scaffold subfolders when entering a subject root for the first time.
  // deps: only currentSubjectId and currentFolderId — intentionally excludes initialFolders
  // (which changes reference on every revalidation) and scaffoldSubject (stable via useCallback).
  useEffect(() => {
    if (currentSubjectId && !currentFolderId) {
      scaffoldSubject(currentSubjectId);
    }
  }, [currentSubjectId, currentFolderId, scaffoldSubject]);

  // Navigation History Stack
  const [historyStack, setHistoryStack] = useState<{ tab: typeof activeTab; subjectId: string | null; folderId: string | null }[]>(() => [
    { tab: activeRoute === "recycle-bin" ? "recycle-bin" : activeRoute === "uploads" ? "uploads" : "subjects", subjectId: preFocusedSubjectId, folderId: null }
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Sync route path when traversing subjects
  const navigateToRoute = useCallback((tab: typeof activeTab, subjectId: string | null, folderId: string | null, isHistoryNav = false) => {
    setActiveTab(tab);
    setCurrentSubjectId(subjectId);
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());

    if (!isHistoryNav) {
      setHistoryStack((prev) => {
        const nextStack = prev.slice(0, historyIndex + 1);
        nextStack.push({ tab, subjectId, folderId });
        return nextStack;
      });
      setHistoryIndex((prevIdx) => prevIdx + 1);
    }

    if (tab === "recycle-bin" && activeRoute !== "recycle-bin") {
      router.push("/recycle-bin");
    } else if (tab === "uploads" && activeRoute !== "uploads") {
      router.push("/uploads");
    } else if (tab === "subjects") {
      if (subjectId && activeRoute !== "subjects") {
        router.push(`/subjects/${subjectId}`);
      } else if (!subjectId && activeRoute !== "subjects") {
        router.push("/subjects");
      }
    }
  }, [activeRoute, router, historyIndex]);

  const handleGoBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      const prevState = historyStack[prevIdx];
      if (prevState) {
        navigateToRoute(prevState.tab, prevState.subjectId, prevState.folderId, true);
      }
    }
  }, [historyIndex, historyStack, navigateToRoute]);

  const handleGoForward = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      const nextState = historyStack[nextIdx];
      if (nextState) {
        navigateToRoute(nextState.tab, nextState.subjectId, nextState.folderId, true);
      }
    }
  }, [historyIndex, historyStack, navigateToRoute]);

  const handleGoUp = useCallback(() => {
    if (currentFolderId) {
      const currentFolder = initialFolders.find(f => f.id === currentFolderId);
      const parentFolderId = currentFolder ? currentFolder.parent_folder_id : null;
      navigateToRoute(activeTab, currentSubjectId, parentFolderId);
    } else if (currentSubjectId) {
      navigateToRoute("subjects", null, null);
    }
  }, [currentFolderId, currentSubjectId, activeTab, initialFolders, navigateToRoute]);

  const activeSubject = initialSubjects.find((s) => s.id === currentSubjectId);

  // Helper to check if item is favorited
  const isItemFavorite = useCallback((itemId: string, itemType: string) => {
    return favorites.some((f) => f.id === itemId && f.type === itemType);
  }, [favorites]);

  // Compute Items in the Current View (Memoized)
  const rawItems = useMemo((): ExplorerItemData[] => {
    const isRecycled = activeTab === "recycle-bin";

    if (isRecycled) {
      const subjects = initialRecycledSubjects.map((s) => ({
        id: s.id,
        name: s.name,
        type: "subject" as const,
        color: s.color,
        code: s.code,
        createdAt: s.deleted_at || s.created_at,
        folderCount: s.folders?.length || 0,
        documentCount: s.documents?.length || 0,
        subjectId: s.id,
        parentFolderId: null,
        isFavorite: isItemFavorite(s.id, "subject"),
      }));

      const files = initialRecycledDocuments.map((d) => ({
        id: d.id,
        name: d.title,
        type: "file" as const,
        fileType: d.file_type,
        fileSize: d.size !== undefined && d.size !== null ? d.size : (d.uploads?.file_size || 0),
        createdAt: d.deleted_at || d.created_at,
        summaryStatus: d.summary_status,
        quizStatus: d.quiz_status,
        aiSubject: d.ai_subject,
        aiTopic: d.ai_topic,
        fileUrl: d.file_url,
        subjectId: d.subject_id,
        parentFolderId: d.folder_id,
        isFavorite: isItemFavorite(d.id, "file"),
      }));

      return [...subjects, ...files];
    }

    if (activeTab === "uploads") {
      return initialDocuments.map((d) => ({
        id: d.id,
        name: d.title,
        type: "file" as const,
        fileType: d.file_type,
        fileSize: d.size !== undefined && d.size !== null ? d.size : (d.uploads?.file_size || 0),
        createdAt: d.created_at,
        summaryStatus: d.summary_status,
        quizStatus: d.quiz_status,
        aiSubject: d.ai_subject,
        aiTopic: d.ai_topic,
        fileUrl: d.file_url,
        subjectId: d.subject_id,
        parentFolderId: d.folder_id,
        isFavorite: isItemFavorite(d.id, "file"),
      }));
    }

    if (activeTab === "assignments") {
      return initialDocuments
        .filter((d) => (d.ai_doc_type || "").toLowerCase() === "assignment" || d.title.toLowerCase().includes("assignment"))
        .map((d) => ({
          id: d.id,
          name: d.title,
          type: "file" as const,
          fileType: d.file_type,
          fileSize: d.size !== undefined && d.size !== null ? d.size : (d.uploads?.file_size || 0),
          createdAt: d.created_at,
          summaryStatus: d.summary_status,
          quizStatus: d.quiz_status,
          aiSubject: d.ai_subject,
          aiTopic: d.ai_topic,
          fileUrl: d.file_url,
          subjectId: d.subject_id,
          parentFolderId: d.folder_id,
          isFavorite: isItemFavorite(d.id, "file"),
        }));
    }

    if (activeTab === "notes") {
      return initialDocuments
        .filter((d) => ["notes", "note"].includes((d.ai_doc_type || "").toLowerCase()) || d.title.toLowerCase().includes("note"))
        .map((d) => ({
          id: d.id,
          name: d.title,
          type: "file" as const,
          fileType: d.file_type,
          fileSize: d.size !== undefined && d.size !== null ? d.size : (d.uploads?.file_size || 0),
          createdAt: d.created_at,
          summaryStatus: d.summary_status,
          quizStatus: d.quiz_status,
          aiSubject: d.ai_subject,
          aiTopic: d.ai_topic,
          fileUrl: d.file_url,
          subjectId: d.subject_id,
          parentFolderId: d.folder_id,
          isFavorite: isItemFavorite(d.id, "file"),
        }));
    }

    if (!currentSubjectId) {
      return initialSubjects.map((s) => {
        const stats = getSubjectStats(s.id, initialFolders, initialDocuments);
        const lastMod = getSubjectLastModified(s.id, s.created_at, initialFolders, initialDocuments);
        const aiStatus = getSubjectAiStatus(s.id, initialFolders, initialDocuments);
        const academic = getAcademicStats(s.id, true, initialFolders, initialDocuments);
        return {
          id: s.id,
          name: s.name,
          type: "subject" as const,
          color: s.color,
          code: s.code,
          createdAt: s.created_at,
          modifiedAt: lastMod,
          folderCount: stats.folderCount,
          documentCount: stats.fileCount,
          fileSize: stats.totalSize,
          aiStatus: aiStatus,
          academicStats: academic,
          subjectId: s.id,
          parentFolderId: null,
          isFavorite: isItemFavorite(s.id, "subject"),
        };
      });
    }

    const folders = initialFolders
      .filter((f) => f.subject_id === currentSubjectId && f.parent_folder_id === currentFolderId)
      .map((f) => {
        const stats = getFolderStats(f.id, initialFolders, initialDocuments);
        const lastMod = getFolderLastModified(f.id, f.created_at, initialFolders, initialDocuments);
        const aiStatus = getFolderAiStatus(f.id, initialFolders, initialDocuments);
        const academic = getAcademicStats(f.id, false, initialFolders, initialDocuments);

        // Attach task status if this folder is a document-level subfolder under AI Generated/Category
        let taskStatus: ExplorerItemData["taskStatus"] = null;
        let taskStage: string | null = null;
        let taskErrorMessage: string | null = null;
        if (f.parent_folder_id && aiCategoryFolderIds.has(f.parent_folder_id)) {
          const rawKey = f.name.toLowerCase().trim();
          const normKey = rawKey.replace(/[_\s]+/g, " ");
          const taskInfo = taskStatusMap.get(rawKey) || taskStatusMap.get(normKey);

          // If the folder already has generated documents or is processed, it is complete and NOT queued/ready
          const isCompleted = stats.fileCount > 0 || aiStatus === "processed";

          if (taskInfo && !isCompleted) {
            // Completed tasks don't need a status badge on folders
            if (taskInfo.status !== "completed" && taskInfo.status !== "Completed") {
              taskStatus = taskInfo.status;
              taskStage = taskInfo.stage;
              taskErrorMessage = taskInfo.errorMessage;
            }
          }
        }

        return {
          id: f.id,
          name: f.name,
          type: "folder" as const,
          createdAt: f.created_at,
          modifiedAt: lastMod,
          folderCount: stats.folderCount,
          documentCount: stats.fileCount,
          fileSize: stats.totalSize,
          aiStatus: aiStatus,
          academicStats: academic,
          subjectId: f.subject_id,
          parentFolderId: f.parent_folder_id,
          isFavorite: isItemFavorite(f.id, "folder"),
          taskStatus,
          taskStage,
          taskErrorMessage,
        };
      })
      .filter((f) => {
        // Hide document-level subfolders under AI Generated if they have 0 active files and no active task
        if (f.parentFolderId && aiCategoryFolderIds.has(f.parentFolderId)) {
          if (f.documentCount === 0 && f.folderCount === 0 && !f.taskStatus) {
            return false;
          }
        }
        return true;
      });

    const files = initialDocuments
      .filter((d) => d.subject_id === currentSubjectId && d.folder_id === currentFolderId)
      .map((d) => ({
        id: d.id,
        name: d.title,
        type: "file" as const,
        fileType: d.file_type,
        fileSize: d.size !== undefined && d.size !== null ? d.size : (d.uploads?.file_size || 0),
        createdAt: d.created_at,
        modifiedAt: d.created_at,
        summaryStatus: d.summary_status,
        quizStatus: d.quiz_status,
        aiSubject: d.ai_subject,
        aiTopic: d.ai_topic,
        fileUrl: d.file_url,
        subjectId: d.subject_id,
        parentFolderId: d.folder_id,
        isFavorite: isItemFavorite(d.id, "file"),
      }));

    const currentOptimistic = optimisticItems.filter(
      (item) =>
        item.subjectId === currentSubjectId &&
        item.parentFolderId === currentFolderId
    );

    return [...folders, ...files, ...currentOptimistic];
  }, [
    activeTab,
    currentSubjectId,
    currentFolderId,
    initialSubjects,
    initialFolders,
    initialDocuments,
    initialRecycledSubjects,
    initialRecycledDocuments,
    isItemFavorite,
    optimisticItems,
    taskStatusMap,
    aiCategoryFolderIds,
  ]);

  // Search Filter
  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const nameMatches = item.name.toLowerCase().includes(query);
      const codeMatches = item.code?.toLowerCase().includes(query) || false;
      const typeMatches = item.fileType?.toLowerCase().includes(query) || false;

      let contentMatches = false;
      if (item.type === "file") {
        const doc = initialDocuments.find((d) => d.id === item.id);
        if (doc && doc.content) {
          contentMatches = doc.content.toLowerCase().includes(query);
        }
      }

      return nameMatches || codeMatches || typeMatches || contentMatches;
    });
  }, [rawItems, searchQuery, initialDocuments]);

  // Sorting
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "dateModified") {
        const dateA = new Date(a.modifiedAt || a.createdAt).getTime();
        const dateB = new Date(b.modifiedAt || b.createdAt).getTime();
        comparison = dateA - dateB;
      } else if (sortBy === "dateCreated") {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        comparison = dateA - dateB;
      } else if (sortBy === "size") {
        const sizeA = a.fileSize || 0;
        const sizeB = b.fileSize || 0;
        comparison = sizeA - sizeB;
      } else if (sortBy === "type") {
        const typeA = a.type === "file" ? (a.fileType || "") : a.type;
        const typeB = b.type === "file" ? (b.fileType || "") : b.type;
        comparison = typeA.localeCompare(typeB);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredItems, sortBy, sortOrder]);

  const selectedItemsData = useMemo(() => {
    return sortedItems.filter((item) => selectedIds.has(item.id));
  }, [sortedItems, selectedIds]);

  const totalStorageUsedMB = useMemo(() => {
    const totalBytes = initialDocuments.reduce((acc, doc) => acc + (doc.size ?? doc.uploads?.file_size ?? 0), 0);
    return totalBytes / (1024 * 1024);
  }, [initialDocuments]);

  // Breadcrumbs
  const getBreadcrumbs = (): BreadcrumbSegment[] => {
    return buildBreadcrumbs(activeTab, currentSubjectId, currentFolderId, activeSubject?.name, initialFolders);
  };

  // Add Recent Item
  const addRecentItem = useCallback((item: { id: string; name: string; type: "subject" | "folder" | "file"; subjectId: string | null; folderId: string | null }) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((r) => !(r.id === item.id && r.type === item.type));
      const newItem: RecentItem = {
        ...item,
        openedAt: new Date().toISOString(),
      };
      const updated = [newItem, ...filtered].slice(0, 20);
      if (recentKey) localStorage.setItem(recentKey, JSON.stringify(updated));
      return updated;
    });
  }, [recentKey]);

  // Toggle Favorite
  const handleToggleFavorite = useCallback((itemId: string, itemType: "subject" | "folder" | "file") => {
    const item = rawItems.find((i) => i.id === itemId);
    if (!item) return;

    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === itemId && f.type === itemType);
      let updated: RecentItem[];
      if (exists) {
        updated = prev.filter((f) => !(f.id === itemId && f.type === itemType));
      } else {
        const newItem: RecentItem = {
          id: item.id,
          name: item.name,
          type: itemType,
          subjectId: item.subjectId || currentSubjectId,
          folderId: item.type === "folder" ? item.id : (item.parentFolderId || currentFolderId),
          openedAt: new Date().toISOString(),
        };
        updated = [newItem, ...prev].slice(0, 12);
      }
      if (favoritesKey) localStorage.setItem(favoritesKey, JSON.stringify(updated));
      return updated;
    });
  }, [rawItems, currentSubjectId, currentFolderId, favoritesKey]);

  // Remove a specific item from Quick Access (favorites + recents)
  const handleRemoveFromQuickAccess = useCallback((itemId: string, itemType: "subject" | "folder" | "file") => {
    setFavorites((prev) => {
      const updated = prev.filter((f) => !(f.id === itemId && f.type === itemType));
      if (favoritesKey) localStorage.setItem(favoritesKey, JSON.stringify(updated));
      return updated;
    });
    setRecentItems((prev) => {
      const updated = prev.filter((r) => !(r.id === itemId && r.type === itemType));
      if (recentKey) localStorage.setItem(recentKey, JSON.stringify(updated));
      return updated;
    });
  }, [favoritesKey, recentKey]);

  // Open handler (Double click)
  const handleOpenItem = useCallback((item: ExplorerItemData) => {
    if (item.type === "subject") {
      navigateToRoute("subjects", item.id, null);
    } else if (item.type === "folder") {
      navigateToRoute(activeTab, currentSubjectId, item.id);
    } else if (item.type === "file") {
      const ext = (item.fileType || "").toLowerCase();
      if (["txt", "md", "note", "docx"].includes(ext)) {
        addRecentItem({
          id: item.id,
          name: item.name,
          type: "file",
          subjectId: item.subjectId || currentSubjectId,
          folderId: item.parentFolderId || currentFolderId,
        });
        const currentFolder = item.parentFolderId || currentFolderId;
        const fromUrl = window.location.pathname + (currentFolder ? `?folder=${currentFolder}` : "");
        router.push(`/editor/${item.id}?from=${encodeURIComponent(fromUrl)}`);
      } else {
        const previewUrl = getPreviewUrl(item.fileUrl || null, item.fileType || null);
        window.open(previewUrl, "_blank", "noopener,noreferrer");
      }
    }
  }, [navigateToRoute, addRecentItem, router, currentSubjectId, currentFolderId, activeTab]);

  // Right click trigger
  const handleContextMenu = useCallback((e: React.MouseEvent, item: ExplorerItemData | null) => {
    e.preventDefault();
    if (item) {
      if (!selectedIds.has(item.id)) {
        setSelectedIds(new Set([item.id]));
      }
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: item.type,
        itemId: item.id,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: "background",
        itemId: null,
      });
    }
  }, [selectedIds]);

  // Move operations
  const handleMoveItem = useCallback(async (
    itemId: string,
    itemType: "folder" | "file",
    targetSubjectId: string,
    targetFolderId: string | null
  ) => {
    setIsLoading(true);
    try {
      if (itemType === "file") {
        await moveDocumentAction(itemId, targetSubjectId || null, targetFolderId);
      } else if (itemType === "folder") {
        await moveFolderAction(itemId, targetSubjectId, targetFolderId);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Delete / Soft Delete handler
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsDeleteOpen(true);
  }, [selectedIds]);

  // Execute deletion (soft or permanent)
  const executeDelete = useCallback(async (permanently: boolean) => {
    setIsDeleteOpen(false);
    setIsLoading(true);
    try {
      const isRecycleTab = activeTab === "recycle-bin";

      for (const id of Array.from(selectedIds)) {
        const item = rawItems.find((i) => i.id === id);
        if (!item) continue;

        if (item.type === "subject") {
          if (permanently || isRecycleTab) {
            await deleteSubjectPermanently(id);
          } else {
            await moveToRecycleBin(id);
          }
        } else if (item.type === "folder") {
          await deleteFolderAction(id);
        } else if (item.type === "file") {
          if (permanently || isRecycleTab) {
            await deleteDocumentPermanently(id);
          } else {
            await moveDocumentToRecycleBin(id);
          }
        }
      }

      // Clean up favorites and recentItems from deleted items
      const deletedSubjectIds = rawItems
        .filter(item => selectedIds.has(item.id) && item.type === "subject")
        .map(item => item.id);
      
      const deletedFolderIds = rawItems
        .filter(item => selectedIds.has(item.id) && item.type === "folder")
        .map(item => item.id);

      const getAllDescendantFolderIds = (folderIds: string[]): string[] => {
        const descendants: string[] = [];
        const queue = [...folderIds];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const children = initialFolders.filter(f => f.parent_folder_id === currentId);
          for (const child of children) {
            if (!descendants.includes(child.id)) {
              descendants.push(child.id);
              queue.push(child.id);
            }
          }
        }
        return descendants;
      };

      const allDeletedFolderIds = [
        ...deletedFolderIds,
        ...getAllDescendantFolderIds(deletedFolderIds)
      ];

      const shouldRemoveItem = (favOrRec: RecentItem) => {
        if (selectedIds.has(favOrRec.id)) return true;
        if (favOrRec.subjectId && deletedSubjectIds.includes(favOrRec.subjectId)) return true;
        if (favOrRec.folderId && allDeletedFolderIds.includes(favOrRec.folderId)) return true;
        if (allDeletedFolderIds.includes(favOrRec.id)) return true;
        return false;
      };

      setFavorites((prev) => {
        const updated = prev.filter((item) => !shouldRemoveItem(item));
        if (favoritesKey) localStorage.setItem(favoritesKey, JSON.stringify(updated));
        return updated;
      });

      setRecentItems((prev) => {
        const updated = prev.filter((item) => !shouldRemoveItem(item));
        if (recentKey) localStorage.setItem(recentKey, JSON.stringify(updated));
        return updated;
      });

      setSelectedIds(new Set());
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds, rawItems, activeTab, router, initialFolders, favoritesKey, recentKey]);

  // Restore handler for Recycle Bin
  const handleRestoreSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsLoading(true);
    try {
      for (const id of Array.from(selectedIds)) {
        const item = rawItems.find((i) => i.id === id);
        if (!item) continue;

        if (item.type === "subject") {
          await restoreFromRecycleBin(id);
        } else if (item.type === "file") {
          await restoreDocumentFromRecycleBin(id);
        }
      }
      setSelectedIds(new Set());
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedIds, rawItems, router]);

  // Clipboard commands
  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const types = Array.from(selectedIds).map(id => rawItems.find(i => i.id === id)?.type).filter(Boolean) as ("subject" | "folder" | "file")[];
    setClipboard({ type: "copy", ids: Array.from(selectedIds), types });
  }, [selectedIds, rawItems]);

  const handleCut = useCallback(() => {
    if (selectedIds.size === 0) return;
    const types = Array.from(selectedIds).map(id => rawItems.find(i => i.id === id)?.type).filter(Boolean) as ("subject" | "folder" | "file")[];
    setClipboard({ type: "cut", ids: Array.from(selectedIds), types });
  }, [selectedIds, rawItems]);

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    setIsLoading(true);
    try {
      const targetSubject = currentSubjectId;
      const targetFolder = currentFolderId;

      if (!targetSubject && activeTab === "subjects") {
        setIsLoading(false);
        return;
      }

      for (let i = 0; i < clipboard.ids.length; i++) {
        const id = clipboard.ids[i];
        const type = clipboard.types[i];

        if (clipboard.type === "cut") {
          if (type === "file") {
            await moveDocumentAction(id, targetSubject, targetFolder);
          } else if (type === "folder") {
            await moveFolderAction(id, targetSubject || "", targetFolder);
          }
        } else {
          if (type === "file") {
            await duplicateDocumentAction(id);
          } else if (type === "folder") {
            await duplicateFolderAction(id);
          }
        }
      }

      if (clipboard.type === "cut") {
        setClipboard(null);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Paste failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [clipboard, currentSubjectId, currentFolderId, activeTab, router]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
        return;
      }

      // Ctrl + A
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const allIds = new Set(sortedItems.map(item => item.id));
        setSelectedIds(allIds);
      }

      // Escape
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedIds(new Set());
      }

      // Ctrl + C (Copy)
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedIds.size > 0) {
        e.preventDefault();
        handleCopy();
      }

      // Ctrl + X (Cut)
      if ((e.ctrlKey || e.metaKey) && e.key === "x" && selectedIds.size > 0) {
        e.preventDefault();
        handleCut();
      }

      // Ctrl + V (Paste)
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboard) {
        e.preventDefault();
        handlePaste();
      }

      // F2 (Rename)
      if (e.key === "F2" && selectedIds.size === 1) {
        e.preventDefault();
        const selected = selectedItemsData[0];
        if (selected) {
          setRenameFileError("");
          setRenameFolderError("");
          setRenameSubjectError("");
          setRenameName(selected.name);
          setIsRenameOpen(true);
        }
      }

      // Alt + Left (Back)
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        if (historyIndex > 0) handleGoBack();
      }

      // Alt + Right (Forward)
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        if (historyIndex < historyStack.length - 1) handleGoForward();
      }

      // Alt + Enter (Properties)
      if (e.altKey && e.key === "Enter" && selectedIds.size === 1) {
        e.preventDefault();
        setIsPropertiesOpen(true);
      }

      // Delete
      if (e.key === "Delete" && selectedIds.size > 0) {
        e.preventDefault();
        await handleDeleteSelected();
      }

      // Enter
      if (e.key === "Enter" && selectedIds.size === 1) {
        e.preventDefault();
        const selected = selectedItemsData[0];
        if (selected) {
          handleOpenItem(selected);
          addRecentItem({
            id: selected.id,
            name: selected.name,
            type: selected.type,
            subjectId: selected.subjectId || currentSubjectId,
            folderId: selected.type === "folder" ? selected.id : (selected.parentFolderId || currentFolderId),
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    sortedItems,
    selectedIds,
    clipboard,
    selectedItemsData,
    currentSubjectId,
    currentFolderId,
    historyIndex,
    historyStack,
    handleGoBack,
    handleGoForward,
    handleCopy,
    handleCut,
    handlePaste,
    handleDeleteSelected,
    handleOpenItem,
    addRecentItem,
  ]);

  // Subject creation
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    setSubjectCreationStep("loading");
    setCreateSubjectError("");
    try {
      await createSubject(newSubjectName.trim(), newSubjectCode.trim(), newSubjectColor);
      setSubjectCreationStep("success");
      // Brief success flash then close
      setTimeout(() => {
        setIsNewSubjectOpen(false);
        setNewSubjectName("");
        setNewSubjectCode("");
        setNewSubjectColor("#F4C542");
        setSubjectCreationStep("idle");
        startTransition(() => {
          router.refresh();
        });
      }, 900);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to create subject";
      setCreateSubjectError(errMsg);
      setSubjectCreationStep("idle");
    }
  };

  // Folder creation
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newFolderName.trim();
    if (!trimmedName || !currentSubjectId) return;

    // Client-side uniqueness check
    const exists = initialFolders.some(
      (f) =>
        f.subject_id === currentSubjectId &&
        f.parent_folder_id === currentFolderId &&
        f.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      setCreateFolderError(`A folder named '${trimmedName}' already exists in this location. Please choose a different folder name.`);
      return;
    }

    setIsLoading(true);
    setCreateFolderError("");
    try {
      await createFolderAction(trimmedName, currentSubjectId, currentFolderId);
      setIsNewFolderOpen(false);
      setNewFolderName("");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to create folder";
      setCreateFolderError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // File creation
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newFileName.trim();
    if (!trimmedName) {
      setCreateFileError("Please enter a file name.");
      return;
    }

    if (!currentSubjectId) return;

    const ext = newFileType;
    const fullName = trimmedName.endsWith(`.${ext}`) ? trimmedName : `${trimmedName}.${ext}`;

    // Client-side uniqueness check
    const exists = initialDocuments.some(
      (d) =>
        d.subject_id === currentSubjectId &&
        d.folder_id === currentFolderId &&
        d.title.trim().toLowerCase() === fullName.toLowerCase() &&
        d.deleted_at === null
    );

    if (exists) {
      setCreateFileError("A file with this name already exists in this folder.");
      return;
    }

    // Optimistic UI update
    const tempId = crypto.randomUUID();
    const newFileItem: ExplorerItemData = {
      id: tempId,
      name: fullName,
      type: "file",
      fileType: ext,
      fileSize: 0,
      createdAt: new Date().toISOString(),
      summaryStatus: "none",
      quizStatus: "none",
      fileUrl: "",
      subjectId: currentSubjectId,
      parentFolderId: currentFolderId,
      isFavorite: false,
    };
    setOptimisticItems((prev) => [...prev, newFileItem]);
    setIsNewFileOpen(false);
    setNewFileName("");
    setNewFileType("txt");

    setIsLoading(true);
    setCreateFileError("");
    try {
      await createFileAction(trimmedName, ext, currentSubjectId, currentFolderId);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to create file";
      setOptimisticItems((prev) => prev.filter((item) => item.id !== tempId));
      setCreateFileError(errMsg);
      setIsNewFileOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Rename action
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = renameName.trim();
    if (!trimmedName || selectedIds.size !== 1) return;

    const selected = selectedItemsData[0];
    if (!selected) {
      setIsLoading(false);
      return;
    }

    try {
      if (selected.type === "subject") {
        setRenameSubjectError("");
        // Client-side uniqueness check for subject rename
        const exists = initialSubjects.some(
          (s) =>
            s.id !== selected.id &&
            s.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (exists) {
          setRenameSubjectError("A subject with this name already exists.");
          setIsLoading(false);
          return;
        }
        await renameSubject(selected.id, trimmedName, selected.code || "");
      } else if (selected.type === "folder") {
        setRenameFolderError("");
        // Client-side uniqueness check for folder rename
        const exists = initialFolders.some(
          (f) =>
            f.id !== selected.id &&
            f.subject_id === currentSubjectId &&
            f.parent_folder_id === currentFolderId &&
            f.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (exists) {
          setRenameFolderError("A folder with this name already exists in this location.");
          setIsLoading(false);
          return;
        }
        await renameFolderAction(selected.id, trimmedName);
      } else if (selected.type === "file") {
        setRenameFileError("");
        const originalName = selected.name;
        const lastDotIndex = originalName.lastIndexOf(".");
        const originalExt = lastDotIndex !== -1 ? originalName.slice(lastDotIndex + 1) : "";

        let finalName = trimmedName;
        if (originalExt && trimmedName.lastIndexOf(".") === -1) {
          finalName = `${trimmedName}.${originalExt}`;
        }

        // Client-side uniqueness check for file rename
        const exists = initialDocuments.some(
          (d) =>
            d.id !== selected.id &&
            d.subject_id === selected.subjectId &&
            d.folder_id === selected.parentFolderId &&
            d.title.trim().toLowerCase() === finalName.toLowerCase()
        );
        if (exists) {
          setRenameFileError("A file with this name already exists in this location.");
          setIsLoading(false);
          return;
        }
        await renameDocument(selected.id, finalName);
      }
      setIsRenameOpen(false);
      setRenameName("");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to rename item";
      if (selected.type === "subject") {
        setRenameSubjectError(errMsg);
      } else if (selected.type === "folder") {
        setRenameFolderError(errMsg);
      } else if (selected.type === "file") {
        setRenameFileError(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // Render variables
  const showNewFolder = activeTab === "subjects" && currentSubjectId !== null;
  const showUpload = activeTab === "subjects" && currentSubjectId !== null;

  return (
    <div className="win-explorer flex flex-col h-full w-full overflow-hidden bg-background relative select-none">
      
      {/* Loading Overlay */}
      {(isLoading || isPending || scaffolding) && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-xs flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Main content area — flex column fills full height */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Fixed: Ribbon toolbar (address bar + ribbon actions) */}
        <ExplorerToolbar
          segments={getBreadcrumbs()}
          onNavigate={(subId, foldId) => navigateToRoute(activeTab, subId, foldId)}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < historyStack.length - 1}
          canGoUp={currentSubjectId !== null}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onGoUp={handleGoUp}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedCount={selectedIds.size}
          onNewFolder={showNewFolder ? () => {
            setCreateFolderError("");
            setIsNewFolderOpen(true);
          } : undefined}
          onNewFile={showNewFolder ? () => {
            setCreateFileError("");
            setIsNewFileOpen(true);
          } : undefined}
          onNewSubject={activeTab === "subjects" && !currentSubjectId ? () => {
            setCreateSubjectError("");
            setIsNewSubjectOpen(true);
          } : undefined}
          onUploadFile={showUpload ? () => setIsUploadOpen(true) : undefined}
          onRename={selectedIds.size === 1 && selectedItemsData[0] ? () => {
            setRenameFileError("");
            setRenameFolderError("");
            setRenameSubjectError("");
            setRenameName(selectedItemsData[0].name);
            setIsRenameOpen(true);
          } : undefined}
          onDelete={handleDeleteSelected}
          onProperties={selectedIds.size === 1 && selectedItemsData[0] ? () => setIsPropertiesOpen(true) : undefined}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          canCreateFolder={!!showNewFolder}
          canUpload={!!showUpload || activeTab === "uploads"}
          onRefresh={handleRefresh}
          isRefreshing={isPending}
          showQuickAccess={showQuickAccess}
          setShowQuickAccess={setShowQuickAccess}
          showPreview={showPreview}
          setShowPreview={setShowPreview}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          hasClipboard={clipboard !== null}
          isFavorite={selectedIds.size === 1 && selectedItemsData[0] ? isItemFavorite(selectedItemsData[0].id, selectedItemsData[0].type) : false}
          onToggleFavorite={selectedIds.size === 1 && selectedItemsData[0] ? () => handleToggleFavorite(selectedItemsData[0].id, selectedItemsData[0].type) : undefined}
          onStudyWithAI={selectedIds.size === 1 && selectedItemsData[0]?.type === "file" ? () => router.push(`/assistant?documentId=${selectedItemsData[0].id}`) : undefined}
          onGenerateSummary={selectedIds.size === 1 && selectedItemsData[0]?.type === "file" ? () => router.push(`/uploads/${selectedItemsData[0].id}/summary`) : undefined}
          onGenerateQuiz={selectedIds.size === 1 && selectedItemsData[0]?.type === "file" ? () => router.push(`/uploads/${selectedItemsData[0].id}/quiz`) : undefined}
        />

        {/* Quick Access panel */}
        {showQuickAccess && (
          <ExplorerQuickAccess
            favorites={favorites}
            recentItems={recentItems}
            onNavigate={(item) => {
              // Validate item still exists before navigating
              if (item.type === "subject") {
                const exists = initialSubjects.some((s) => s.id === item.id);
                if (!exists) {
                  setQuickAccessNotification(`"${item.name}" was not found — it may have been deleted or moved.`);
                  setTimeout(() => setQuickAccessNotification(null), 4000);
                  handleRemoveFromQuickAccess(item.id, item.type);
                  return;
                }
                navigateToRoute("subjects", item.id, null);
              } else if (item.type === "folder") {
                const exists = initialFolders.some((f) => f.id === item.id);
                if (!exists) {
                  setQuickAccessNotification(`"${item.name}" was not found — it may have been deleted or moved.`);
                  setTimeout(() => setQuickAccessNotification(null), 4000);
                  handleRemoveFromQuickAccess(item.id, item.type);
                  return;
                }
                navigateToRoute("subjects", item.subjectId, item.id);
              } else if (item.type === "file") {
                if (item.subjectId) {
                  navigateToRoute("subjects", item.subjectId, item.folderId);
                }
              }
            }}
            onRemoveFavorite={(id, type) => handleToggleFavorite(id, type)}
            onRemoveItem={(id, type) => handleRemoveFromQuickAccess(id, type)}
          />
        )}

        {/* Quick Access stale-item notification banner */}
        {quickAccessNotification && (
          <div className="shrink-0 mx-4 mt-1.5 mb-0.5 flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-medium animate-in fade-in slide-in-from-top-1 duration-200">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span className="flex-1">{quickAccessNotification}</span>
            <button
              onClick={() => setQuickAccessNotification(null)}
              className="ml-1 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Subject Header — shown when inside a subject */}
        {currentSubjectId && activeSubject && (
          <div className="shrink-0 px-4 py-2.5 border-b border-border/30 bg-card/40 flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: activeSubject.color || "#F4C542" }}
            >
              {activeSubject.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate leading-tight">{activeSubject.name}</h2>
              <p className="text-[10px] text-muted-foreground/70 truncate">
                Manage lectures, notes, assignments, quizzes and AI-generated resources.
              </p>
            </div>
          </div>
        )}

        {/* Main Row: Files + Properties Sidebar */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">


          {/* Files Main Area */}
          <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <ExplorerMain
            items={sortedItems}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onOpen={(item) => {
              handleOpenItem(item);
              addRecentItem({
                id: item.id,
                name: item.name,
                type: item.type,
                subjectId: item.subjectId || currentSubjectId,
                folderId: item.type === "folder" ? item.id : (item.parentFolderId || currentFolderId),
              });
            }}
            onContextMenu={handleContextMenu}
            viewMode={viewMode}
            onMoveItem={handleMoveItem}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            onDelete={handleDeleteSelected}
            onRename={() => {
              const selected = selectedItemsData[0];
              if (!selected) return;
              setRenameFileError("");
              setRenameFolderError("");
              setRenameSubjectError("");
              setRenameName(selected.name);
              setIsRenameOpen(true);
            }}
            onToggleFavorite={(id, type) => handleToggleFavorite(id, type)}
          />

          {/* Right-side Properties Sidebar — controlled by Preview toggle */}
          <div className={showPreview ? "block" : "hidden"}>
            <ExplorerDetails
              selectedItems={selectedItemsData}
              isModalMode={false}
              onGenerateSummary={(id) => router.push(`/uploads/${id}/summary`)}
              onGenerateQuiz={(id) => router.push(`/uploads/${id}/quiz`)}
              onStudyWithAI={(id) => router.push(`/assistant?documentId=${id}`)}
            />
          </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <ExplorerStatusBar
          selectedCount={selectedIds.size}
          totalFolders={sortedItems.filter(i => i.type === "folder").length}
          totalFiles={sortedItems.filter(i => i.type === "file").length}
          totalSubjects={sortedItems.filter(i => i.type === "subject").length}
          dbSubjectsCount={initialSubjects.length}
          dbFoldersCount={initialFolders.length}
          dbFilesCount={initialDocuments.length}
          storageUsedMB={totalStorageUsedMB}
          currentSubjectName={activeSubject?.name || null}
        />
      </div>

      {/* Properties Modal (Dialog replaces Sheet Drawer) */}
      <Dialog open={isPropertiesOpen} onOpenChange={setIsPropertiesOpen}>
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Properties</DialogTitle>
          </DialogHeader>
          <ExplorerDetails
            selectedItems={selectedItemsData}
            isModalMode={true}
            onClose={() => setIsPropertiesOpen(false)}
            onGenerateSummary={(id) => {
              router.push(`/uploads/${id}/summary`);
              setIsPropertiesOpen(false);
            }}
            onGenerateQuiz={(id) => {
              router.push(`/uploads/${id}/quiz`);
              setIsPropertiesOpen(false);
            }}
            onStudyWithAI={(id) => {
              router.push(`/assistant?documentId=${id}`);
              setIsPropertiesOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Context Menu overlay */}
      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          isRecycled={activeTab === "recycle-bin"}
          isFavorite={contextMenu.itemId !== null && isItemFavorite(contextMenu.itemId, contextMenu.type)}
          hasClipboard={clipboard !== null}
          /** Root level = subjects tab + no subject currently open */
          isRootLevel={activeTab === "subjects" && !currentSubjectId}
          onClose={() => setContextMenu(null)}
          actions={{
            onOpen: () => {
              const item = rawItems.find((i) => i.id === contextMenu.itemId);
              if (item) handleOpenItem(item);
            },
            onOpenNewTab: () => {
              const item = rawItems.find((i) => i.id === contextMenu.itemId);
              if (item && item.type === "subject") {
                window.open(`/subjects/${item.id}`, "_blank", "noopener,noreferrer");
              }
            },
            onRename: () => {
              const item = rawItems.find((i) => i.id === contextMenu.itemId);
              if (item) {
                setRenameFileError("");
                setRenameFolderError("");
                setRenameSubjectError("");
                setRenameName(item.name);
                setIsRenameOpen(true);
              }
            },
            onDelete: handleDeleteSelected,
            onRestore: handleRestoreSelected,
            onDuplicate: async () => {
              if (selectedIds.size === 1) {
                const selected = selectedItemsData[0];
                if (!selected) return;
                setIsLoading(true);
                try {
                  if (selected.type === "file") {
                    await duplicateDocumentAction(selected.id);
                  } else if (selected.type === "folder") {
                    await duplicateFolderAction(selected.id);
                  }
                  startTransition(() => {
                    router.refresh();
                  });
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsLoading(false);
                }
              }
            },
            // Only show Create Folder when inside a subject
            onCreateFolder: currentSubjectId ? () => {
              setCreateFolderError("");
              setIsNewFolderOpen(true);
            } : undefined,
            onCreateFile: currentSubjectId ? () => {
              setCreateFileError("");
              setIsNewFileOpen(true);
            } : undefined,
            // Show Create Subject when at root level
            onCreateSubject: !currentSubjectId && activeTab === "subjects" ? () => {
              setCreateSubjectError("");
              setIsNewSubjectOpen(true);
            } : undefined,
            onUploadFile: (currentSubjectId && showUpload) ? () => setIsUploadOpen(true) : undefined,
            onDownload: () => {
              const selected = selectedItemsData[0];
              if (selected?.fileUrl) {
                window.open(selected.fileUrl, "_blank");
              }
            },
            onGenerateStudyPack: () => {
              const selected = selectedItemsData[0];
              if (selected?.fileUrl) {
                const ext = selected.fileType || selected.name.split(".").pop()?.toLowerCase() || "unknown";
                fetch("/api/generate-study-pack", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    documentId: selected.id,
                    fileUrl: selected.fileUrl,
                    fileType: ext,
                  }),
                }).then(() => {
                  router.refresh();
                }).catch((err) => {
                  console.warn("Failed to manually trigger study pack generation", err);
                });
              }
            },
            onGenerateSummary: () => {

              const selected = selectedItemsData[0];
              if (selected) {
                router.push(`/uploads/${selected.id}/summary`);
              }
            },
            onGenerateQuiz: () => {
              const selected = selectedItemsData[0];
              if (selected) {
                router.push(`/uploads/${selected.id}/quiz`);
              }
            },
            onGenerateNotes: () => {
              const selected = selectedItemsData[0];
              if (selected) {
                router.push(`/assistant?documentId=${selected.id}&action=notes`);
              }
            },
            onGenerateFlashcards: () => {
              const selected = selectedItemsData[0];
              if (selected) {
                router.push(`/assistant?documentId=${selected.id}&action=flashcards`);
              }
            },
            onStudyWithAI: () => {
              const selected = selectedItemsData[0];
              if (selected) {
                router.push(`/assistant?documentId=${selected.id}`);
              }
            },
            onAddToRevision: () => {
              const selected = selectedItemsData[0];
              if (selected) {
                router.push(`/assistant?documentId=${selected.id}&action=revision`);
              }
            },
            onToggleFavorite: () => {
              if (contextMenu.itemId && contextMenu.type !== "background") {
                handleToggleFavorite(contextMenu.itemId, contextMenu.type);
              }
            },
            onProperties: () => setIsPropertiesOpen(true),
            onCopy: handleCopy,
            onCut: handleCut,
            onPaste: handlePaste,
            onRefresh: handleRefresh,
            onSetSortBy: (sort) => setSortBy(sort),
            onSetViewMode: (mode) => setViewMode(mode),
            currentSortBy: sortBy,
            currentViewMode: viewMode,
          }}
        />
      )}

      {/* New Folder Dialogue Modal */}
      <Dialog open={isNewFolderOpen} onOpenChange={(open) => { setIsNewFolderOpen(open); if (!open) { setCreateFolderError(""); } }}>
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Create New Folder</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter a name to create a folder under the current path.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="flex flex-col gap-4 mt-2">
            <Input
              type="text"
              placeholder="Folder Name (e.g. Lectures)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              maxLength={50}
              autoFocus
              className="text-xs"
            />
            {createFolderError && <p className="text-[10px] text-red-500 font-semibold">{createFolderError}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsNewFolderOpen(false)} className="text-xs h-8 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={!newFolderName.trim()} className="text-xs h-8 cursor-pointer min-w-[100px]">
                Create Folder
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create New File Dialogue Modal */}
      <Dialog open={isNewFileOpen} onOpenChange={(open) => { setIsNewFileOpen(open); if (!open) { setCreateFileError(""); } }}>
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Create New File</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter a name and type to create a file under the current path.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFile} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">File Name</label>
              <Input
                type="text"
                placeholder="Enter file name"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                maxLength={50}
                autoFocus
                className="text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">File Type</label>
              <select
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border/60 bg-card px-3 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-primary cursor-pointer"
              >
                <option value="txt">Text Document (.txt)</option>
                <option value="md">Markdown (.md)</option>
                <option value="note">Notes File (.note)</option>
                <option value="docx">Study Draft (.docx)</option>
              </select>
            </div>
            {createFileError && <p className="text-[10px] text-red-500 font-semibold">{createFileError}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsNewFileOpen(false)} className="text-xs h-8 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={!newFileName.trim()} className="text-xs h-8 cursor-pointer min-w-[100px]">
                Create File
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Subject Dialogue Modal */}
      <Dialog open={isNewSubjectOpen} onOpenChange={(open) => { if (subjectCreationStep !== "loading") { setIsNewSubjectOpen(open); if (!open) { setCreateSubjectError(""); setSubjectCreationStep("idle"); setIsColorManuallySelected(false); setIsCodeManuallyEdited(false); } } }}>
        <DialogContent className="sm:max-w-2xl bg-card/98 border border-border/60 shadow-2xl backdrop-blur-xl p-0 overflow-hidden">
          {/* Modal header */}
          <div
            className="relative px-6 pt-6 pb-4"
            style={{ background: `linear-gradient(135deg, ${newSubjectColor}18 0%, transparent 60%)` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300"
                style={{ backgroundColor: newSubjectColor }}
              >
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground leading-tight">Create New Subject</DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                  Fill in the details — folders will be created automatically.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <form onSubmit={handleCreateSubject}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                {/* ── LEFT COLUMN: Form ── */}
                <div className="flex flex-col gap-4">
                  {/* Subject Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      Subject Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Advanced Mathematics"
                      value={newSubjectName}
                      onChange={(e) => handleSubjectNameChange(e.target.value)}
                      maxLength={60}
                      autoFocus
                      disabled={subjectCreationStep !== "idle"}
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Course Code */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      Course Code
                      <span className="font-normal normal-case tracking-normal opacity-60">(auto-suggested)</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. MATH-301"
                      value={newSubjectCode}
                      onChange={(e) => { setNewSubjectCode(e.target.value); setIsCodeManuallyEdited(true); }}
                      maxLength={20}
                      disabled={subjectCreationStep !== "idle"}
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Color picker */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      Subject Colour
                      {!isColorManuallySelected && newSubjectName.trim() && (
                        <span className="font-normal normal-case tracking-normal opacity-60">(auto-suggested)</span>
                      )}
                    </label>
                    {/* Swatches */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Default Explorer Color Swatch */}
                      <button
                        key="#F4C542"
                        type="button"
                        disabled={subjectCreationStep !== "idle"}
                        onClick={() => { setNewSubjectColor("#F4C542"); setIsColorManuallySelected(true); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-all duration-200 hover:scale-105 focus:outline-none cursor-pointer"
                        style={{
                          borderColor: newSubjectColor === "#F4C542" ? "#F4C542" : "var(--border)",
                          backgroundColor: newSubjectColor === "#F4C542" ? "#F4C54215" : "transparent",
                          boxShadow: newSubjectColor === "#F4C542" ? "0 0 8px #F4C54244" : "none",
                        }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#F4C542" }} />
                        <span style={{ color: newSubjectColor === "#F4C542" ? "#F4C542" : "var(--muted-foreground)" }}>Default Explorer Color</span>
                        {newSubjectColor === "#F4C542" && <Check className="w-2.5 h-2.5 ml-0.5" style={{ color: "#F4C542" }} />}
                      </button>

                      {/* Custom colors in recommended order */}
                      {["#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ef4444", "#ec4899", "#06b6d4"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          disabled={subjectCreationStep !== "idle"}
                          onClick={() => { setNewSubjectColor(c); setIsColorManuallySelected(true); }}
                          className="h-6 w-6 rounded-full border-2 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: c,
                            borderColor: newSubjectColor === c ? "white" : "transparent",
                            boxShadow: newSubjectColor === c ? `0 0 0 2px ${c}, 0 0 10px ${c}88` : "none",
                          }}
                          title={
                            c === "#3b82f6" ? "Blue" :
                            c === "#8b5cf6" ? "Purple" :
                            c === "#22c55e" ? "Green" :
                            c === "#f97316" ? "Orange" :
                            c === "#ef4444" ? "Red" :
                            c === "#ec4899" ? "Pink" : "Cyan"
                          }
                        >
                          {newSubjectColor === c && <Check className="w-3 h-3 text-white mx-auto" />}
                        </button>
                      ))}
                      {/* Custom color input */}
                      <input
                        type="color"
                        value={newSubjectColor}
                        disabled={subjectCreationStep !== "idle"}
                        onChange={(e) => { setNewSubjectColor(e.target.value); setIsColorManuallySelected(true); }}
                        className="h-6 w-6 cursor-pointer rounded-full border-2 border-border/60 bg-transparent p-0 overflow-hidden"
                        title="Custom color"
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {createSubjectError && (
                    <p className="text-[10px] text-red-500 font-semibold bg-red-500/10 px-2 py-1.5 rounded-md border border-red-500/20">
                      {createSubjectError}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-auto pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={subjectCreationStep !== "idle"}
                      onClick={() => { setIsNewSubjectOpen(false); setCreateSubjectError(""); }}
                      className="text-xs h-8 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!newSubjectName.trim() || subjectCreationStep !== "idle"}
                      className="text-xs h-8 cursor-pointer min-w-[140px] transition-all duration-200"
                      style={
                        subjectCreationStep === "success"
                          ? { backgroundColor: "#22c55e", borderColor: "#22c55e" }
                          : newSubjectName.trim()
                          ? { backgroundColor: newSubjectColor, borderColor: newSubjectColor }
                          : {}
                      }
                    >
                      {subjectCreationStep === "loading" && (
                        <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Creating…</>
                      )}
                      {subjectCreationStep === "success" && (
                        <><Check className="w-3 h-3 mr-1.5" />Subject Created!</>
                      )}
                      {subjectCreationStep === "idle" && "Create Subject"}
                    </Button>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Live Preview ── */}
                <div className="flex flex-col gap-3">
                  {/* Preview label */}
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Live Preview</span>

                  {/* Subject card preview */}
                  <div
                    className="rounded-xl border border-border/40 overflow-hidden shadow-md transition-all duration-300"
                    style={{ background: `linear-gradient(135deg, ${newSubjectColor}22 0%, ${newSubjectColor}08 100%)` }}
                  >
                    {/* Colour accent bar */}
                    <div className="h-1.5 w-full" style={{ backgroundColor: newSubjectColor }} />
                    <div className="p-3.5 flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-300"
                        style={{ backgroundColor: newSubjectColor }}
                      >
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="font-semibold text-sm leading-tight truncate transition-all duration-200"
                          style={{ color: newSubjectColor }}
                        >
                          {newSubjectName.trim() || "Subject Name"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          {newSubjectCode || "COURSE-000"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: newSubjectColor }}
                          >
                            {DEFAULT_SUBJECT_FOLDERS.length} folders
                          </span>
                          <span className="text-[9px] text-muted-foreground">will be created</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Folder structure preview */}
                  <div className="rounded-lg border border-border/30 bg-background/50 p-2.5 flex flex-col gap-1.5">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" /> Auto-created folders
                    </span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-0.5">
                      {DEFAULT_SUBJECT_FOLDERS.map((folder) => (
                        <div key={folder} className="flex items-center gap-1">
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: newSubjectColor }}
                          />
                          <span className="text-[10px] text-muted-foreground truncate">{folder}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>


      {/* Rename Dialogue Modal */}
      <Dialog open={isRenameOpen} onOpenChange={(open) => { setIsRenameOpen(open); if (!open) { setRenameFileError(""); setRenameFolderError(""); setRenameSubjectError(""); } }}>
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Rename Item</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter a new name for this file or folder.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4 mt-2">
            <Input
              type="text"
              placeholder="Name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              maxLength={100}
              autoFocus
              className="text-xs"
            />
            {selectedItemsData[0]?.type === "subject" && renameSubjectError && (
              <p className="text-[10px] text-red-500 font-semibold">{renameSubjectError}</p>
            )}
            {selectedItemsData[0]?.type === "folder" && renameFolderError && (
              <p className="text-[10px] text-red-500 font-semibold">{renameFolderError}</p>
            )}
            {selectedItemsData[0]?.type === "file" && renameFileError && (
              <p className="text-[10px] text-red-500 font-semibold">{renameFileError}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsRenameOpen(false)} className="text-xs h-8 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={!renameName.trim() || renameName.trim() === selectedItemsData[0]?.name} className="text-xs h-8 cursor-pointer min-w-[100px]">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialogue Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Upload Files</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Upload your study documents, quizzes, or assignments. They will be auto-linked to this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <UploadZone
              subjectId={currentSubjectId || undefined}
              folderId={currentFolderId || undefined}
              currentSubjectId={currentSubjectId || undefined}
              onUploadComplete={async (docId) => {
                if (currentSubjectId) {
                  await linkFilesToFolder([docId], currentSubjectId, currentFolderId);
                }
                setIsUploadOpen(false);
                startTransition(() => {
                  router.refresh();
                });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Delete {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {activeTab === "recycle-bin"
                ? "Are you sure you want to permanently delete these items? This action cannot be undone."
                : "Choose whether to move the selected items to the Recycle Bin or delete them permanently."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            {activeTab !== "recycle-bin" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => executeDelete(false)}
                  className="w-full text-xs font-semibold justify-start h-10 px-4 gap-2 hover:bg-accent cursor-pointer rounded-lg border-border"
                >
                  ♻️ Move to Recycle Bin
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => executeDelete(true)}
                  className="w-full text-xs font-semibold justify-start h-10 px-4 gap-2 bg-red-600 hover:bg-red-700 text-white cursor-pointer rounded-lg"
                >
                  🗑️ Delete Permanently
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => executeDelete(true)}
                className="w-full text-xs font-semibold h-10 gap-2 bg-red-600 hover:bg-red-700 text-white cursor-pointer rounded-lg"
              >
                🗑️ Delete Permanently
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setIsDeleteOpen(false)}
              className="w-full text-xs font-semibold h-10 hover:bg-accent cursor-pointer rounded-lg mt-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
