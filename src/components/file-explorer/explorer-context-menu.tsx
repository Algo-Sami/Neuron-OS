"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FolderOpen,
  Pencil,
  Trash2,
  Copy,
  FolderPlus,
  Upload,
  Sparkles,
  Download,
  Info,
  ExternalLink,
  BrainCircuit,
  Zap,
  RotateCcw,
  Star,
  Scissors,
  Clipboard,
  ArrowUpDown,
  LayoutGrid,
  ChevronRight,
  Pin,
  Files,
  Check,
} from "lucide-react";
import { ViewMode } from "@/types/explorer";
import { cn } from "@/lib/utils";

export interface ContextMenuProps {
  x: number;
  y: number;
  type: "subject" | "folder" | "file" | "background";
  isRecycled?: boolean;
  isFavorite?: boolean;
  hasClipboard?: boolean;
  onClose: () => void;
  actions: {
    onOpen?: () => void;
    onOpenNewTab?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    onRestore?: () => void;
    onDuplicate?: () => void;
    onCreateFolder?: () => void;
    onUploadFile?: () => void;
    onDownload?: () => void;
    onGenerateSummary?: () => void;
    onGenerateQuiz?: () => void;
    onGenerateNotes?: () => void;
    onGenerateFlashcards?: () => void;
    onStudyWithAI?: () => void;
    onAddToRevision?: () => void;
    onToggleFavorite?: () => void;
    onProperties?: () => void;
    onCopy?: () => void;
    onCut?: () => void;
    onPaste?: () => void;
    onMoveTo?: () => void;
    onCopyTo?: () => void;
    onSetSortBy?: (sort: "name" | "date" | "size" | "type") => void;
    onSetViewMode?: (mode: ViewMode) => void;
    currentSortBy?: "name" | "date" | "size" | "type";
    currentViewMode?: ViewMode;
  };
}

// ── Menu Item Component ─────────────────────────────────────────────────────
function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
  accent,
  checked,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  accent?: string;
  checked?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left cursor-pointer transition-colors",
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-foreground hover:bg-secondary/80",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", accent ?? (danger ? "text-red-400" : "text-muted-foreground"))} />
      <span className="flex-1 truncate">{label}</span>
      {checked && <Check className="h-3 w-3 text-primary shrink-0" />}
    </button>
  );
}

// ── Separator ───────────────────────────────────────────────────────────────
function Sep() {
  return <div className="my-1 border-t border-border/40" />;
}

// ── Section Label ───────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-0.5">
      {label}
    </span>
  );
}

