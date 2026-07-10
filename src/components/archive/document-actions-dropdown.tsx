"use client";

import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreVertical, Trash2, AlertTriangle, Loader2, RotateCcw, ExternalLink, Pencil } from "lucide-react";
import { moveDocumentToRecycleBin, restoreDocumentFromRecycleBin, deleteDocumentPermanently, renameDocument } from "@/actions/uploads";

interface DocumentActionsDropdownProps {
  documentId: string;
  documentTitle: string;
  fileUrl: string;
  isRecycled?: boolean;
  showPreview?: boolean;
  className?: string;
}

export function DocumentActionsDropdown({
  documentId,
  documentTitle,
  fileUrl,
  isRecycled = false,
  showPreview = true,
  className,
}: DocumentActionsDropdownProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [recycling, setRecycling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(documentTitle);
  const [renameError, setRenameError] = useState("");

  const handleRecycle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRecycling(true);
    try {
      await moveDocumentToRecycleBin(documentId);
    } catch (err) {
      console.error("Failed to recycle document:", err);
    } finally {
      setRecycling(false);
    }
  };

  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRecycling(true);
    try {
      await restoreDocumentFromRecycleBin(documentId);
    } catch (err) {
      console.error("Failed to restore document:", err);
    } finally {
      setRecycling(false);
    }
  };

  const handlePermanentDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteDocumentPermanently(documentId);
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error("Failed to delete document permanently:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!renameValue.trim()) {
      setRenameError("File name cannot be empty.");
      return;
    }
    setRenaming(true);
    setRenameError("");
    try {
      await renameDocument(documentId, renameValue.trim());
      setIsRenameDialogOpen(false);
    } catch (err) {
      setRenameError((err as Error).message || "Failed to rename file.");
    } finally {
      setRenaming(false);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const openRenameDialog = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRenameValue(documentTitle);
    setRenameError("");
    setIsRenameDialogOpen(true);
  };

  return (
    <>
      {/* Propagation shield to completely isolate dropdown interactions from any parent cards/links */}
      <div
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full border border-border/40 bg-card hover:bg-muted text-muted-foreground shadow-xs transition-colors duration-200"
              />
            }
          >
            {recycling ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-md border border-border/50 shadow-lg">
            {showPreview && fileUrl && (
              <DropdownMenuItem
                render={
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center cursor-pointer w-full"
                  />
                }
              >
                <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" />
                Preview File
              </DropdownMenuItem>
            )}

            {showPreview && fileUrl && <DropdownMenuSeparator />}

            {isRecycled ? (
              <>
                <DropdownMenuItem onClick={handleRestore} className="gap-2 cursor-pointer font-medium hover:bg-emerald-500/10 hover:text-emerald-500">
                  <RotateCcw className="h-4 w-4 text-emerald-500" />
                  Restore File
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={openDeleteDialog}
                  variant="destructive"
                  className="gap-2 cursor-pointer font-medium hover:bg-red-500/15 hover:text-red-500 focus:bg-red-500/15 focus:text-red-500 dark:focus:bg-red-500/25"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  Delete Permanently
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={openRenameDialog} className="gap-2 cursor-pointer font-medium hover:bg-accent">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleRecycle} className="gap-2 cursor-pointer font-medium hover:bg-accent">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                  Move to Recycle Bin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={openDeleteDialog}
                  variant="destructive"
                  className="gap-2 cursor-pointer font-medium hover:bg-red-500/15 hover:text-red-500 focus:bg-red-500/15 focus:text-red-500 dark:focus:bg-red-500/25"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  Delete Permanently
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card/98 backdrop-blur-lg border border-border/60 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Rename File</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter a new display name for this document.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">File Name</label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter new file name"
                disabled={renaming}
                maxLength={100}
                autoFocus
              />
            </div>
            {renameError && <p className="text-xs text-red-500 font-medium">{renameError}</p>}
            <div className="flex items-center justify-end gap-2 mt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRenameDialogOpen(false)}
                disabled={renaming}
                className="text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={renaming || !renameValue.trim()}
                className="text-xs font-semibold min-w-[100px]"
              >
                {renaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Safety Hard-Delete Dialogue Portal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card/98 backdrop-blur-lg border border-border/60 shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 mb-4 animate-pulse">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Are you absolutely sure?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 max-w-xs leading-normal">
              You are about to permanently delete **{documentTitle}**. This will erase the file, purge it from Supabase cloud storage, and remove all associated AI notes, quizzes, and embeddings.
              <br />
              <span className="font-bold text-red-500 mt-1.5 block">This action is irreversible.</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePermanentDelete} className="flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-end gap-2.5 mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleting}
                className="text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Cancel, Keep File
              </Button>
              <Button
                type="submit"
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs min-w-[120px] shadow-md shadow-red-500/15"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Delete Permanently"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
