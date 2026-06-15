"use client";

import React, { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2 } from "lucide-react";

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
import { renameSubject, moveToRecycleBin, restoreFromRecycleBin, deleteSubjectPermanently } from "@/actions/subjects";
import { renameDocument, moveDocumentToRecycleBin, restoreDocumentFromRecycleBin, deleteDocumentPermanently } from "@/actions/uploads";

import { DocumentItem, FolderItem, SubjectItem, ExplorerItemData, BreadcrumbSegment, ViewMode, RecentItem } from "@/types";
import { getPreviewUrl, buildBreadcrumbs } from "@/services/explorer";
import { useSubjectScaffold } from "@/hooks/use-subject-scaffold";

interface FileExplorerProps {
  initialSubjects: SubjectItem[];
  initialFolders: FolderItem[];
  initialDocuments: DocumentItem[];
  initialRecycledSubjects?: SubjectItem[];
  initialRecycledDocuments?: DocumentItem[];
  activeRoute: "subjects" | "uploads" | "recycle-bin";
  preFocusedSubjectId?: string | null;
}

export function FileExplorer({
  initialSubjects = [],
  initialFolders = [],
  initialDocuments = [],
  initialRecycledSubjects = [],
  initialRecycledDocuments = [],
  activeRoute,
  preFocusedSubjectId = null,
}: FileExplorerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { scaffolding, scaffoldSubject } = useSubjectScaffold();

  // Active state
  const [activeTab, setActiveTab] = useState<"subjects" | "uploads" | "assignments" | "notes" | "recycle-bin">(
    activeRoute === "recycle-bin" ? "recycle-bin" : activeRoute === "uploads" ? "uploads" : "subjects"
  );
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(preFocusedSubjectId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Settings / Toolbar state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("medium-icons");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Favorites & Recents in localStorage
  const [favorites, setFavorites] = useState<RecentItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [showQuickAccess, setShowQuickAccess] = useState(true);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [operationError, setOperationError] = useState("");

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

  // Load favorites & recents on mount
  useEffect(() => {
    const storedFavs = localStorage.getItem("neuron-explorer-favorites");
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }

    const storedRecents = localStorage.getItem("neuron-explorer-recent");
    if (storedRecents) {
      try {
        setRecentItems(JSON.parse(storedRecents));
      } catch (e) {
        console.error("Failed to parse recents", e);
      }
    }
  }, []);

  // Scaffold subfolders when entering a subject root for the first time.
  // deps: only currentSubjectId and currentFolderId — intentionally excludes initialFolders
  // (which changes reference on every revalidation) and scaffoldSubject (stable via useCallback).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentSubjectId && !currentFolderId) {
      scaffoldSubject(currentSubjectId);
    }
  }, [currentSubjectId, currentFolderId]); // ← intentional: no initialFolders, no scaffoldSubject

  // Sync route path when traversing subjects
  const navigateToRoute = useCallback((tab: typeof activeTab, subjectId: string | null, folderId: string | null) => {
    setActiveTab(tab);
    setCurrentSubjectId(subjectId);
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());

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
  }, [activeRoute, router]);

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
        fileSize: d.uploads?.file_size || 0,
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
        fileSize: d.uploads?.file_size || 0,
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
          fileSize: d.uploads?.file_size || 0,
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
          fileSize: d.uploads?.file_size || 0,
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
      return initialSubjects.map((s) => ({
        id: s.id,
        name: s.name,
        type: "subject" as const,
        color: s.color,
        code: s.code,
        createdAt: s.created_at,
        folderCount: s.folders?.length || 0,
        documentCount: s.documents?.length || 0,
        subjectId: s.id,
        parentFolderId: null,
        isFavorite: isItemFavorite(s.id, "subject"),
      }));
    }

    const folders = initialFolders
      .filter((f) => f.subject_id === currentSubjectId && f.parent_folder_id === currentFolderId)
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: "folder" as const,
        createdAt: f.created_at,
        subjectId: f.subject_id,
        parentFolderId: f.parent_folder_id,
        isFavorite: isItemFavorite(f.id, "folder"),
      }));

    const files = initialDocuments
      .filter((d) => d.subject_id === currentSubjectId && d.folder_id === currentFolderId)
      .map((d) => ({
        id: d.id,
        name: d.title,
        type: "file" as const,
        fileType: d.file_type,
        fileSize: d.uploads?.file_size || 0,
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

    return [...folders, ...files];
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
  ]);

  // Search Filter
  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (!searchQuery) return true;
      return item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
             (item.fileType && item.fileType.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [rawItems, searchQuery]);

  // Sorting
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "date") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
    const totalBytes = initialDocuments.reduce((acc, doc) => acc + (doc.uploads?.file_size || 0), 0);
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
      localStorage.setItem("neuron-explorer-recent", JSON.stringify(updated));
      return updated;
    });
  }, []);

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
      localStorage.setItem("neuron-explorer-favorites", JSON.stringify(updated));
      return updated;
    });
  }, [rawItems, currentSubjectId, currentFolderId]);

  // Open handler (Double click)
  const handleOpenItem = useCallback((item: ExplorerItemData) => {
    if (item.type === "subject") {
      navigateToRoute("subjects", item.id, null);
    } else if (item.type === "folder") {
      setCurrentFolderId(item.id);
      setSelectedIds(new Set());
    } else if (item.type === "file" && item.fileUrl) {
      const previewUrl = getPreviewUrl(item.fileUrl, item.fileType || "");
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    }
  }, [navigateToRoute]);

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
    setIsLoading(true);
    try {
      const isRecycleTab = activeTab === "recycle-bin";

      for (const id of Array.from(selectedIds)) {
        const item = rawItems.find((i) => i.id === id);
        if (!item) continue;

        if (item.type === "subject") {
          if (isRecycleTab) {
            await deleteSubjectPermanently(id);
          } else {
            await moveToRecycleBin(id);
          }
        } else if (item.type === "folder") {
          await deleteFolderAction(id);
        } else if (item.type === "file") {
          if (isRecycleTab) {
            await deleteDocumentPermanently(id);
          } else {
            await moveDocumentToRecycleBin(id);
          }
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
  }, [selectedIds, rawItems, activeTab, router]);

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
          setRenameName(selected.name);
          setIsRenameOpen(true);
        }
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
    handleCopy,
    handleCut,
    handlePaste,
    handleDeleteSelected,
    handleOpenItem,
    addRecentItem,
  ]);

  // Folder creation
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !currentSubjectId) return;

    setIsLoading(true);
    setOperationError("");
    try {
      await createFolderAction(newFolderName.trim(), currentSubjectId, currentFolderId);
      setIsNewFolderOpen(false);
      setNewFolderName("");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to create folder";
      setOperationError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Rename action
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameName.trim() || selectedIds.size !== 1) return;

    setIsLoading(true);
    setOperationError("");
    const selected = selectedItemsData[0];

    try {
      if (selected.type === "subject") {
        await renameSubject(selected.id, renameName.trim(), selected.code || "");
      } else if (selected.type === "folder") {
        await renameFolderAction(selected.id, renameName.trim());
      } else if (selected.type === "file") {
        await renameDocument(selected.id, renameName.trim());
      }
      setIsRenameOpen(false);
      setRenameName("");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to rename item";
      setOperationError(errMsg);
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
    <div className="flex flex-col h-full w-full overflow-hidden border border-border/80 bg-background rounded-xl relative select-none">
      
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
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          selectedCount={selectedIds.size}
          onNewFolder={showNewFolder ? () => setIsNewFolderOpen(true) : undefined}
          onUploadFile={showUpload ? () => setIsUploadOpen(true) : undefined}
          onRename={() => {
            setRenameName(selectedItemsData[0].name);
            setIsRenameOpen(true);
          }}
          onDelete={handleDeleteSelected}
          onProperties={selectedIds.size === 1 ? () => setIsPropertiesOpen(true) : undefined}
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
          isFavorite={selectedIds.size === 1 && isItemFavorite(selectedItemsData[0].id, selectedItemsData[0].type)}
          onToggleFavorite={selectedIds.size === 1 ? () => handleToggleFavorite(selectedItemsData[0].id, selectedItemsData[0].type) : undefined}
          onStudyWithAI={selectedIds.size === 1 && selectedItemsData[0].type === "file" ? () => router.push(`/assistant?documentId=${selectedItemsData[0].id}`) : undefined}
          onGenerateSummary={selectedIds.size === 1 && selectedItemsData[0].type === "file" ? () => router.push(`/uploads/${selectedItemsData[0].id}/summary`) : undefined}
          onGenerateQuiz={selectedIds.size === 1 && selectedItemsData[0].type === "file" ? () => router.push(`/uploads/${selectedItemsData[0].id}/quiz`) : undefined}
        />

        {/* Quick Access panel */}
        {showQuickAccess && (
          <ExplorerQuickAccess
            favorites={favorites}
            recentItems={recentItems}
            onNavigate={(item) => {
              if (item.type === "subject") {
                navigateToRoute("subjects", item.id, null);
              } else if (item.type === "folder") {
                navigateToRoute("subjects", item.subjectId, item.id);
              } else if (item.type === "file") {
                if (item.subjectId) {
                  navigateToRoute("subjects", item.subjectId, item.folderId);
                }
              }
            }}
            onRemoveFavorite={(id, type) => handleToggleFavorite(id, type)}
          />
        )}

        {/* Files Main Area — ExplorerMain self-manages flex-1 min-h-0 overflow-y-auto */}
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
            setRenameName(selectedItemsData[0].name);
            setIsRenameOpen(true);
          }}
          onToggleFavorite={(id, type) => handleToggleFavorite(id, type)}
        />

        {/* Bottom Status Bar */}
        <ExplorerStatusBar
          selectedCount={selectedIds.size}
          totalFolders={sortedItems.filter(i => i.type === "folder" || i.type === "subject").length}
          totalFiles={sortedItems.filter(i => i.type === "file").length}
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
                setRenameName(item.name);
                setIsRenameOpen(true);
              }
            },
            onDelete: handleDeleteSelected,
            onRestore: handleRestoreSelected,
            onDuplicate: async () => {
              if (selectedIds.size === 1) {
                setIsLoading(true);
                try {
                  const selected = selectedItemsData[0];
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
            // Bug fix: always wire onCreateFolder — background right-click on subject root opens modal;
            // right-click on background at top level (no subject) shows a friendly message
            onCreateFolder: currentSubjectId
              ? () => setIsNewFolderOpen(true)
              : contextMenu?.type === "background"
              ? () => { alert("Open a subject first, then right-click to create a folder inside it."); }
              : undefined,
            onUploadFile: (currentSubjectId && showUpload) ? () => setIsUploadOpen(true) : undefined,
            onDownload: () => {
              const selected = selectedItemsData[0];
              if (selected?.fileUrl) {
                window.open(selected.fileUrl, "_blank");
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
            onSetSortBy: (sort) => setSortBy(sort),
            onSetViewMode: (mode) => setViewMode(mode),
            currentSortBy: sortBy,
            currentViewMode: viewMode,
          }}
        />
      )}

      {/* New Folder Dialogue Modal */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
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
            {operationError && <p className="text-[10px] text-red-500 font-semibold">{operationError}</p>}
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

      {/* Rename Dialogue Modal */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
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
            {operationError && <p className="text-[10px] text-red-500 font-semibold">{operationError}</p>}
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
    </div>
  );
}
