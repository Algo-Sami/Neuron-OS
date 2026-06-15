"use client";

import React from "react";
import {
  Search,
  FolderPlus,
  Upload,
  Trash2,
  Pencil,
  ArrowUpDown,
  RefreshCw,
  Info,
  Star,
  Brain,
  Sparkles,
  LayoutGrid,
  ChevronDown,
  Check,
  Pin,
  FileText,
  Zap,
  StickyNote,
  BookOpen,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { ViewMode, BreadcrumbSegment } from "@/types/explorer";
import { ExplorerBreadcrumb } from "./explorer-breadcrumb";
import { cn } from "@/lib/utils";

interface ExplorerToolbarProps {
  segments: BreadcrumbSegment[];
  onNavigate: (subjectId: string | null, folderId: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedCount: number;

  onNewFolder?: () => void;
  onUploadFile?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onProperties?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  canCreateFolder: boolean;
  canUpload: boolean;

  sortBy: "name" | "date" | "size" | "type";
  setSortBy: (sort: "name" | "date" | "size" | "type") => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (order: "asc" | "desc") => void;

  showQuickAccess: boolean;
  setShowQuickAccess: (show: boolean) => void;
  isFavorite: boolean;
  onToggleFavorite?: () => void;

  onStudyWithAI?: () => void;
  onGenerateSummary?: () => void;
  onGenerateQuiz?: () => void;
}

/* ── Toolbar separator ─────────────────────────────────────────────────────── */
function Sep() {
  return <span className="h-5 w-px bg-border/50 shrink-0" />;
}

/* ── Ribbon button ─────────────────────────────────────────────────────────── */
function RibbonBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  accent,
  active,
  title,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: string;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-md",
        "text-[10px] font-medium transition-all duration-150 cursor-pointer select-none",
        "min-w-[44px] h-12 shrink-0",
        danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : accent
          ? `${accent} hover:bg-white/5`
          : active
          ? "bg-primary/15 text-primary border border-primary/20"
          : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="leading-tight whitespace-nowrap">{label}</span>
    </button>
  );
}

export function ExplorerToolbar({
  segments,
  onNavigate,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  selectedCount,
  onNewFolder,
  onUploadFile,
  onRename,
  onDelete,
  onProperties,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  canCreateFolder,
  canUpload,
  onRefresh,
  isRefreshing = false,
  showQuickAccess,
  setShowQuickAccess,
  isFavorite,
  onToggleFavorite,
  onStudyWithAI,
  onGenerateSummary,
  onGenerateQuiz,
}: ExplorerToolbarProps) {
  return (
    <div className="flex flex-col shrink-0 bg-card/60 border-b border-border/60 backdrop-blur-md select-none">

      {/* ── Row 1: Address bar + Search ──────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <div className="flex-1 min-w-0">
          <ExplorerBreadcrumb segments={segments} onNavigate={onNavigate} />
        </div>

        {/* Search */}
        <div className="relative w-56 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary rounded-md w-full"
          />
        </div>
      </div>

      {/* ── Row 2: Windows 11 Ribbon ─────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto no-scrollbar">

        {/* ── New group ── */}
        {(canCreateFolder || canUpload) && (
          <>
            {canCreateFolder && onNewFolder && (
              <RibbonBtn icon={FolderPlus} label="New Folder" onClick={onNewFolder} />
            )}
            {canUpload && onUploadFile && (
              <RibbonBtn icon={Upload} label="Upload" onClick={onUploadFile} />
            )}
            <Sep />
          </>
        )}

        {/* ── Edit group (selection-dependent) ── */}
        {selectedCount > 0 && (
          <>
            {selectedCount === 1 && onRename && (
              <RibbonBtn icon={Pencil} label="Rename" onClick={onRename} />
            )}
            {selectedCount === 1 && onToggleFavorite && (
              <RibbonBtn
                icon={Star}
                label={isFavorite ? "Unfavorite" : "Favorite"}
                onClick={onToggleFavorite}
                active={isFavorite}
                accent={isFavorite ? "text-yellow-400" : undefined}
              />
            )}
            {selectedCount === 1 && onProperties && (
              <RibbonBtn icon={Info} label="Properties" onClick={onProperties} />
            )}
            {onDelete && (
              <RibbonBtn icon={Trash2} label={`Delete (${selectedCount})`} onClick={onDelete} danger />
            )}
            <Sep />
          </>
        )}

        {/* ── AI Tools (file-selection-dependent) ── */}
        {selectedCount > 0 && (onStudyWithAI || onGenerateSummary || onGenerateQuiz) && (
          <>
            <span className="text-[9px] font-bold text-purple-400/80 uppercase tracking-wider px-1.5 self-center whitespace-nowrap">
              AI
            </span>
            {onStudyWithAI && (
              <RibbonBtn icon={Brain} label="Study" onClick={onStudyWithAI} accent="text-purple-400" />
            )}
            {onGenerateSummary && (
              <RibbonBtn icon={FileText} label="Summary" onClick={onGenerateSummary} accent="text-indigo-400" />
            )}
            {onGenerateQuiz && (
              <RibbonBtn icon={Zap} label="Quiz" onClick={onGenerateQuiz} accent="text-blue-400" />
            )}
            <Sep />
          </>
        )}

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── View & Tools group (always visible) ── */}
        <div className="flex items-center gap-0.5">
          {/* Quick Access toggle */}
          <button
            onClick={() => setShowQuickAccess(!showQuickAccess)}
            title="Quick Access"
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[10px] font-medium transition-all cursor-pointer shrink-0",
              showQuickAccess
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-white/8"
            )}
          >
            <Pin className="h-3.5 w-3.5 rotate-45" />
            <span className="hidden sm:inline">Quick Access</span>
          </button>

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh"
              className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-primary")} />
            </button>
          )}

          <Sep />

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all cursor-pointer shrink-0" />
              }
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sort</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-card/95 backdrop-blur-md border border-border/50 shadow-xl text-xs">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[9px] text-muted-foreground uppercase font-bold px-2 py-1 tracking-wider">Sort by</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {(["name", "type", "date", "size"] as const).map((field) => (
                <DropdownMenuItem
                  key={field}
                  onClick={() => setSortBy(field)}
                  className={cn("cursor-pointer capitalize", sortBy === field && "text-primary font-semibold")}
                >
                  <span className="flex-1">{field === "date" ? "Date Added" : field === "size" ? "File Size" : field}</span>
                  {sortBy === field && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="cursor-pointer font-medium"
              >
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all cursor-pointer shrink-0" />
              }
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-card/95 backdrop-blur-md border border-border/50 shadow-xl text-xs">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[9px] text-muted-foreground uppercase font-bold px-2 py-1 tracking-wider">Layout</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {([
                ["large-icons", "Large Icons"],
                ["medium-icons", "Medium Icons"],
                ["small-icons", "Small Icons"],
                ["list", "List"],
                ["details", "Details"],
                ["tiles", "Tiles"],
              ] as [ViewMode, string][]).map(([mode, label]) => (
                <DropdownMenuItem
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <span>{label}</span>
                  {viewMode === mode && <Check className="h-3 w-3 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
