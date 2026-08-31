"use client";

import React, { useRef, useCallback, memo, useState } from "react";
import { FileIcon } from "./explorer-icons";
import { ExplorerItemData, ViewMode, SortProperty } from "@/types/explorer";
import { Calendar, ChevronUp, ChevronDown, Star, FolderOpen, AlertTriangle, CheckCircle2, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Folder Status Badge ───────────────────────────────────────────────────────────────────
const FolderStatusBadge = memo(function FolderStatusBadge({ item }: { item: ExplorerItemData }) {
  const [showError, setShowError] = useState(false);
  const { taskStatus, taskStage, taskErrorMessage, aiStatus, documentCount } = item;
  if (!taskStatus) return null;

  // Completed / Ready states or already processed items do not need a persistent badge
  if (
    taskStatus === "completed" ||
    taskStatus === "Completed" ||
    taskStatus === "Ready" ||
    aiStatus === "processed" ||
    ((documentCount ?? 0) > 0 && (taskStatus === "pending" || taskStatus === "Queued"))
  ) {
    return null;
  }

  if (taskStatus === "failed" || taskStatus === "Failed") {
    return (
      <span className="relative inline-flex items-center gap-1 shrink-0">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50">
          <AlertTriangle className="h-3 w-3" />
          Failed
        </span>
        {taskErrorMessage && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowError(v => !v); }}
            className="text-[10px] text-red-500 hover:text-red-700 underline shrink-0 ml-0.5"
          >
            Details
          </button>
        )}
        {showError && taskErrorMessage && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-6 z-50 w-72 rounded-lg border border-red-200 bg-white dark:bg-[#1e1e1e] dark:border-red-900/50 shadow-lg p-3 text-[11px] text-[#1f1f1f] dark:text-[#e8e8e8]"
          >
            <p className="font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Processing Failed
            </p>
            <p className="text-muted-foreground leading-relaxed break-words">{taskErrorMessage}</p>
            <button
              onClick={() => setShowError(false)}
              className="mt-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}
      </span>
    );
  }

  if (taskStatus === "pending" || taskStatus === "Queued") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/50 shrink-0">
        <Clock className="h-3 w-3" />
        Queued
      </span>
    );
  }

  // processing / any active pipeline stage — show the current stage label with a pulsing dot
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50 shrink-0 max-w-[160px]">
      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
      <span className="truncate">{taskStage || taskStatus}…</span>
    </span>
  );
});


interface ExplorerMainProps {
  items: ExplorerItemData[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onOpen: (item: ExplorerItemData) => void;
  onContextMenu: (e: React.MouseEvent, item: ExplorerItemData | null) => void;
  viewMode: ViewMode;
  onMoveItem: (itemId: string, itemType: "folder" | "file", targetSubjectId: string, targetFolderId: string | null) => void;
  sortBy?: SortProperty;
  setSortBy?: (sort: SortProperty) => void;
  sortOrder?: "asc" | "desc";
  setSortOrder?: (order: "asc" | "desc") => void;
  onDelete?: () => void;
  onRename?: () => void;
  onToggleFavorite?: (itemId: string, itemType: "subject" | "folder" | "file") => void;
}

import { formatFileSize, formatExplorerItemSize } from "@/services/storage/file-metadata";

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatSize = formatFileSize;

const formatDate = (dateString: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateString));
  } catch {
    return dateString;
  }
};

const getAiStatus = (item: ExplorerItemData) => {
  if (item.type !== "file") return item.aiStatus || null;
  const status = item.summaryStatus || item.aiStatus;
  if (status === "completed" || status === "processed") return "processed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  return "pending";
};

