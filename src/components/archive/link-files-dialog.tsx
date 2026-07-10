"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Plus } from "lucide-react";
import { linkFilesToFolder } from "@/actions/folders";

export interface DocumentMini {
  id: string;
  title: string;
  file_type: string | null;
  folder_id: string | null;
  subject_id: string | null;
}

interface LinkFilesDialogProps {
  subjectId: string;
  folderId: string | null;
  folderName: string;
  allDocuments: DocumentMini[];
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function LinkFilesDialog({ 
  subjectId, 
  folderId, 
  folderName, 
  allDocuments,
  variant = "outline" 
}: LinkFilesDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Only show documents that are not already in this specific folder under this subject
  const availableDocuments = allDocuments.filter(
    d => !(d.subject_id === subjectId && d.folder_id === folderId)
  );

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;

    setLoading(true);
    setError("");

    try {
      await linkFilesToFolder(Array.from(selectedIds), subjectId, folderId);
      setOpen(false);
      setSelectedIds(newSet => { newSet.clear(); return newSet; });
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to link files.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setSelectedIds(newSet => { newSet.clear(); return newSet; });
        setError("");
      }
    }}>
      <DialogTrigger render={<Button variant={variant} size="sm" className="h-8 text-xs font-semibold" />}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Files
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Files to {folderName}</DialogTitle>
          <DialogDescription>
            Select files from your uploads to move them into this folder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="h-[300px] overflow-y-auto rounded-md border p-2 bg-muted/20">
            {availableDocuments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-4">
                <p className="text-sm text-muted-foreground">No available files found in your uploads.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {availableDocuments.map((doc) => (
                  <label 
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <input 
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedIds.has(doc.id)} 
                      onChange={() => toggleSelection(doc.id)}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <span className="text-sm font-medium truncate" title={doc.title}>{doc.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{doc.file_type || "Document"}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground font-medium">
              {selectedIds.size} file(s) selected
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || selectedIds.size === 0} className="min-w-[120px]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to Folder"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
