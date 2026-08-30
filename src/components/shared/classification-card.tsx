"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, ChevronRight, Settings, Trash2, Loader2, AlertCircle, FolderOpen } from "lucide-react";
import {
  confirmAIClassification,
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

// ── Subject Picker Dialog ───────────────────────────────────────────────────

interface SubjectPickerDialogProps {
  open: boolean;
  onClose: () => void;
  doc: PendingDoc | null;
  subjects: SubjectItem[];
  onAssign: (docId: string, subjectName: string, topic: string) => void;
  isPending: boolean;
}

function SubjectPickerDialog({ open, onClose, doc, subjects, onAssign, isPending }: SubjectPickerDialogProps) {
  const initialMatchedSubject = React.useMemo(() => {
    if (!doc) return null;
    return subjects.find(
      (s) =>
        s.name.toLowerCase() === (doc.ai_subject || "").toLowerCase() ||
        (doc.ai_subject && s.name.toLowerCase().startsWith(doc.ai_subject.toLowerCase()))
    );
  }, [doc, subjects]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => initialMatchedSubject?.id || "");
  const [customFolder, setCustomFolder] = useState<string>(() => doc?.ai_topic || "Lectures");

  const DEFAULT_TOPICS = ["Lectures", "Assignments", "Quizzes", "Presentations", "Lab", "Projects", "Notes"];

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const handleSave = () => {
    if (!doc || !selectedSubject) return;
    onAssign(doc.id, selectedSubject.name, customFolder || "Lectures");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-purple-500" />
            Assign to Subject
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Select which subject this file belongs to.
            {doc && (
              <span className="block mt-1.5 text-foreground/80 font-medium truncate">
                📄 {doc.title}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Subject Selection */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Select Subject
            </label>
            <div className="mt-2 grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No subjects found. Create a subject first.
                </p>
              ) : (
                subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubjectId(s.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all duration-150",
                      selectedSubjectId === s.id
                        ? "border-purple-500/60 bg-purple-500/10 text-foreground"
                        : "border-border/40 bg-background/60 text-muted-foreground hover:border-border hover:bg-background/90 hover:text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                        selectedSubjectId === s.id
                          ? "border-purple-500 bg-purple-500"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {selectedSubjectId === s.id && (
                        <Check className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{s.name}</p>
                      {s.code && (
                        <p className="text-[10px] text-muted-foreground">{s.code}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Folder / Topic */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Destination Folder
            </label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DEFAULT_TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setCustomFolder(topic)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition-all",
                    customFolder === topic
                      ? "border-purple-500/60 bg-purple-500/10 text-purple-400 font-semibold"
                      : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
            <Input
              placeholder="Or type custom folder name..."
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
              className="h-7 text-xs bg-background mt-2"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={onClose}
            className="text-xs h-8 px-4 text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isPending || !selectedSubjectId}
            onClick={handleSave}
            className="text-xs h-8 px-5 bg-purple-600 hover:bg-purple-700 text-white font-medium gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Assign & Organize
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Classification Card ─────────────────────────────────────────────────

export function ClassificationCard({ pendingDocs, subjects = [] }: ClassificationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [customSubject, setCustomSubject] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PendingDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // Subject picker dialog state
  const [pickerDoc, setPickerDoc] = useState<PendingDoc | null>(null);

  const activeDocs = pendingDocs.filter((d) => !deletedIds.includes(d.id));

  if (!activeDocs || activeDocs.length === 0) return null;

  const handleConfirm = (docId: string) => {
    startTransition(async () => {
      try {
        await confirmAIClassification(docId);
        router.refresh();
      } catch (err) {
        console.error("Failed to confirm classification:", err);
      }
    });
  };

  const handleCustomizeSave = (docId: string) => {
    if (!customSubject.trim() || !customTopic.trim()) return;
    startTransition(async () => {
      try {
        await rejectOrCustomizeClassification(docId, customSubject, customTopic);
        setEditingDocId(null);
        setCustomSubject("");
        setCustomTopic("");
        router.refresh();
      } catch (err) {
        console.error("Failed to customize classification:", err);
      }
    });
  };

  const handlePickerAssign = (docId: string, subjectName: string, topic: string) => {
    startTransition(async () => {
      try {
        await rejectOrCustomizeClassification(docId, subjectName, topic);
        setPickerDoc(null);
        router.refresh();
      } catch (err) {
        console.error("Failed to assign subject:", err);
      }
    });
  };

  const startEditing = (doc: PendingDoc) => {
    setEditingDocId(doc.id);
    setCustomSubject(doc.ai_subject || "");
    setCustomTopic(doc.ai_topic || "");
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
    } catch (err: any) {
      console.error("Failed to delete pending upload:", err);
      setDeleteError("Unable to delete this upload. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary/90">
          <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
          <span>AI Auto-Classification Pending Approval ({activeDocs.length})</span>
        </div>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 p-3 rounded-lg animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {activeDocs.map((doc) => {
          const confidencePct = Math.round((doc.classification_confidence || 0) * 100);
          const isEditing = editingDocId === doc.id;
          const hasSubjectSuggestion = !!(doc.ai_subject && doc.ai_subject !== "General Study");

          return (
            <div
              key={doc.id}
              className="relative overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-background to-card p-5 shadow-md backdrop-blur-md transition-all duration-300"
            >
              {/* Colored side-border effect */}
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-purple-500 to-indigo-600" />

              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider">
                      {doc.ai_doc_type || "Lecture Material"}
                    </p>
                    <h3 className="font-semibold text-foreground text-sm mt-0.5 truncate pr-2" title={doc.title}>
                      {doc.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full text-xs font-medium border border-purple-500/25">
                      <span>{confidencePct}% Match</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete upload"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(doc);
                      }}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>

                {!isEditing ? (
                  <>
                    {/* Suggested Course Location Details */}
                    <div className="flex items-center gap-4 bg-muted/30 p-2.5 rounded-lg border border-border/50 text-xs">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">Suggested Subject</span>
                        <span className={cn("font-medium truncate", !hasSubjectSuggestion ? "text-amber-500 dark:text-amber-400 font-semibold" : "text-foreground")}>
                          {hasSubjectSuggestion ? doc.ai_subject : "Unassigned — Select Subject"}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">Suggested Folder</span>
                        <span className="font-medium text-foreground truncate">{doc.ai_topic || "Lectures"}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(doc);
                        }}
                        className="text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => startEditing(doc)}
                          className="text-xs h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Settings className="mr-1.5 h-3.5 w-3.5" />
                          Customize
                        </Button>
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            if (!hasSubjectSuggestion) {
                              // Open the subject picker dialog with user's real subjects
                              setPickerDoc(doc);
                            } else {
                              handleConfirm(doc.id);
                            }
                          }}
                          className="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          {!hasSubjectSuggestion ? "Choose Subject" : "Confirm & Organize"}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Custom Organization Form */
                  <div className="flex flex-col gap-3 mt-1 bg-muted/40 p-3 rounded-lg border border-border/80">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Specify Subject & Folder Location
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-semibold text-muted-foreground">Subject Name</label>
                        <Input
                          placeholder="e.g. Operating Systems"
                          value={customSubject}
                          list="user-subjects-list"
                          onChange={(e) => setCustomSubject(e.target.value)}
                          className="h-7 text-xs bg-background"
                        />
                        <datalist id="user-subjects-list">
                          {subjects.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.code ? `${s.code} – ${s.name}` : s.name}
                            </option>
                          ))}
                        </datalist>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-semibold text-muted-foreground">Folder/Topic Name</label>
                        <Input
                          placeholder="e.g. Process Management"
                          value={customTopic}
                          onChange={(e) => setCustomTopic(e.target.value)}
                          className="h-7 text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(doc);
                        }}
                        className="text-[11px] h-6 px-2 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => setEditingDocId(null)}
                          className="text-[11px] h-6 px-2 text-muted-foreground"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={isPending || !customSubject.trim() || !customTopic.trim()}
                          onClick={() => handleCustomizeSave(doc.id)}
                          className="text-[11px] h-6 px-2 bg-foreground text-background hover:bg-foreground/90 font-medium"
                        >
                          Save Course Path
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subject Picker Dialog — shown when "Choose Subject" is clicked */}
      <SubjectPickerDialog
        key={pickerDoc?.id ?? 'closed'}
        open={pickerDoc !== null}
        onClose={() => setPickerDoc(null)}
        doc={pickerDoc}
        subjects={subjects}
        onAssign={handlePickerAssign}
        isPending={isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md bg-card/98 border border-border/60 shadow-2xl backdrop-blur-lg rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Delete Upload?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Are you sure you want to delete this file? This will remove the uploaded file and its pending classification request. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="my-2 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
              <p className="font-semibold text-foreground truncate">{deleteTarget.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Suggested Subject: {deleteTarget.ai_subject || "Unassigned"}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-border/30">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
              className="text-xs h-8 px-4 border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
              className="text-xs h-8 px-4 bg-red-600 hover:bg-red-700 text-white font-medium gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
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
    </div>
  );
}