const _renderAiStatusBadge = (item: ExplorerItemData) => {
  const status = getAiStatus(item);
  
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fef3c7] text-[#d97706] border border-[#fde68a]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d97706] animate-pulse" />
        AI Indexing
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
        Failed
      </span>
    );
  }

  if (status === "processed") {
    const isQuizAvailable = item.quizStatus === "generated" || item.quizStatus === "completed";
    if (isQuizAvailable && item.type === "file") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#dbeafe] text-[#2563eb] border border-[#bfdbfe]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
          Quiz Available
        </span>
      );
    }
    const isNotes = item.fileType === "notes" || item.fileType === "note" || item.name.toLowerCase().includes("note");
    if (isNotes && item.type === "file") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f3e8ff] text-[#7c3aed] border border-[#e9d5ff]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed]" />
          AI Notes Available
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#d1fae5] text-[#059669] border border-[#a7f3d0]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
        AI Ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#4b5563]" />
      {item.type !== "file" ? "Pending AI" : "Not Processed"}
    </span>
  );
};

const renderAcademicIndicators = (item: ExplorerItemData) => {
  if (item.type !== "subject" && item.type !== "folder") return null;
  if (!item.academicStats) return null;
  const { notesCount, lecturesCount, assignmentsCount, aiIndexedCount } = item.academicStats;

  if (notesCount === 0 && lecturesCount === 0 && assignmentsCount === 0 && aiIndexedCount === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px] text-muted-foreground/80">
      {notesCount > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-secondary/30 px-1 py-0.25 rounded border border-border/10" title={`${notesCount} Notes`}>
          <span>📄</span>
          <span>{notesCount} Notes</span>
        </span>
      )}
      {lecturesCount > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-secondary/30 px-1 py-0.25 rounded border border-border/10" title={`${lecturesCount} Lectures`}>
          <span>🎓</span>
          <span>{lecturesCount} Lectures</span>
        </span>
      )}
      {assignmentsCount > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-secondary/30 px-1 py-0.25 rounded border border-border/10" title={`${assignmentsCount} Assignments`}>
          <span>📝</span>
          <span>{assignmentsCount} Assignments</span>
        </span>
      )}
      {aiIndexedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1 py-0.25 rounded border border-purple-500/20 font-semibold" title={`${aiIndexedCount} AI Indexed`}>
          <span>🧠</span>
          <span>AI Indexed</span>
        </span>
      )}
    </div>
  );
};



const Checkbox = memo(function Checkbox({
  checked,
  indeterminate,
  onChange,
  className
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "h-[14px] w-[14px] rounded border-[#a0a0a0] dark:border-[#555555] bg-white dark:bg-[#2d2d2d] focus:ring-0 focus:ring-offset-0 accent-[#0067c0] dark:accent-[#60cdff] cursor-pointer",
        className
      )}
    />
  );
});

