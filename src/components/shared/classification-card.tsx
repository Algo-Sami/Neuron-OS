"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
  FolderOpen,
  Check,
} from "lucide-react";
import {
  rejectOrCustomizeClassification,
  deletePendingUpload,
} from "@/actions/uploads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface PendingDoc {
  id: string;
  title: string;
  ai_subject: string | null;
  ai_topic: string | null;
  ai_doc_type: string | null;
  classification_confidence: number | null;
}

interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
}

interface ClassificationCardProps {
  pendingDocs: PendingDoc[];
  subjects?: SubjectItem[];
}

// ── Review Dialog (Confirm File Location) ───────────────────────────────────

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  doc: PendingDoc | null;
  subjects: SubjectItem[];
  onAssign: (docId: string, subjectName: string, topic: string) => void;
  isPending: boolean;
}

const DEFAULT_FOLDERS = [
  "Lectures",
  "Assignments",
  "Quizzes",
  "Presentations",
  "Lab",
  "Projects",
  "Notes",
];

export function ReviewDialog({
  open,
  onClose,
  doc,
  subjects,
  onAssign,
  isPending,
}: ReviewDialogProps) {
  const initialMatchedSubject = React.useMemo(() => {
    if (!doc) return null;
    return subjects.find(
      (s) =>
        s.name.toLowerCase() === (doc.ai_subject || "").toLowerCase() ||
        (doc.ai_subject &&
          s.name.toLowerCase().startsWith(doc.ai_subject.toLowerCase()))
    );
  }, [doc, subjects]);

  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(subjects.length === 0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    () => initialMatchedSubject?.id || ""
  );
  const [newSubjectName, setNewSubjectName] = useState<string>(
    () => (doc?.ai_subject && doc.ai_subject !== "General Study" ? doc.ai_subject : "")
  );
  const [selectedFolder, setSelectedFolder] = useState<string>(
    () => doc?.ai_topic || "Lectures"
  );
  const [customFolder, setCustomFolder] = useState<string>("");

  const [prevDocId, setPrevDocId] = useState<string | null>(doc?.id || null);

  // Adjust state during render when a different document is selected
  if (doc && doc.id !== prevDocId) {
    setPrevDocId(doc.id);
    const match = subjects.find(
      (s) =>
        s.name.toLowerCase() === (doc.ai_subject || "").toLowerCase() ||
        (doc.ai_subject &&
          s.name.toLowerCase().startsWith(doc.ai_subject.toLowerCase()))
    );
    if (subjects.length === 0) {
      setIsCreatingNew(true);
      setNewSubjectName(doc.ai_subject && doc.ai_subject !== "General Study" ? doc.ai_subject : "");
    } else {
      setIsCreatingNew(!match && !subjects[0]);
      setSelectedSubjectId(match?.id || (subjects[0]?.id ?? ""));
      setNewSubjectName(doc.ai_subject && doc.ai_subject !== "General Study" ? doc.ai_subject : "");
    }
    setSelectedFolder(doc.ai_topic || "Lectures");
    setCustomFolder("");
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const effectiveFolder = customFolder.trim() || selectedFolder || "Lectures";
  const effectiveSubjectName = isCreatingNew
    ? newSubjectName.trim()
    : selectedSubject?.name || "";

  const canSave = effectiveSubjectName.length > 0;

  const handleSave = () => {
    if (!doc || !canSave) return;
    onAssign(doc.id, effectiveSubjectName, effectiveFolder);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-xl backdrop-blur-md rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Confirm File Location
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Where should this file go? Choose an existing subject or create a new one.
          </DialogDescription>
        </DialogHeader>

        {doc && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground truncate">{doc.title}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 mt-1">
          {/* Subject Selector / Creator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Subject
              </label>
              {subjects.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(!isCreatingNew)}
                  className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                >
                  {isCreatingNew ? "← Select Existing" : "+ Create New Subject"}
                </button>
              )}
            </div>

            {isCreatingNew || subjects.length === 0 ? (
              <div className="space-y-1.5">
                <Input
                  placeholder="Enter new subject name (e.g. Programming Practices)…"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="h-8.5 text-xs bg-background border-primary/40 focus-visible:ring-primary/40"
                  autoFocus
                />
                {doc?.ai_subject && doc.ai_subject !== "General Study" && newSubjectName !== doc.ai_subject && (
                  <button
                    type="button"
                    onClick={() => setNewSubjectName(doc.ai_subject || "")}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Suggestion:</span>
                    <span className="font-semibold text-primary underline">
                      {doc.ai_subject}
                    </span>
                  </button>
                )}
                {subjects.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    This subject will be created automatically and your file will be saved inside it.
                  </p>
                )}
              </div>
            ) : (
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background text-foreground text-xs px-3 py-2 outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors cursor-pointer"
              >
                <option value="" disabled>
                  Select a subject
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Folder Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Folder
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_FOLDERS.map((topic) => (
                <button
                  type="button"
                  key={topic}
                  onClick={() => {
                    setSelectedFolder(topic);
                    setCustomFolder("");
                  }}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer",
                    selectedFolder === topic && !customFolder
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
            <Input
              placeholder="Or type custom folder name…"
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
              className="h-8 text-xs bg-background mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={onClose}
            className="text-xs h-8 px-4 text-muted-foreground cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isPending || !canSave}
            onClick={handleSave}
            className="text-xs h-8 px-5 gap-1.5 cursor-pointer font-medium"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                {isCreatingNew || subjects.length === 0 ? "Create & Save" : "Save"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Needs Your Attention Section ──────────────────────────────────────

export function ClassificationCard({
  pendingDocs,
  subjects = [],
}: ClassificationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [reviewDoc, setReviewDoc] = useState<PendingDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PendingDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const activeDocs = pendingDocs.filter((d) => !deletedIds.includes(d.id));

  // Section 6: If zero pending files, completely hide the section.
  if (activeDocs.length === 0) return null;

  const handleReviewAssign = (
    docId: string,
    subjectName: string,
    topic: string
  ) => {
    startTransition(async () => {
      try {
        await rejectOrCustomizeClassification(docId, subjectName, topic);
        setReviewDoc(null);
        router.refresh();
      } catch (err) {
        console.error("Failed to assign subject:", err);
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePendingUpload(deleteTarget.id);
      setDeletedIds((prev) => [...prev, deleteTarget.id]);
      setDeleteTarget(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      console.error("Failed to delete pending upload:", err);
      setDeleteError("Unable to delete this upload. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section aria-labelledby="needs-attention-heading" className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="needs-attention-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <span>Needs Your Attention</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {activeDocs.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Files that need your confirmation before they can be organized.
          </p>
        </div>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 p-3 rounded-lg animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {activeDocs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-card/60 hover:bg-card/90 transition-all duration-150"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <FileText className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-xs font-medium text-foreground truncate"
                  title={doc.title}
                >
                  {doc.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Subject needs confirmation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending || isDeleting}
                onClick={() => {
                  setDeleteError(null);
                  setReviewDoc(doc);
                }}
                className="text-xs h-7 px-2.5 cursor-pointer font-medium"
              >
                Review
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${doc.title}`}
                disabled={isPending || isDeleting}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(doc);
                }}
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Review Dialog */}
      <ReviewDialog
        key={reviewDoc?.id ?? "closed"}
        open={reviewDoc !== null}
        onClose={() => setReviewDoc(null)}
        doc={reviewDoc}
        subjects={subjects}
        onAssign={handleReviewAssign}
        isPending={isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-xl backdrop-blur-md rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Delete Upload?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Are you sure you want to delete this file? This will remove the
              uploaded file and its pending classification request. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="my-2 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
              <p className="font-medium text-foreground truncate">
                {deleteTarget.title}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-border/30">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
              className="text-xs h-8 px-4 border-border text-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="text-xs h-8 px-4 font-medium gap-1.5 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
