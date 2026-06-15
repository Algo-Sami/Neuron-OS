"use client";

import React, { useRef, useCallback, memo } from "react";
import { FileIcon } from "./explorer-icons";
import { ExplorerItemData, ViewMode } from "@/types/explorer";
import { Calendar, HardDrive, ChevronUp, ChevronDown, Star, FolderOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExplorerMainProps {
  items: ExplorerItemData[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onOpen: (item: ExplorerItemData) => void;
  onContextMenu: (e: React.MouseEvent, item: ExplorerItemData | null) => void;
  viewMode: ViewMode;
  onMoveItem: (itemId: string, itemType: "folder" | "file", targetSubjectId: string, targetFolderId: string | null) => void;
  sortBy?: "name" | "date" | "size" | "type";
  setSortBy?: (sort: "name" | "date" | "size" | "type") => void;
  sortOrder?: "asc" | "desc";
  setSortOrder?: (order: "asc" | "desc") => void;
  onDelete?: () => void;
  onRename?: () => void;
  onToggleFavorite?: (itemId: string, itemType: "subject" | "folder" | "file") => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatSize = (bytes?: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
};

const formatDate = (dateString: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateString));
  } catch {
    return dateString;
  }
};

const getAiStatus = (item: ExplorerItemData) => {
  if (item.type !== "file") return null;
  const status = item.summaryStatus || item.aiStatus;
  if (status === "completed" || status === "processed") return "processed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  return "pending";
};