// ── Windows 11 Folder Card (Medium Icons) ─────────────────────────────────────
const FolderCard = memo(function FolderCard({
  item,
  isSelected,
  onItemClick,
  onItemDblClick,
  onItemContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleFavorite,
  onCheckboxChange,
}: {
  item: ExplorerItemData;
  isSelected: boolean;
  onItemClick: (e: React.MouseEvent) => void;
  onItemDblClick: () => void;
  onItemContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onToggleFavorite?: () => void;
  onCheckboxChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isFolder = item.type === "folder" || item.type === "subject";
  const status = getAiStatus(item);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onItemClick}
      onDoubleClick={onItemDblClick}
      onContextMenu={onItemContextMenu}
      className={cn(
        "group relative flex items-center gap-2.5 p-2 rounded-lg border transition-colors duration-[120ms] cursor-pointer select-none",
        isSelected
          ? "bg-[#cce8ff] dark:bg-[#1a3f6f]/60 border-transparent"
          : "bg-transparent border-transparent hover:bg-[#f0f0f0] dark:hover:bg-white/[0.05]"
      )}
    >
      {onCheckboxChange && (
        <Checkbox
          checked={isSelected}
          onChange={onCheckboxChange}
          className={cn(
            "absolute top-1.5 left-1.5 z-20 transition-opacity duration-75 opacity-0 group-hover:opacity-100",
            isSelected && "!opacity-100"
          )}
        />
      )}

      {/* ── Icon ── */}
      <div className={cn(
        "relative h-9 w-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
        isFolder
          ? "bg-gradient-to-br from-amber-400/20 via-orange-300/10 to-transparent border border-amber-400/25"
          : "bg-secondary/60 border border-border/30"
      )}>
        {/* Subject color dot */}
        {item.type === "subject" && item.color && (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
        )}
        <FileIcon
          type={item.type === "file" ? (item.fileType || "") : item.type}
          className={cn("h-[25px] w-[25px]", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
          color={item.color}
        />
        {/* AI status dot */}
        {item.type === "file" && status && (
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-background border border-border/60 flex items-center justify-center">
            <div className={cn("h-1.5 w-1.5 rounded-full",
              status === "processed" && "bg-emerald-400",
              status === "processing" && "bg-amber-400 animate-pulse",
              status === "failed" && "bg-red-400",
              status === "pending" && "bg-zinc-500"
            )} />
          </div>
        )}
      </div>

      {/* ── Label + meta ── */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-normal truncate leading-tight text-[#1f1f1f] dark:text-[#e8e8e8]" title={item.name}>
          {item.name}
        </p>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
          {item.type === "file" ? (
            <p className="truncate">{item.fileType?.toUpperCase() || "File"} · {formatSize(item.fileSize)}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <p className="truncate">
                {item.type === "subject" ? "Subject Portal" : "Folder"}
                {(item.folderCount !== undefined || item.documentCount !== undefined) && (
                  ` · ${item.folderCount || 0} folders, ${item.documentCount || 0} files`
                )}
                {item.fileSize && item.fileSize > 0 ? ` · ${formatSize(item.fileSize)}` : ""}
              </p>
              {renderAcademicIndicators(item)}
            </div>
          )}
        </div>
      </div>

      {/* ── Folder Status Badge (right-aligned) ── */}
      {isFolder && item.taskStatus && (
        <div className="absolute right-7 top-1/2 -translate-y-1/2 z-10">
          <FolderStatusBadge item={item} />
        </div>
      )}

      {/* ── Favorite star ── */}
      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={cn(
            "absolute top-1.5 right-1.5 p-0.5 rounded transition-all z-10",
            item.isFavorite
              ? "text-yellow-400 opacity-100"
              : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400"
          )}
        >
          <Star className={cn("h-3 w-3", item.isFavorite && "fill-yellow-400")} />
        </button>
      )}
    </div>
  );
});


// ── Large Icon Card ────────────────────────────────────────────────────────────
const LargeIconCard = memo(function LargeIconCard({
  item,
  isSelected,
  onItemClick,
  onItemDblClick,
  onItemContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleFavorite,
  onCheckboxChange,
}: {
  item: ExplorerItemData;
  isSelected: boolean;
  onItemClick: (e: React.MouseEvent) => void;
  onItemDblClick: () => void;
  onItemContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onToggleFavorite?: () => void;
  onCheckboxChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isFolder = item.type === "folder" || item.type === "subject";
  const status = getAiStatus(item);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onItemClick}
      onDoubleClick={onItemDblClick}
      onContextMenu={onItemContextMenu}
      className={cn(
        "group relative flex flex-col items-center p-3 rounded-xl border transition-colors duration-150 cursor-pointer select-none text-center",
        isSelected
          ? "bg-[#2563eb]/12 border-[#2563eb]/60"
          : "bg-card/20 border-border/30 hover:bg-[rgba(37,99,235,0.08)] hover:border-border/60"
      )}
    >
      {onCheckboxChange && (
        <Checkbox
          checked={isSelected}
          onChange={onCheckboxChange}
          className={cn(
            "absolute top-2 left-2 z-20 transition-opacity duration-75 opacity-0 group-hover:opacity-100",
            isSelected && "!opacity-100"
          )}
        />
      )}

      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={cn(
            "absolute top-2 right-2 p-0.5 rounded transition-all z-10",
            item.isFavorite ? "text-yellow-400 opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400"
          )}
        >
          <Star className={cn("h-3 w-3", item.isFavorite && "fill-yellow-400")} />
        </button>
      )}

      <div className={cn(
        "relative h-12 w-12 rounded-xl flex items-center justify-center mb-2.5 border",
        isFolder
          ? "bg-gradient-to-br from-amber-400/25 via-orange-300/15 to-transparent border-amber-400/30"
          : "bg-secondary/60 border-border/30"
      )}>
        {item.type === "subject" && item.color && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
        )}
        <FileIcon
          type={item.type === "file" ? (item.fileType || "") : item.type}
          className={cn("h-5.5 w-5.5", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
          color={item.color}
        />
        {item.type === "file" && status && (
          <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background border border-border flex items-center justify-center">
            <div className={cn("h-1.5 w-1.5 rounded-full",
              status === "processed" && "bg-emerald-400",
              status === "processing" && "bg-amber-400 animate-pulse",
              status === "failed" && "bg-red-400",
              status === "pending" && "bg-zinc-500"
            )} />
          </div>
        )}
      </div>

      <p className="text-[11px] font-medium text-foreground/90 group-hover:text-foreground line-clamp-2 leading-tight" title={item.name}>
        {item.name}
      </p>
      {renderAcademicIndicators(item)}
    </div>
  );
});

