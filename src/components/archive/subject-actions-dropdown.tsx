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
import { MoreVertical, Trash2, AlertTriangle, Loader2, RotateCcw, Pencil } from "lucide-react";
import { moveToRecycleBin, deleteSubjectPermanently, restoreFromRecycleBin, renameSubject } from "@/actions/subjects";

interface SubjectActionsDropdownProps {
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
  isRecycled?: boolean;
  className?: string;
}

export function SubjectActionsDropdown({
  subjectId,
  subjectName,
  subjectCode,
  isRecycled = false,
  className,
}: SubjectActionsDropdownProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [recycling, setRecycling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(subjectName);
  const [codeValue, setCodeValue] = useState(subjectCode || "");
  const [renameError, setRenameError] = useState("");

  const handleRecycle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRecycling(true);
    try {
      await moveToRecycleBin(subjectId);
    } catch (err) {
      console.error("Failed to recycle subject:", err);
    } finally {
      setRecycling(false);
    }
  };

  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRecycling(true);
    try {
      await restoreFromRecycleBin(subjectId);
    } catch (err) {
      console.error("Failed to restore subject:", err);
    } finally {
      setRecycling(false);
    }
  };

  const handlePermanentDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteSubjectPermanently(subjectId);
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error("Failed to delete subject permanently:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!renameValue.trim()) {
      setRenameError("Subject name cannot be empty.");
      return;
    }
    setRenaming(true);
    setRenameError("");
    try {
      await renameSubject(subjectId, renameValue.trim(), codeValue.trim());
      setIsRenameDialogOpen(false);
    } catch (err) {
      setRenameError((err as Error).message || "Failed to rename subject.");
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
    setRenameValue(subjectName);
    setCodeValue(subjectCode || "");
    setRenameError("");
    setIsRenameDialogOpen(true);
  };

  return (
    <>
      {/* Wrapper with propagation interception to completely shield parent links */}
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
                className="h-8 w-8 rounded-full border border-border/50 bg-card/60 backdrop-blur-xs hover:bg-accent/80 hover:text-accent-foreground text-muted-foreground shadow-xs transition-colors duration-200"
              />
            }
          >
            {recycling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-md border border-border/50 shadow-lg">
            {isRecycled ? (
              <>
                <DropdownMenuItem onClick={handleRestore} className="gap-2 cursor-pointer font-medium hover:bg-emerald-500/10 hover:text-emerald-500">
                  <RotateCcw className="h-4 w-4 text-emerald-500" />
                  Restore Course
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
            <DialogTitle className="text-base font-bold text-foreground">Rename Subject</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update the name and course code for this subject portal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Subject Name</label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="e.g. Data Structures"
                disabled={renaming}
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Course Code <span className="text-muted-foreground font-normal">(Optional)</span></label>
              <Input
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                placeholder="e.g. CS201"
                disabled={renaming}
                maxLength={15}
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
              You are about to permanently delete **{subjectName}**. This will immediately destroy the portal and erase all associated topic folders, quizzes, summaries, and documents from your account.
              <br />
              <span className="font-bold text-red-500 mt-1.5 block">This action cannot be undone.</span>
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
                Cancel, Keep It
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