// Subject color to CSS gradient map
const getSubjectColor = (color?: string | null) => {
  if (!color) return { bg: "from-indigo-500/20 to-purple-500/10", accent: "#6366f1" };
  return { bg: `from-[${color}]/20 to-[${color}]/5`, accent: color };
};

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
        "group relative flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-100 cursor-pointer select-none",
        isSelected
          ? "bg-primary/12 border-primary/60 shadow-sm shadow-primary/10"
          : "bg-card/20 border-border/30 hover:bg-card/50 hover:border-border/60"
      )}
    >
      {/* ── Icon ── */}
      <div className={cn(
        "relative h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
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
          className={cn("h-5 w-5", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
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
        <p className={cn(
          "text-[12px] font-semibold truncate leading-tight",
          isSelected ? "text-foreground" : "text-foreground/90 group-hover:text-foreground"
        )} title={item.name}>
          {item.name}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
          {item.type === "file"
            ? `${item.fileType?.toUpperCase() || "File"} · ${formatSize(item.fileSize)}`
            : item.type === "subject"
            ? `${item.documentCount ?? 0} files`
            : "Folder"}
        </p>
      </div>

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
        "group relative flex flex-col items-center p-3 rounded-xl border transition-all duration-100 cursor-pointer select-none text-center",
        isSelected
          ? "bg-primary/12 border-primary/60"
          : "bg-card/20 border-border/30 hover:bg-card/50 hover:border-border/60"
      )}
    >
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
        "relative h-14 w-14 rounded-xl flex items-center justify-center mb-2.5 border",
        isFolder
          ? "bg-gradient-to-br from-amber-400/25 via-orange-300/15 to-transparent border-amber-400/30"
          : "bg-secondary/60 border-border/30"
      )}>
        {item.type === "subject" && item.color && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
        )}
        <FileIcon
          type={item.type === "file" ? (item.fileType || "") : item.type}
          className={cn("h-7 w-7", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
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

      <p className="text-[11px] font-semibold text-foreground/90 group-hover:text-foreground line-clamp-2 leading-tight" title={item.name}>
        {item.name}
      </p>
    </div>
  );
});

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
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
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
        className="flex-1 min-h-0 flex flex-col items-center justify-center p-12 text-center"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div className="h-16 w-16 rounded-2xl bg-secondary/30 border border-border/30 flex items-center justify-center mb-4">
          <HardDrive className="h-8 w-8 text-muted-foreground/30" />
        </div>
        <h3 className="text-sm font-semibold text-foreground/60 mb-1">This folder is empty</h3>
        <p className="text-xs text-muted-foreground/50 max-w-xs leading-relaxed">
          Upload study files or create folders to get started.
        </p>
      </div>
    );
  }

  // ── Sort column header ─────────────────────────────────────────────────────
  const SortHeader = ({ field, label, align = "left" }: { field: "name" | "date" | "size" | "type"; label: string; align?: "left" | "right" }) => {
    const isActive = sortBy === field;
    return (
      <th
        onClick={() => {
          if (setSortBy && setSortOrder) {
            isActive ? setSortOrder(sortOrder === "asc" ? "desc" : "asc") : (setSortBy(field), setSortOrder("asc"));
          }
        }}
        className={cn(
          "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer transition-colors",
          align === "right" && "text-right",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="flex items-center gap-1">
          {label}
          {isActive && (sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
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
                <FileIcon
                  type={item.type === "file" ? (item.fileType || "") : item.type}
                  className={cn("h-4 w-4 shrink-0", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
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
                  <FileIcon
                    type={item.type === "file" ? (item.fileType || "") : item.type}
                    className={cn("h-4 w-4 shrink-0", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
                  />
                  <span className="text-[12px] font-medium text-foreground/90 truncate flex-1" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 shrink-0">
                  <span className="w-10 text-right">{item.type === "file" ? formatSize(item.fileSize) : "Folder"}</span>
                  <span className="hidden md:block">{item.type === "file" && item.fileType?.toUpperCase()}</span>
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, item.type); }}
                      className={cn("p-0.5 rounded transition-all", item.isFavorite ? "text-yellow-400 opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400")}
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
        className="flex-1 min-h-0 overflow-auto outline-none"
        onClick={handleBackgroundClick}
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <table className="w-full border-collapse select-none min-w-[500px]">
          <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 border-b border-border/40">
            <tr>
              <SortHeader field="name" label="Name" />
              <SortHeader field="type" label="Type" />
              <SortHeader field="size" label="Size" align="right" />
              <SortHeader field="date" label="Date Modified" />
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isFolder = item.type !== "file";
              const status = getAiStatus(item);
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
                    "border-b border-border/15 cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary/12 border-l-2 border-l-primary"
                      : "hover:bg-card/40"
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <FileIcon
                        type={item.type === "file" ? (item.fileType || "") : item.type}
                        className={cn("h-4 w-4 shrink-0", isFolder ? "text-amber-400/90" : "text-muted-foreground")}
                      />
                      <span className="text-[12px] font-medium text-foreground/90 truncate max-w-[200px]" title={item.name}>
                        {item.name}
                      </span>
                      {item.isFavorite && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {item.type === "subject" ? "Subject" : item.type === "folder" ? "Folder" : (item.fileType?.toUpperCase() || "File")}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground text-right">
                    {formatSize(item.fileSize)}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-muted-foreground/50" />
                      {formatDate(item.createdAt)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {status ? (
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full",
                          status === "processed" && "bg-emerald-400",
                          status === "processing" && "bg-amber-400 animate-pulse",
                          status === "failed" && "bg-red-400",
                          status === "pending" && "bg-zinc-500"
                        )} />
                        <span className={cn(
                          status === "processed" && "text-emerald-400",
                          status === "processing" && "text-amber-400",
                          status === "failed" && "text-red-400",
                          status === "pending" && "text-muted-foreground/60"
                        )}>
                          {status === "processed" ? "Ready" : status === "processing" ? "Processing…" : status === "failed" ? "Failed" : "Pending"}
                        </span>
                      </div>
                    ) : "—"}
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
                  <p className="text-[12px] font-semibold text-foreground/90 group-hover:text-foreground truncate pr-5" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                    {item.type === "file"
                      ? `${item.fileType?.toUpperCase()} · ${formatSize(item.fileSize)}`
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
          />
        ))}
      </div>
    </div>
  );
}