// ── Submenu Item — hover-safe using timer + mouse position ──────────────────
function SubMenuItem({
  icon: Icon,
  label,
  children,
  side = "right",
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  side?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 150);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <div
      ref={parentRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <div className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-foreground hover:bg-secondary/80 cursor-pointer transition-colors">
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {label}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
      </div>

      {open && (
        <div
          ref={submenuRef}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className={cn(
            "absolute top-0 z-[60] w-[148px] rounded-xl border border-border/80 bg-card/98 p-1.5 shadow-2xl backdrop-blur-md",
            "animate-in fade-in zoom-in-95 duration-100",
            side === "right" ? "left-[calc(100%+2px)]" : "right-[calc(100%+2px)]"
          )}
          style={{ top: 0 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main Context Menu ───────────────────────────────────────────────────────
export function ExplorerContextMenu({
  x,
  y,
  type,
  isRecycled = false,
  isFavorite = false,
  hasClipboard = false,
  onClose,
  actions,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Screen-edge adjustment
  const menuWidth = 200;
  const menuHeight = type === "file" ? 420 : type === "subject" ? 300 : type === "background" ? 220 : 220;
  let adjustedX = x;
  let adjustedY = y;
  if (typeof window !== "undefined") {
    if (x + menuWidth > window.innerWidth) adjustedX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) adjustedY = window.innerHeight - menuHeight - 10;
    if (adjustedX < 8) adjustedX = 8;
    if (adjustedY < 8) adjustedY = 8;
  }

  // Detect if submenu should open to the left
  const submenuSide = adjustedX + menuWidth + 148 > (typeof window !== "undefined" ? window.innerWidth : 9999) ? "left" : "right";

  const act = (cb?: () => void) => {
    cb?.();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-[200px] rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none text-[11px]"
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >

      {/* ── SUBJECT ── */}
      {type === "subject" && (
        <>
          {isRecycled ? (
            <>
              <MenuItem icon={RotateCcw} label="Restore Portal" onClick={() => act(actions.onRestore)} accent="text-emerald-400" />
              <Sep />
              <MenuItem icon={Info} label="Properties" onClick={() => act(actions.onProperties)} />
              <Sep />
              <MenuItem icon={Trash2} label="Delete Permanently" onClick={() => act(actions.onDelete)} danger />
            </>
          ) : (
            <>
              <MenuItem icon={FolderOpen} label="Open Portal" onClick={() => act(actions.onOpen)} accent="text-indigo-400" />
              <MenuItem icon={ExternalLink} label="Open in New Tab" onClick={() => act(actions.onOpenNewTab)} />
              <Sep />
              <MenuItem icon={Pencil} label="Rename Portal" onClick={() => act(actions.onRename)} />
              <MenuItem icon={Copy} label="Duplicate Subject" onClick={() => act(actions.onDuplicate)} />
              <MenuItem icon={FolderPlus} label="Create Folder" onClick={() => act(actions.onCreateFolder)} accent="text-primary/80" />
              <MenuItem icon={Upload} label="Upload File" onClick={() => act(actions.onUploadFile)} />
              <Sep />
              <MenuItem icon={Star} label={isFavorite ? "Remove from Favorites" : "Add to Favorites"} onClick={() => act(actions.onToggleFavorite)} accent={isFavorite ? "fill-yellow-400 text-yellow-400" : undefined} />
              <Sep />
              <MenuItem icon={Info} label="Properties" onClick={() => act(actions.onProperties)} />
              <Sep />
              <MenuItem icon={Trash2} label="Move to Recycle Bin" onClick={() => act(actions.onDelete)} danger />
            </>
          )}
        </>
      )}

      {/* ── FOLDER ── */}
      {type === "folder" && (
        <>
          <MenuItem icon={FolderOpen} label="Open Folder" onClick={() => act(actions.onOpen)} accent="text-blue-400" />
          <Sep />
          <MenuItem icon={Pencil} label="Rename Folder" onClick={() => act(actions.onRename)} />
          <MenuItem icon={Copy} label="Duplicate Folder" onClick={() => act(actions.onDuplicate)} />
          <MenuItem icon={FolderPlus} label="Create Subfolder" onClick={() => act(actions.onCreateFolder)} accent="text-primary/80" />
          <MenuItem icon={Upload} label="Upload File" onClick={() => act(actions.onUploadFile)} />
          <Sep />
          <MenuItem icon={Star} label={isFavorite ? "Remove from Favorites" : "Add to Favorites"} onClick={() => act(actions.onToggleFavorite)} accent={isFavorite ? "fill-yellow-400 text-yellow-400" : undefined} />
          <Sep />
          <MenuItem icon={Info} label="Properties" onClick={() => act(actions.onProperties)} />
          <Sep />
          <MenuItem icon={Trash2} label="Delete Folder" onClick={() => act(actions.onDelete)} danger />
        </>
      )}

      {/* ── FILE ── */}
      {type === "file" && (
        <>
          {isRecycled ? (
            <>
              <MenuItem icon={RotateCcw} label="Restore File" onClick={() => act(actions.onRestore)} accent="text-emerald-400" />
              <Sep />
              <MenuItem icon={Info} label="Properties" onClick={() => act(actions.onProperties)} />
              <Sep />
              <MenuItem icon={Trash2} label="Delete Permanently" onClick={() => act(actions.onDelete)} danger />
            </>
          ) : (
            <>
              <MenuItem icon={ExternalLink} label="Open / Preview" onClick={() => act(actions.onOpen)} />
              <MenuItem icon={Download} label="Download" onClick={() => act(actions.onDownload)} />
              <Sep />
              <MenuItem icon={Pencil} label="Rename File" onClick={() => act(actions.onRename)} />
              <MenuItem icon={Copy} label="Duplicate File" onClick={() => act(actions.onDuplicate)} />
              <MenuItem icon={Files} label="Copy" onClick={() => act(actions.onCopy)} />
              <MenuItem icon={Scissors} label="Cut" onClick={() => act(actions.onCut)} />
              <Sep />
              <SectionLabel label="AI Study Tools" />
              <MenuItem icon={BrainCircuit} label="Generate Summary" onClick={() => act(actions.onGenerateSummary)} accent="text-primary/85" />
              <MenuItem icon={Sparkles} label="Generate Notes" onClick={() => act(actions.onGenerateNotes)} accent="text-emerald-400" />
              <MenuItem icon={Sparkles} label="Generate Flashcards" onClick={() => act(actions.onGenerateFlashcards)} accent="text-yellow-400" />
              <MenuItem icon={Zap} label="Take AI Quiz" onClick={() => act(actions.onGenerateQuiz)} accent="text-blue-400" />
              <MenuItem icon={Sparkles} label="AI Study Chat" onClick={() => act(actions.onStudyWithAI)} accent="text-purple-400" />
              <MenuItem icon={Pin} label="Add to Revision Pack" onClick={() => act(actions.onAddToRevision)} accent="text-teal-400" />
              <Sep />
              <MenuItem icon={Star} label={isFavorite ? "Remove from Favorites" : "Add to Favorites"} onClick={() => act(actions.onToggleFavorite)} accent={isFavorite ? "fill-yellow-400 text-yellow-400" : undefined} />
              <Sep />
              <MenuItem icon={Info} label="Properties" onClick={() => act(actions.onProperties)} />
              <Sep />
              <MenuItem icon={Trash2} label="Move to Recycle Bin" onClick={() => act(actions.onDelete)} danger />
            </>
          )}
        </>
      )}

      {/* ── BACKGROUND ── */}
      {type === "background" && (
        <>
          {actions.onCreateFolder && (
            <MenuItem icon={FolderPlus} label="New Folder" onClick={() => act(actions.onCreateFolder)} accent="text-primary/80" />
          )}
          {actions.onUploadFile && (
            <MenuItem icon={Upload} label="Upload File" onClick={() => act(actions.onUploadFile)} />
          )}
          {hasClipboard && actions.onPaste && (
            <MenuItem icon={Clipboard} label="Paste" onClick={() => act(actions.onPaste)} />
          )}

          <Sep />

          {/* View submenu — hover-safe */}
          {actions.onSetViewMode && (
            <SubMenuItem icon={LayoutGrid} label="View" side={submenuSide}>
              {(["large-icons", "medium-icons", "small-icons", "list", "details", "tiles"] as ViewMode[]).map((mode) => (
                <MenuItem
                  key={mode}
                  icon={LayoutGrid}
                  label={mode.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  onClick={() => act(() => actions.onSetViewMode?.(mode))}
                  checked={actions.currentViewMode === mode}
                />
              ))}
            </SubMenuItem>
          )}

          {/* Sort submenu — hover-safe */}
          {actions.onSetSortBy && (
            <SubMenuItem icon={ArrowUpDown} label="Sort By" side={submenuSide}>
              {(["name", "type", "date", "size"] as const).map((field) => (
                <MenuItem
                  key={field}
                  icon={ArrowUpDown}
                  label={field === "date" ? "Date Added" : field === "size" ? "File Size" : field.charAt(0).toUpperCase() + field.slice(1)}
                  onClick={() => act(() => actions.onSetSortBy?.(field))}
                  checked={actions.currentSortBy === field}
                />
              ))}
            </SubMenuItem>
          )}
        </>
      )}
    </div>
  );
}
