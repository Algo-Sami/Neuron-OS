"use client";

import React from "react";
import { HardDrive, MapPin } from "lucide-react";

interface ExplorerStatusBarProps {
  selectedCount: number;
  totalFiles: number;
  totalFolders: number;
  storageUsedMB?: number;
  currentSubjectName?: string | null;
}

export function ExplorerStatusBar({
  selectedCount,
  totalFiles,
  totalFolders,
  storageUsedMB = 0,
  currentSubjectName,
}: ExplorerStatusBarProps) {
  const storageLabel =
    storageUsedMB >= 1024
      ? `${(storageUsedMB / 1024).toFixed(2)} GB`
      : `${storageUsedMB.toFixed(1)} MB`;

  return (
    <div className="h-7 shrink-0 border-t border-border/40 bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 select-none">
      {/* Left: selection + counts */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 overflow-hidden">
        {selectedCount > 0 ? (
          <span className="font-semibold text-primary whitespace-nowrap">
            {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
          </span>
        ) : (
          <span className="whitespace-nowrap">Ready</span>
        )}

        <span className="text-border/60">|</span>
        <span className="whitespace-nowrap">{totalFolders} Folder{totalFolders !== 1 ? "s" : ""}</span>
        <span className="text-border/60">|</span>
        <span className="whitespace-nowrap">{totalFiles} File{totalFiles !== 1 ? "s" : ""}</span>

        {currentSubjectName && (
          <>
            <span className="text-border/60">|</span>
            <span className="flex items-center gap-1 min-w-0 overflow-hidden">
              <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="truncate">{currentSubjectName}</span>
            </span>
          </>
        )}
      </div>

      {/* Right: storage */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 shrink-0">
        <HardDrive className="h-3 w-3 text-muted-foreground/50" />
        <span>{storageLabel} used</span>
      </div>
    </div>
  );
}
