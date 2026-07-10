"use client";

import React from "react";
import {
  Search,
  FolderPlus,
  Trash2,
  Pencil,
  ArrowUpDown,
  RefreshCw,
  LayoutGrid,
  ChevronDown,
  Check,
  FileText,
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  MoreHorizontal,
  Scissors,
  Copy,
  Clipboard,
  Share2,
  PanelRight,
  PanelRightClose,
  Pin,
  Brain,
  Zap,
  Star,
  Info,
  Upload,
} from "lucide-react";
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
import { ViewMode, BreadcrumbSegment, SortProperty } from "@/types/explorer";
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
  onNewFile?: () => void;
  onNewSubject?: () => void;
  onUploadFile?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onProperties?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  canCreateFolder: boolean;
  canUpload: boolean;

  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  hasClipboard?: boolean;

  sortBy: SortProperty;
  setSortBy: (sort: SortProperty) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (order: "asc" | "desc") => void;

  showQuickAccess: boolean;
  setShowQuickAccess: (show: boolean) => void;
  isFavorite: boolean;
  onToggleFavorite?: () => void;

  showPreview: boolean;
  setShowPreview: (show: boolean) => void;

  onStudyWithAI?: () => void;
  onGenerateSummary?: () => void;
  onGenerateQuiz?: () => void;

  // Navigation history props
  canGoBack?: boolean;
  canGoForward?: boolean;
  canGoUp?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  onGoUp?: () => void;
}

/* ── Vertical separator ─────────────────────────────────────────────────────── */
function Sep() {
  return <span className="h-5 w-px shrink-0 mx-1" style={{ backgroundColor: "var(--win-border, #e5e7eb)" }} />;
}

/* ── Navigation icon button (Back / Forward / Up / Refresh) ─────────────────── */
function NavBtn({
  icon: Icon,
  onClick,
  disabled,
  title,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-md transition-colors duration-[120ms] cursor-pointer select-none",
        "text-[#4b5563] dark:text-[#d4d4d4]",
        "hover:bg-black/[0.06] dark:hover:bg-white/[0.08]",
        "active:bg-black/[0.10] dark:active:bg-white/[0.12]",
        "disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
    </button>
  );
}