// Checkbox component was moved to the top of the file to prevent hoisting/reference errors

// ── Main Component ─────────────────────────────────────────────────────────────
export function ExplorerMain({
  items,
  selectedIds,
  onSelect,
  onOpen,
  onContextMenu,
  viewMode,
  onMoveItem,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onDelete,
  onRename,
  onToggleFavorite,
}: ExplorerMainProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSelectedIdRef = useRef<string | null>(null);

  // ── Keyboard handler (deduped from parent — this is a secondary safety listener) ──
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        onSelect(new Set(items.map((i) => i.id)));
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onSelect(new Set());
        lastSelectedIdRef.current = null;
      }
      if (e.key === "Enter" && selectedIds.size === 1) {
        e.preventDefault();
        const id = Array.from(selectedIds)[0];
        const item = items.find((i) => i.id === id);
        if (item) onOpen(item);
      }
      if (e.key === "Delete" && selectedIds.size > 0 && onDelete) {
        e.preventDefault();
        onDelete();
      }
      if (e.key === "F2" && selectedIds.size === 1 && onRename) {
        e.preventDefault();
        onRename();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIds, onOpen, onDelete, onRename, onSelect]);

  // ── Click / Selection ──────────────────────────────────────────────────────
  const handleItemClick = useCallback((e: React.MouseEvent, item: ExplorerItemData) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      lastSelectedIdRef.current = item.id;
      onSelect(next);
    } else if (e.shiftKey && lastSelectedIdRef.current) {
      const lastIdx = items.findIndex((i) => i.id === lastSelectedIdRef.current);
      const curIdx = items.findIndex((i) => i.id === item.id);
      if (lastIdx !== -1 && curIdx !== -1) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        onSelect(new Set(items.slice(start, end + 1).map((i) => i.id)));
      }
    } else {
      onSelect(new Set([item.id]));
      lastSelectedIdRef.current = item.id;
    }
  }, [items, selectedIds, onSelect]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onSelect(new Set());
      lastSelectedIdRef.current = null;
    }
  }, [onSelect]);

  const handleHeaderCheckboxChange = useCallback(() => {
    if (selectedIds.size === items.length) {
      onSelect(new Set());
    } else {
      onSelect(new Set(items.map((item) => item.id)));
    }
  }, [items, selectedIds, onSelect]);

  const handleRowCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    onSelect(next);
  }, [selectedIds, onSelect]);

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, item: ExplorerItemData) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, type: item.type }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, target: ExplorerItemData) => {
    if (target.type === "file") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    (e.currentTarget as HTMLElement).classList.add("border-primary/60", "bg-primary/8");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove("border-primary/60", "bg-primary/8");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, target: ExplorerItemData) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove("border-primary/60", "bg-primary/8");
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json")) as { id: string; type: string };
      if (data.id === target.id) return;
      const subId = target.type === "subject" ? target.id : (target.subjectId || "");
      const foldId = target.type === "folder" ? target.id : null;
      if (data.type === "file") onMoveItem(data.id, "file", subId, foldId);
      else if (data.type === "folder") onMoveItem(data.id, "folder", subId, foldId);
    } catch {}
  }, [onMoveItem]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex flex-col items-center justify-center p-12 text-center bg-white"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div className="h-20 w-20 rounded-lg bg-slate-50 border border-[#e5e7eb] flex items-center justify-center mb-5 shadow-xs">
          <FolderOpen className="h-10 w-10 text-[#6b7280]/40" />
        </div>
        <h3 className="text-base font-semibold text-[#111827] mb-1">No files available in this folder.</h3>
        <p className="text-sm text-[#6b7280] max-w-xs leading-relaxed">
          Upload materials or create folders to get started.
        </p>
      </div>
    );
  }

  // ── Sort column header helper ──────────────────────────────────────────────
  const renderSortHeader = (
    field: SortProperty,
    label: string,
    align: "left" | "right" = "left",
    widthClass: string = "w-[45%]",
    responsiveClass: string = "",
    borderRight: boolean = true
  ) => {
    const isActive = sortBy === field;
    return (
      <th
        onClick={(e) => {
          // If they click the checkbox itself, don't trigger sorting
          if ((e.target as HTMLElement).closest("input[type='checkbox']")) {
            return;
          }
          if (setSortBy && setSortOrder) {
            if (isActive) {
              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
            } else {
              setSortBy(field);
              setSortOrder("asc");
            }
          }
        }}
        className={cn(
          "px-2.5 py-1 text-left text-[12px] font-semibold tracking-normal select-none cursor-pointer transition-colors normal-case align-middle text-[#616161] dark:text-[#a0a0a0] hover:text-[#1f1f1f] dark:hover:text-[#f3f3f3]",
          borderRight && "border-r border-[#e0e0e0] dark:border-[#2d2d2d]",
          align === "right" && "text-right",
          isActive ? "text-[#1f1f1f] dark:text-[#f3f3f3]" : "",
          widthClass,
          responsiveClass
        )}
      >
        <span className={cn("flex items-center gap-2", align === "right" && "justify-end")}>
          {field === "name" && (
            <Checkbox
              checked={items.length > 0 && selectedIds.size === items.length}
              indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
              onChange={handleHeaderCheckboxChange}
            />
          )}
          <span className="flex items-center gap-1">
            {label}
            {isActive && (sortOrder === "asc" ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />)}
          </span>
        </span>
      </th>
    );
  };

  // ── LARGE ICONS ────────────────────────────────────────────────────────────
  if (viewMode === "large-icons") {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 outline-none"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {items.map((item) => (
            <LargeIconCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onItemClick={(e) => handleItemClick(e, item)}
              onItemDblClick={() => onOpen(item)}
              onItemContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={(e) => handleDragOver(e, item)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item)}
              onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item.id, item.type) : undefined}
              onCheckboxChange={(e) => handleRowCheckboxChange(e, item.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── SMALL ICONS ────────────────────────────────────────────────────────────
  if (viewMode === "small-icons") {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 outline-none"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isFolder = item.type !== "file";
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item)}
                onClick={(e) => handleItemClick(e, item)}
                onDoubleClick={() => onOpen(item)}
                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
                className={cn(
                  "group flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all cursor-pointer select-none max-w-[180px]",
                  isSelected
                    ? "bg-primary/12 border-primary/50 text-foreground"
                    : "bg-card/20 border-border/30 text-muted-foreground hover:text-foreground hover:bg-card/50 hover:border-border/60"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={(e) => handleRowCheckboxChange(e, item.id)}
                  className={cn(
                    "shrink-0 transition-opacity duration-75 opacity-0 group-hover:opacity-100",
                    isSelected && "!opacity-100"
                  )}
                />
                <FileIcon
                  type={item.type === "file" ? (item.fileType || "") : item.type}
                  className={cn("h-4 w-4 shrink-0", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
                  color={item.color}
                />
                <span className="text-[11px] font-medium truncate" title={item.name}>{item.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── LIST ───────────────────────────────────────────────────────────────────
  if (viewMode === "list") {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 outline-none"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isFolder = item.type !== "file";
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item)}
                onClick={(e) => handleItemClick(e, item)}
                onDoubleClick={() => onOpen(item)}
                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
                className={cn(
                  "group flex items-center justify-between px-3 py-2 rounded-md border transition-all cursor-pointer select-none",
                  isSelected
                    ? "bg-primary/12 border-primary/50"
                    : "bg-card/10 border-transparent hover:bg-card/40 hover:border-border/40"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => handleRowCheckboxChange(e, item.id)}
                    className={cn(
                      "shrink-0 transition-opacity duration-75 opacity-0 group-hover:opacity-100",
                      isSelected && "!opacity-100"
                    )}
                  />
                  <FileIcon
                    type={item.type === "file" ? (item.fileType || "") : item.type}
                    className={cn("h-4 w-4 shrink-0", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
                    color={item.color}
                  />
                  <span className="text-[12px] font-medium text-foreground/90 truncate" title={item.name}>
                    {item.name}
                  </span>
                  {item.taskStatus && <FolderStatusBadge item={item} />}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 shrink-0">
                  <span className="w-14 text-right">{formatExplorerItemSize(item.type, item.fileSize)}</span>
                  <span className="hidden md:block w-14">{item.type === "file" ? (item.fileType?.toUpperCase() || "FILE") : "Folder"}</span>
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, item.type); }}
                      className={cn("p-0.5 rounded transition-all",
                        item.isFavorite ? "text-yellow-400 opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400"
                      )}
                    >
                      <Star className={cn("h-3 w-3", item.isFavorite && "fill-yellow-400")} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── DETAILS ────────────────────────────────────────────────────────────────
  if (viewMode === "details") {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto outline-none bg-white dark:bg-[#191919]"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[#f8f8f8] dark:bg-[#1e1e1e] border-b border-[#e0e0e0] dark:border-[#2d2d2d] h-8">
            <tr className="h-full">
              {renderSortHeader("name", "Name", "left", "w-[45%]", "", true)}
              {renderSortHeader(
                sortBy === "dateCreated" ? "dateCreated" : "dateModified",
                sortBy === "dateCreated" ? "Date Created" : "Date Modified",
                "left",
                "w-[20%]",
                "hidden lg:table-cell",
                true
              )}
              {renderSortHeader("type", "Type", "left", "w-[20%]", "hidden sm:table-cell", true)}
              {renderSortHeader("size", "Size", "right", "w-[15%]", "hidden sm:table-cell", false)}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const _isFolder = item.type !== "file";
              return (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={(e) => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item)}
                  onClick={(e) => handleItemClick(e, item)}
                  onDoubleClick={() => onOpen(item)}
                  onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
                  className={cn(
                    "group border-b border-[#e0e0e0] dark:border-[#2d2d2d] cursor-pointer transition-colors duration-[120ms] select-none h-[38px] border-l-2",
                    isSelected
                      ? "bg-[#cce8ff] dark:bg-[#1a3f6f]/60 border-l-[#0067c0] dark:border-l-[#60cdff]"
                      : "hover:bg-[#f0f0f0] dark:hover:bg-white/[0.05] bg-transparent border-l-transparent"
                  )}
                >
                  {/* Name cell */}
                  <td className="px-2.5 py-0.5 align-middle w-[45%] min-w-0">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleRowCheckboxChange(e, item.id)}
                        className={cn(
                          "shrink-0 transition-opacity duration-75 opacity-0 group-hover:opacity-100",
                          isSelected && "!opacity-100"
                        )}
                      />
                      <FileIcon
                        type={item.type === "file" ? (item.fileType || "") : item.type}
                        color={item.color}
                        className="shrink-0 h-[18px] w-[18px]"
                      />
                      <span className="text-[13px] font-normal text-[#1f1f1f] dark:text-[#e8e8e8] truncate" title={item.name}>
                        {item.name}
                      </span>
                      {item.taskStatus && <FolderStatusBadge item={item} />}
                      {item.isFavorite && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
                    </div>
                  </td>
                  {/* Date cell */}
                  <td className="hidden lg:table-cell px-2.5 py-0.5 text-[12px] text-[#6b7280] dark:text-[#a3a3a3] align-middle w-[20%] truncate">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#6b7280]/60 dark:text-[#a3a3a3]/60 shrink-0" />
                      <span>{formatDate(sortBy === "dateCreated" ? item.createdAt : (item.modifiedAt || item.createdAt))}</span>
                    </div>
                  </td>
                  {/* Type cell */}
                  <td className="hidden sm:table-cell px-2.5 py-0.5 text-[12px] text-[#6b7280] dark:text-[#a3a3a3] align-middle w-[20%] truncate">
                    {item.type === "subject" ? (
                      "Subject"
                    ) : item.type === "folder" ? (
                      "Folder"
                    ) : (
                      `${item.fileType?.toUpperCase() || "File"} File`
                    )}
                  </td>
                  {/* Size cell */}
                  <td className="hidden sm:table-cell px-2.5 py-0.5 text-[12px] text-[#6b7280] dark:text-[#a3a3a3] text-right align-middle w-[15%]">
                    <span className="truncate">{formatExplorerItemSize(item.type, item.fileSize)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── TILES ──────────────────────────────────────────────────────────────────
  if (viewMode === "tiles") {
    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 outline-none"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isFolder = item.type !== "file";
            const status = getAiStatus(item);
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item)}
                onClick={(e) => handleItemClick(e, item)}
                onDoubleClick={() => onOpen(item)}
                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
                className={cn(
                  "group relative flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-100 cursor-pointer select-none",
                  isSelected
                    ? "bg-primary/12 border-primary/60"
                    : "bg-card/20 border-border/30 hover:bg-card/50 hover:border-border/60"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={(e) => handleRowCheckboxChange(e, item.id)}
                  className={cn(
                    "absolute top-2 left-2 z-20 transition-opacity duration-75 opacity-0 group-hover:opacity-100",
                    isSelected && "!opacity-100"
                  )}
                />
                {onToggleFavorite && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, item.type); }}
                    className={cn("absolute top-2 right-2 p-0.5 rounded z-10 transition-all",
                      item.isFavorite ? "text-yellow-400 opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400")}
                  >
                    <Star className={cn("h-3 w-3", item.isFavorite && "fill-yellow-400")} />
                  </button>
                )}
                <div className={cn(
                  "relative h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border",
                  isFolder
                    ? "bg-gradient-to-br from-amber-400/20 to-orange-300/10 border-amber-400/25"
                    : "bg-secondary/60 border-border/30"
                )}>
                  {item.type === "subject" && item.color && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  )}
                  <FileIcon
                    type={item.type === "file" ? (item.fileType || "") : item.type}
                    className={cn("h-6 w-6", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
                    color={item.color}
                  />
                  {item.type === "file" && status && (
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background border border-border flex items-center justify-center">
                      <div className={cn("h-1.5 w-1.5 rounded-full",
                        status === "processed" && "bg-emerald-400",
                        status === "processing" && "bg-amber-400 animate-pulse",
                        status === "failed" && "bg-red-400",
                        status === "pending" && "bg-zinc-500"
                      )} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 pr-5">
                    <p className="text-[12px] font-semibold text-foreground/90 group-hover:text-foreground truncate" title={item.name}>
                      {item.name}
                    </p>
                    {item.taskStatus && <FolderStatusBadge item={item} />}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                    {item.type === "file"
                      ? `${item.fileType?.toUpperCase() || "FILE"} · ${formatSize(item.fileSize)}`
                      : `${item.type === "subject" ? "Subject" : "Folder"} · ${item.documentCount ?? 0} files`}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── MEDIUM ICONS (default) ─────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto p-3 outline-none"
      onClick={handleBackgroundClick}
      onContextMenu={(e) => onContextMenu(e, null)}
    >
      <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((item) => (
          <FolderCard
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onItemClick={(e) => handleItemClick(e, item)}
            onItemDblClick={() => onOpen(item)}
            onItemContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, item); }}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item)}
            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item.id, item.type) : undefined}
            onCheckboxChange={(e) => handleRowCheckboxChange(e, item.id)}
          />
        ))}
      </div>
    </div>
  );
}
