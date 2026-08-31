"use client";

import React, { useState } from "react";
import { FileText, Copy, X, Loader2, Folder, Calendar, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/services/storage/file-metadata";

export interface DuplicateUploadDialogProps {
  open: boolean;
  fileName: string;
  suggestedCopyName?: string;
  existingFileInfo?: {
    id: string;
    name: string;
    subjectName?: string | null;
    folderName?: string | null;
    size?: number | null;
    createdAt?: string;
  };
  onUploadAsCopy: (copyName: string) => Promise<void> | void;
  onCancel: () => void;
}

export function DuplicateUploadDialog({
  open,
  fileName,
  suggestedCopyName,
  existingFileInfo,
  onUploadAsCopy,
  onCancel,
}: DuplicateUploadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const nextName = suggestedCopyName || `${fileName} (1)`;

  const handleCopyClick = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUploadAsCopy(nextName);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  const locationPath = [
    existingFileInfo?.subjectName,
    existingFileInfo?.folderName,
  ]
    .filter(Boolean)
    .join(" › ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-card border border-border/80 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3
                id="duplicate-dialog-title"
                className="text-sm font-semibold text-foreground leading-tight"
              >
                File Already Exists
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                A file with this name already exists in this location.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Filename Box */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/40 space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Duplicate File
            </span>
            <p className="font-medium text-foreground text-xs break-all" title={fileName}>
              {fileName}
            </p>
          </div>

          {/* Existing File Details Pill (if available) */}
          {existingFileInfo && (
            <div className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-2 text-[11px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Saved File Location
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                {locationPath && (
                  <div className="flex items-center gap-1.5 col-span-full">
                    <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate font-medium text-foreground">{locationPath}</span>
                  </div>
                )}
                {existingFileInfo.size !== undefined && existingFileInfo.size !== null && (
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3 w-3 shrink-0" />
                    <span>{formatFileSize(existingFileInfo.size)}</span>
                  </div>
                )}
                {existingFileInfo.createdAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{formatDate(existingFileInfo.createdAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Copy Option Preview */}
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Suggested Copy Name
            </span>
            <p className="font-medium text-foreground text-xs break-all">
              {nextName}
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Choose <span className="font-medium text-foreground">Upload as Copy</span> to save the new file with an incremented name, or <span className="font-medium text-foreground">Cancel</span> to skip this upload.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border/40 bg-secondary/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs h-8 px-3.5 rounded-lg border-border/60 hover:bg-secondary cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCopyClick}
            disabled={isSubmitting}
            className="text-xs h-8 px-3.5 gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Creating copy...</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Upload as Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
