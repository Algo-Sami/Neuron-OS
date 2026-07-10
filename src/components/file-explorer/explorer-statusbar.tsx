"use client";

import React from "react";
import { HardDrive, MapPin, CheckCircle2 } from "lucide-react";

interface ExplorerStatusBarProps {
  selectedCount: number;
  totalFiles: number; // Current view files
  totalFolders: number; // Current view folders
  totalSubjects: number; // Current view subjects
  dbSubjectsCount: number; // Total subjects in db
  dbFoldersCount: number; // Total folders in db
  dbFilesCount: number; // Total files in db
  storageUsedMB?: number;
  currentSubjectName?: string | null;
}

export function ExplorerStatusBar({
  selectedCount,
  totalFiles,
  totalFolders,
  totalSubjects,
  dbSubjectsCount,
  dbFoldersCount,
  dbFilesCount,
  storageUsedMB = 0,
  currentSubjectName,
}: ExplorerStatusBarProps) {
  const storageLabel =
    storageUsedMB >= 1024
      ? `${(storageUsedMB / 1024).toFixed(2)} GB`
      : `${storageUsedMB.toFixed(1)} MB`;

  // Determine what counts to show for the current view
  const currentViewParts: string[] = [];
  if (totalSubjects > 0) currentViewParts.push(`${totalSubjects} Subject${totalSubjects !== 1 ? "s" : ""}`);
  if (totalFolders > 0) currentViewParts.push(`${totalFolders} Folder${totalFolders !== 1 ? "s" : ""}`);
  if (totalFiles > 0) currentViewParts.push(`${totalFiles} File${totalFiles !== 1 ? "s" : ""}`);
  const _currentViewLabel = currentViewParts.length > 0 ? currentViewParts.join(", ") : "Empty folder";

  return (
    <div className="h-8 shrink-0 border-t border-[#e5e5e5] dark:border-[#3a3a3a] bg-[#fafafa] dark:bg-[#1f1f1f] flex items-center justify-between px-4 select-none text-[12px] font-normal text-[#6b7280] dark:text-[#a3a3a3] rounded-b-lg">
      {/* Left: Selection + Current View counts */}
      <div className="flex items-center gap-0 overflow-hidden">
        {selectedCount > 0 ? (
          <>
            <span className="font-normal text-[#1f1f1f] dark:text-[#f3f3f3] whitespace-nowrap pr-3">
              {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
            </span>
            <span className="h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] mx-0 shrink-0" />
          </>
        ) : (
          <>
            <span className="font-normal whitespace-nowrap pr-3">Ready</span>
            <span className="h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] mx-0 shrink-0" />
          </>
        )}
        {totalSubjects > 0 && (
          <>
            <span className="whitespace-nowrap px-3">{totalSubjects} Subject{totalSubjects !== 1 ? "s" : ""}</span>
            {(totalFolders > 0 || totalFiles > 0 || currentSubjectName) && (
              <span className="h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] shrink-0" />
            )}
          </>
        )}
        {totalFolders > 0 && (
          <>
            <span className="whitespace-nowrap px-3">{totalFolders} Folder{totalFolders !== 1 ? "s" : ""}</span>
            {(totalFiles > 0 || currentSubjectName) && (
              <span className="h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] shrink-0" />
            )}
          </>
        )}
        {totalFiles > 0 && (
          <>
            <span className="whitespace-nowrap px-3">{totalFiles} File{totalFiles !== 1 ? "s" : ""}</span>
            {currentSubjectName && (
              <span className="h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] shrink-0" />
            )}
          </>
        )}
        {totalSubjects === 0 && totalFolders === 0 && totalFiles === 0 && (
          <>
            <span className="whitespace-nowrap px-3">0 items</span>
            {currentSubjectName && (
              <span className="h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] shrink-0" />
            )}
          </>
        )}

        {currentSubjectName && (
          <>
            <span className="flex items-center gap-1 min-w-0 overflow-hidden px-3">
              <MapPin className="h-3 w-3 text-[#6b7280]/50 dark:text-[#a3a3a3]/50 shrink-0" />
              <span className="truncate">{currentSubjectName}</span>
            </span>
          </>
        )}
      </div>

      {/* Right: Workspace totals + Storage + Sync status */}
      <div className="flex items-center gap-0 shrink-0">
        {/* Workspace Totals */}
        <div className="hidden md:flex items-center gap-1 font-normal pr-3">
          <span>Workspace:</span>
          <span className="text-[#6b7280] dark:text-[#a3a3a3]">
            {dbSubjectsCount} Subjects, {dbFoldersCount} Folders, {dbFilesCount} Files
          </span>
        </div>
        <span className="hidden md:block h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] shrink-0" />

        {/* Storage */}
        <div className="flex items-center gap-1 px-3">
          <HardDrive className="h-3 w-3 text-[#6b7280]/50 dark:text-[#a3a3a3]/50 shrink-0" />
          <span>{storageLabel} Used</span>
        </div>
        <span className="h-3 w-px bg-[#d0d0d0] dark:bg-[#4a4a4a] shrink-0" />

        {/* Sync state */}
        <div className="flex items-center gap-1 text-emerald-500 font-normal pl-3">
          <CheckCircle2 className="h-3 w-3" />
          <span>Synced · Updated just now</span>
        </div>
      </div>
    </div>
  );
}