/* ── Command bar button (icon + label) ──────────────────────────────────────── */
function CmdBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  title,
  shortcut,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${title ?? label} (${shortcut})` : (title ?? label)}
      className={cn(
        "flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium transition-colors duration-[120ms] cursor-pointer select-none whitespace-nowrap",
        active
          ? "bg-black/[0.08] dark:bg-white/[0.10] text-[#1f2937] dark:text-white"
          : "text-[#1f2937] dark:text-[#d4d4d4] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#4b5563] dark:text-[#d4d4d4]" />
      <span>{label}</span>
    </button>
  );
}

/* ── Icon-only command bar button (Preview, More) ───────────────────────────── */
function IconBtn({
  icon: Icon,
  onClick,
  disabled,
  active,
  title,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-md text-[#4b5563] dark:text-[#d4d4d4] transition-colors duration-[120ms] cursor-pointer select-none",
        active
          ? "bg-black/[0.08] dark:bg-white/[0.10]"
          : "hover:bg-black/[0.06] dark:hover:bg-white/[0.08]",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
    </button>
  );
}

const DropBtn = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    icon: React.ElementType;
    label: string;
  }
>(({ icon: Icon, label, disabled, className, ...rest }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled}
      {...rest}
      className={cn(
        "flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium transition-colors duration-[120ms] cursor-pointer select-none whitespace-nowrap",
        "text-[#1f2937] dark:text-[#d4d4d4] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#4b5563] dark:text-[#d4d4d4]" />
      <span>{label}</span>
      <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
    </button>
  );
});
DropBtn.displayName = "DropBtn";

/* ── Dropdown content shared styles ─────────────────────────────────────────── */
const menuContentClass =
  "bg-white dark:bg-[#252526] border border-[#e5e7eb] dark:border-[#3a3a3a] shadow-lg text-xs rounded-lg p-1 min-w-[168px]";
const menuItemClass =
  "cursor-pointer flex items-center gap-2 rounded-md py-1.5 px-2.5 text-[#1f2937] dark:text-[#d4d4d4] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors duration-[100ms]";
const menuLabelClass =
  "text-[9px] text-[#6b7280] dark:text-[#9ca3af] uppercase font-bold px-2.5 py-1.5 tracking-wider";

export function ExplorerToolbar({
  segments,
  onNavigate,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  selectedCount,
  onNewFolder,
  onNewFile,
  onNewSubject,
  onUploadFile,
  onRename,
  onDelete,
  onProperties,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  canCreateFolder: _canCreateFolder,
  canUpload,
  onRefresh,
  isRefreshing = false,
  showQuickAccess,
  setShowQuickAccess,
  isFavorite,
  onToggleFavorite,
  showPreview,
  setShowPreview,
  onStudyWithAI,
  onGenerateSummary,
  onGenerateQuiz,
  canGoBack = false,
  canGoForward = false,
  canGoUp = false,
  onGoBack,
  onGoForward,
  onGoUp,
  onCut,
  onCopy,
  onPaste,
  hasClipboard = false,
}: ExplorerToolbarProps) {
  const isRoot = segments.length <= 1;

  const getSearchPlaceholder = (): string => {
    if (segments.length === 0) return "Search Subjects";
    const last = segments[segments.length - 1].label;
    switch (last) {
      case "Recycle Bin":   return "Search Recycle Bin";
      case "All Uploads":   return "Search Uploads";
      case "Assignments":   return "Search Assignments";
      case "Notes":         return "Search Notes";
      case "AI Generated":  return "Search AI Generated";
      case "Quizzes":       return "Search Quizzes";
      case "Subjects":      return "Search Subjects";
      default:
        // Inside a subject or folder
        return `Search Files`;
    }
  };
  const searchPlaceholder = getSearchPlaceholder();

  const handleShare = () => {
    // Sharing coming soon — no-op placeholder
  };

  return (
    <div
      className="flex flex-col shrink-0 border-b border-[#e5e7eb] dark:border-[#3a3a3a] select-none"
      style={{ backgroundColor: "var(--win-nav-bg, #f5f5f5)" }}
    >
      {/* ── ROW 1: Navigation Bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b border-[#e5e7eb] dark:border-[#3a3a3a]"
        style={{ backgroundColor: "var(--win-nav-bg, #f5f5f5)" }}
      >
        {/* Nav buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <NavBtn icon={ArrowLeft}  onClick={onGoBack}    disabled={!canGoBack}    title="Back (Alt+Left)"    />
          <NavBtn icon={ArrowRight} onClick={onGoForward} disabled={!canGoForward} title="Forward (Alt+Right)" />
          <NavBtn icon={ArrowUp}    onClick={onGoUp}      disabled={!canGoUp}      title="Up"                 />
          <NavBtn
            icon={RefreshCw}
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh (F5)"
          />
        </div>

        {/* Breadcrumb — fills remaining space */}
        <div className="flex-1 min-w-0">
          <ExplorerBreadcrumb segments={segments} onNavigate={onNavigate} />
        </div>

        {/* Search box */}
        <div className="relative shrink-0 w-72 sm:w-80 lg:w-96">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#6b7280] dark:text-[#9ca3af] pointer-events-none" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-7 h-8 text-[11px] rounded-md w-full",
              "bg-white dark:bg-[#252526]",
              "border border-[#d1d5db] dark:border-[#404040]",
              "text-[#1f2937] dark:text-white placeholder:text-[#9ca3af]",
              "focus-visible:ring-0 focus-visible:border-[#9ca3af] dark:focus-visible:border-[#6b7280]",
              "transition-colors duration-[120ms] shadow-none"
            )}
          />
        </div>
      </div>

      {/* ── ROW 2: Command Bar ────────────────────────────────────────────── */}
      <div
        className="h-10 flex items-center justify-between px-3 gap-2"
        style={{ backgroundColor: "var(--win-toolbar-bg, #ffffff)" }}
      >
        {/* ── Group 1: File operations ────────────────────────────────────── */}
        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar min-w-0">

          {/* New ▼ */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<DropBtn icon={Plus} label="New" />} />
            <DropdownMenuContent align="start" className={menuContentClass}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className={menuLabelClass}>Create New</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {isRoot ? (
                <DropdownMenuItem
                  onClick={onNewSubject}
                  disabled={!onNewSubject}
                  className={menuItemClass}
                >
                  <FolderPlus className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <span>New Subject</span>
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={onNewFolder}
                    disabled={!onNewFolder}
                    className={menuItemClass}
                  >
                    <FolderPlus className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>New Folder</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onNewFile}
                    disabled={!onNewFile}
                    className={menuItemClass}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <span>New File</span>
                  </DropdownMenuItem>
                  {onUploadFile && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={onUploadFile}
                        disabled={!canUpload}
                        className={menuItemClass}
                      >
                        <Upload className="h-3.5 w-3.5 shrink-0 text-[#6b7280] dark:text-[#9ca3af]" />
                        <span>Upload Files</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Sep />

          {/* Cut */}
          <CmdBtn
            icon={Scissors}
            label="Cut"
            onClick={onCut}
            disabled={selectedCount === 0}
            title="Cut"
            shortcut="Ctrl+X"
          />

          {/* Copy */}
          <CmdBtn
            icon={Copy}
            label="Copy"
            onClick={onCopy}
            disabled={selectedCount === 0}
            title="Copy"
            shortcut="Ctrl+C"
          />

          {/* Paste */}
          <CmdBtn
            icon={Clipboard}
            label="Paste"
            onClick={onPaste}
            disabled={!hasClipboard}
            title="Paste"
            shortcut="Ctrl+V"
          />

          <Sep />

          {/* Rename */}
          <CmdBtn
            icon={Pencil}
            label="Rename"
            onClick={onRename}
            disabled={selectedCount !== 1}
            title="Rename"
            shortcut="F2"
          />

          {/* Share */}
          <CmdBtn
            icon={Share2}
            label="Share"
            onClick={handleShare}
            disabled={selectedCount === 0}
            title="Share (coming soon)"
          />

          {/* Delete */}
          <CmdBtn
            icon={Trash2}
            label="Delete"
            onClick={onDelete}
            disabled={selectedCount === 0}
            title="Delete"
            shortcut="Del"
          />

          {/* AI tools — only when a file is selected */}
          {selectedCount > 0 && (onStudyWithAI || onGenerateSummary || onGenerateQuiz || onToggleFavorite || onProperties) && (
            <>
              <Sep />
              {onStudyWithAI && (
                <CmdBtn icon={Brain} label="Study" onClick={onStudyWithAI} title="Study with AI Assistant" />
              )}
              {onGenerateSummary && (
                <CmdBtn icon={FileText} label="Summary" onClick={onGenerateSummary} title="Generate AI Summary" />
              )}
              {onGenerateQuiz && (
                <CmdBtn icon={Zap} label="Quiz" onClick={onGenerateQuiz} title="Generate AI Quiz" />
              )}
              {selectedCount === 1 && onToggleFavorite && (
                <CmdBtn
                  icon={Star}
                  label={isFavorite ? "Unfavorite" : "Favorite"}
                  onClick={onToggleFavorite}
                  active={isFavorite}
                  title="Toggle Favorite"
                />
              )}
              {selectedCount === 1 && onProperties && (
                <CmdBtn icon={Info} label="Properties" onClick={onProperties} title="Properties (Alt+Enter)" />
              )}
            </>
          )}
        </div>

        {/* ── Group 2 + 3: Right side ─────────────────────────────────────── */}
        <div className="flex items-center gap-0.5 shrink-0">

          {/* Quick Access toggle */}
          <CmdBtn
            icon={Pin}
            label="Quick Access"
            onClick={() => setShowQuickAccess(!showQuickAccess)}
            active={showQuickAccess}
            title="Toggle Quick Access panel"
          />

          <Sep />

          {/* Sort ▼ */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<DropBtn icon={ArrowUpDown} label="Sort" />} />
            <DropdownMenuContent align="end" className={menuContentClass}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className={menuLabelClass}>Sort by</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {([
                ["name", "Name"],
                ["dateModified", "Date Modified"],
                ["dateCreated", "Date Created"],
                ["type", "Type"],
                ["size", "Size"],
              ] as [SortProperty, string][]).map(([field, label]) => (
                <DropdownMenuItem
                  key={field}
                  onClick={() => setSortBy(field)}
                  className={cn(menuItemClass, "relative pl-8 pr-3 flex items-center justify-between transition-all duration-150")}
                >
                  <div className="absolute left-2.5 flex items-center justify-center w-4 h-4">
                    {sortBy === field && <Check className="h-3.5 w-3.5 text-[#4b5563] dark:text-[#d4d4d4] shrink-0" />}
                  </div>
                  <span className={cn(sortBy === field && "font-semibold")}>{label}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setSortOrder("asc")}
                className={cn(menuItemClass, "relative pl-8 pr-3 flex items-center justify-between transition-all duration-150")}
              >
                <div className="absolute left-2.5 flex items-center justify-center w-4 h-4">
                  {sortOrder === "asc" && <Check className="h-3.5 w-3.5 text-[#4b5563] dark:text-[#d4d4d4] shrink-0" />}
                </div>
                <span>Ascending</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSortOrder("desc")}
                className={cn(menuItemClass, "relative pl-8 pr-3 flex items-center justify-between transition-all duration-150")}
              >
                <div className="absolute left-2.5 flex items-center justify-center w-4 h-4">
                  {sortOrder === "desc" && <Check className="h-3.5 w-3.5 text-[#4b5563] dark:text-[#d4d4d4] shrink-0" />}
                </div>
                <span>Descending</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View ▼ */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<DropBtn icon={LayoutGrid} label="View" />} />
            <DropdownMenuContent align="end" className={menuContentClass}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className={menuLabelClass}>Layout</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {([
                ["details",      "Details"],
                ["list",         "List"],
                ["tiles",        "Tiles"],
                ["large-icons",  "Large Icons"],
                ["medium-icons", "Medium Icons"],
                ["small-icons",  "Small Icons"],
              ] as [ViewMode, string][]).map(([mode, label]) => (
                <DropdownMenuItem
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(menuItemClass, "justify-between")}
                >
                  <span className={cn(viewMode === mode && "font-semibold")}>{label}</span>
                  {viewMode === mode && <Check className="h-3 w-3 text-[#4b5563] dark:text-[#d4d4d4] shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More ··· */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button
                title="More options"
                className="h-8 w-8 flex items-center justify-center rounded-md text-[#4b5563] dark:text-[#d4d4d4] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors duration-[120ms] cursor-pointer select-none"
              />
            }>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={menuContentClass}>
              <DropdownMenuItem
                onClick={() => {
                  const path = "Neuron OS" + segments.map((s) => ` > ${s.label}`).join("");
                  navigator.clipboard.writeText(path);
                }}
                className={menuItemClass}
              >
                <Copy className="h-3.5 w-3.5 shrink-0 text-[#6b7280]" />
                <span>Copy Path</span>
              </DropdownMenuItem>
              {selectedCount === 1 && onProperties && (
                <DropdownMenuItem onClick={onProperties} className={menuItemClass}>
                  <Info className="h-3.5 w-3.5 shrink-0 text-[#6b7280]" />
                  <span>Properties</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setShowQuickAccess(!showQuickAccess)}
                className={menuItemClass}
              >
                <Pin className="h-3.5 w-3.5 shrink-0 text-[#6b7280] rotate-45" />
                <span>Toggle Quick Access</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sep />

          {/* Preview toggle — far right, matches Windows position */}
          <IconBtn
            icon={showPreview ? PanelRightClose : PanelRight}
            onClick={() => setShowPreview(!showPreview)}
            active={showPreview}
            title={showPreview ? "Hide preview pane" : "Show preview pane"}
          />
        </div>
      </div>

      {/* CSS custom properties for light/dark theming */}
      <style>{`
        :root {
          --win-nav-bg: #f5f5f5;
          --win-toolbar-bg: #ffffff;
          --win-border: #e5e7eb;
        }
        .dark {
          --win-nav-bg: #1f1f1f;
          --win-toolbar-bg: #252526;
          --win-border: #3a3a3a;
        }
      `}</style>
    </div>
  );
}
