"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useTransition,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  File,
  FileText,
  Image as ImageIcon,
  Archive,
  X,
  AlertCircle,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ExternalLink,
  Download,
  Trash2,
  BrainCircuit,
  ScrollText,
  HelpCircle,
  Calendar,
  HardDrive,
  Tag,
  Filter,
  Check,
  RotateCw,
  Clock,
  Sparkles,
  Layers,
  Eye,
  Folder,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveUploadMetadata, moveDocumentToRecycleBin } from "@/actions/uploads";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings-store";
import { classifyFile } from "@/services/ai/ai-classification";
import { AIStudyPackDialog } from "./ai-study-pack-dialog";
import { ClassificationCard, type PendingDoc } from "@/components/shared/classification-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubjectItem {
  id: string;
  name: string;
  color?: string | null;
  code?: string | null;
}

interface DocumentRow {
  id: string;
  title: string;
  file_type: string | null;
  file_url: string | null;
  created_at: string;
  summary_status: string | null;
  quiz_status: string | null;
  classification_status?: string | null;
  ai_subject: string | null;
  ai_topic: string | null;
  subject_id: string | null;
  folder_id?: string | null;
  uploads?: { file_size: number | null } | null;
}

interface UploadCenterProps {
  documents: DocumentRow[];
  subjects: SubjectItem[];
  pendingDocs?: PendingDoc[];
}

type QueueItemStatus =
  | "waiting"
  | "uploading"
  | "classifying"
  | "success"
  | "needs_review"
  | "error";

interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: QueueItemStatus;
  progress: number;
  errorMsg?: string;
  documentId?: string;
  destinationSubject?: string | null;
  destinationFolder?: string | null;
  abortController?: AbortController;
}

type SortKey = "date" | "name" | "type" | "subject";
type SortDir = "asc" | "desc";
type FormatFilterKey = "all" | "pdf" | "docx" | "pptx" | "txt" | "image";
type StatusFilterKey = "all" | "completed" | "processing" | "needs_review" | "failed";

const ITEMS_PER_PAGE = 15;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const VALID_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getFileIcon(type: string | null | undefined, className = "h-4 w-4") {
  const t = (type || "").toLowerCase();
  if (t === "pdf") return <FileText className={cn(className, "text-red-500")} />;
  if (t === "docx" || t === "doc") return <FileText className={cn(className, "text-blue-500")} />;
  if (t === "pptx" || t === "ppt") return <FileText className={cn(className, "text-orange-500")} />;
  if (t === "txt") return <FileText className={cn(className, "text-muted-foreground")} />;
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(t))
    return <ImageIcon className={cn(className, "text-emerald-500")} />;
  if (t === "zip" || t === "rar") return <Archive className={cn(className, "text-amber-500")} />;
  return <File className={cn(className, "text-muted-foreground")} />;
}

function getStatusBadge(
  summaryStatus: string | null,
  quizStatus: string | null,
  classificationStatus?: string | null
) {
  if (classificationStatus === "needs_review" || classificationStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Needs Review
      </span>
    );
  }

  const isProcessing =
    summaryStatus === "processing" || quizStatus === "processing";
  const isFailed =
    summaryStatus === "failed" || quizStatus === "failed";
  const isCompleted =
    (summaryStatus === "completed" || summaryStatus === "pending" || summaryStatus === null) &&
    quizStatus !== "processing" &&
    quizStatus !== "failed";

  if (isProcessing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        Processing
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }
  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border/50">
      Uploaded
    </span>
  );
}

function isImageType(type: string | null | undefined) {
  return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes((type || "").toLowerCase());
}

// ---------------------------------------------------------------------------
// Phase 3: Lightweight Status & Statistics Overview
// ---------------------------------------------------------------------------

function UploadStatisticsStrip({
  documents,
  pendingCount,
}: {
  documents: DocumentRow[];
  pendingCount: number;
}) {
  const totalCount = documents.length;

  const completedCount = useMemo(() => {
    return documents.filter((d) => {
      return (
        d.summary_status === "completed" ||
        d.quiz_status === "completed" ||
        (d.classification_status !== "needs_review" &&
          d.summary_status !== "processing" &&
          d.summary_status !== "failed" &&
          d.quiz_status !== "failed")
      );
    }).length;
  }, [documents]);

  const processingCount = useMemo(() => {
    return documents.filter(
      (d) => d.summary_status === "processing" || d.quiz_status === "processing"
    ).length;
  }, [documents]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border/60 bg-card/60">
        <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Layers className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Total Uploads
          </p>
          <p className="text-sm font-semibold text-foreground">{totalCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border/60 bg-card/60">
        <div className="h-8 w-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Completed
          </p>
          <p className="text-sm font-semibold text-foreground">{completedCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border/60 bg-card/60">
        <div className="h-8 w-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Processing
          </p>
          <p className="text-sm font-semibold text-foreground">{processingCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border/60 bg-card/60">
        <div
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center shrink-0 border",
            pendingCount > 0
              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              : "bg-secondary border-border/40 text-muted-foreground"
          )}
        >
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Needs Review
          </p>
          <p className="text-sm font-semibold text-foreground">{pendingCount}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 & 3: Smart Upload Area (Multi-file, Queue, Progress, Destination Feedback)
// ---------------------------------------------------------------------------

function UploadArea({
  subjects,
  onUploadComplete,
  dropZoneRef,
}: {
  subjects: SubjectItem[];
  onUploadComplete: () => void;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const settings = useSettingsStore();

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<{
    documentId: string;
    fileUrl: string;
    fileType: string;
    fileName: string;
    fileTypeLabel: string;
  } | null>(null);

  // Validate single file
  const validateFile = (f: File): string | null => {
    if (f.size <= 0) return `"${f.name}" is an empty file.`;
    if (f.size > MAX_FILE_SIZE) return `"${f.name}" exceeds the 50 MB limit.`;
    const hasValid = VALID_EXTENSIONS.some((ext) =>
      f.name.toLowerCase().endsWith(ext)
    );
    if (!hasValid) {
      return `"${f.name}" has an unsupported file type. Supported: PDF · DOCX · PPTX · TXT · Images`;
    }
    return null;
  };

  // Handle incoming files (drag-drop or file picker)
  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const newErrors: string[] = [];
    const validItems: UploadQueueItem[] = [];

    files.forEach((f) => {
      const err = validateFile(f);
      if (err) {
        newErrors.push(err);
        return;
      }

      const isDuplicate = queue.some(
        (item) =>
          item.name === f.name &&
          item.size === f.size &&
          item.status !== "error" &&
          item.status !== "success"
      );
      if (isDuplicate) {
        newErrors.push(`"${f.name}" is already in the upload queue.`);
        return;
      }

      const ext = f.name.split(".").pop()?.toLowerCase() || "unknown";
      validItems.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${f.name}`,
        file: f,
        name: f.name,
        size: f.size,
        type: ext,
        status: "waiting",
        progress: 0,
      });
    });

    if (newErrors.length > 0) {
      setValidationErrors((prev) => [...prev, ...newErrors]);
    }

    if (validItems.length > 0) {
      setQueue((prev) => [...prev, ...validItems]);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Upload single queue item
  const uploadItem = useCallback(
    async (item: UploadQueueItem) => {
      const abortController = new AbortController();

      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: "uploading", progress: 15, abortController }
            : q
        )
      );

      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();
        if (authErr || !user) throw new Error("Please log in to upload files.");

        const cleanName = item.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${user.id}/${Date.now()}_${cleanName}`;

        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, progress: 45 } : q))
        );

        // Upload to Supabase Storage
        const { error: storageErr } = await supabase.storage
          .from("documents")
          .upload(filePath, item.file, {
            cacheControl: "3600",
            upsert: false,
          });
        if (storageErr) throw storageErr;

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, progress: 80, status: "classifying" } : q
          )
        );

        const {
          data: { publicUrl },
        } = supabase.storage.from("documents").getPublicUrl(filePath);

        // Save metadata & classify
        const result = await saveUploadMetadata({
          fileName: item.name,
          fileUrl: publicUrl,
          fileType: item.type,
          fileSize: item.size,
          subjectId: selectedSubjectId || undefined,
        });

        if (!result?.success || !result?.documentId) {
          throw new Error("Failed to save document metadata.");
        }

        const isNeedsReview = result.classificationStatus === "needs_review";
        const destinationSubject = result.subjectName || null;
        const destinationFolder = result.labSubfolderName || result.folderName || null;

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  progress: 100,
                  status: isNeedsReview ? "needs_review" : "success",
                  documentId: result.documentId,
                  destinationSubject,
                  destinationFolder,
                }
              : q
          )
        );

        // AI study pack dispatch check
        const classification = classifyFile(item.name);
        const fireStudyPack = async () => {
          try {
            await fetch("/api/generate-study-pack", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              keepalive: true,
              body: JSON.stringify({
                documentId: result.documentId,
                fileUrl: publicUrl,
                fileType: item.type,
              }),
            });
          } catch (err) {
            console.warn("Failed to fire study pack generation", err);
          }
        };

        if (classification.category === "auto") {
          const isLectures = classification.label.toLowerCase().includes("lecture");
          const isNotes = classification.label.toLowerCase().includes("note");
          const isPresentations =
            classification.label.toLowerCase().includes("presentation") ||
            classification.label.toLowerCase().includes("slide");

          const isEnabled =
            (isLectures && settings.aiAutoLectures) ||
            (isNotes && settings.aiAutoNotes) ||
            (isPresentations && settings.aiAutoPresentations) ||
            (!isLectures && !isNotes && !isPresentations);

          if (isEnabled) {
            fireStudyPack();
          }
        } else if (classification.category === "confirm") {
          const isAssignment =
            classification.label.toLowerCase().includes("assignment") ||
            classification.label.toLowerCase().includes("homework");
          const isQuiz = classification.label.toLowerCase().includes("quiz");
          const isProject = classification.label.toLowerCase().includes("project");
          const isLab = classification.label.toLowerCase().includes("lab");
          const isPastPaper =
            classification.label.toLowerCase().includes("past paper") ||
            classification.label.toLowerCase().includes("exam");

          const autoAssess =
            (isAssignment && settings.aiAutoAssignments) ||
            (isQuiz && settings.aiAutoQuizzes) ||
            (isProject && settings.aiAutoProjects) ||
            (isLab && settings.aiAutoLabs) ||
            (isPastPaper && settings.aiAutoPastPapers);

          const remembered = settings.aiAssessmentRememberedChoice;

          if (autoAssess || remembered === "generate") {
            fireStudyPack();
          } else if (remembered !== "skip") {
            setPendingDoc({
              documentId: result.documentId,
              fileUrl: publicUrl,
              fileType: item.type,
              fileName: item.name,
              fileTypeLabel: classification.label,
            });
            setShowConfirm(true);
          }
        }

        onUploadComplete();
      } catch (err: unknown) {
        console.error(`Upload failed for ${item.name}:`, err);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  errorMsg:
                    err instanceof Error
                      ? err.message
                      : "Upload failed. Please try again.",
                }
              : q
          )
        );
      }
    },
    [selectedSubjectId, settings, onUploadComplete]
  );

  // Queue Processor: Runs up to 2 concurrent uploads
  useEffect(() => {
    const activeUploads = queue.filter(
      (q) => q.status === "uploading" || q.status === "classifying"
    );
    const waitingItems = queue.filter((q) => q.status === "waiting");

    if (activeUploads.length < 2 && waitingItems.length > 0) {
      const nextItem = waitingItems[0];
      uploadItem(nextItem);
    }
  }, [queue, uploadItem]);

  const handleCancelItem = (itemId: string) => {
    setQueue((prev) => {
      const target = prev.find((q) => q.id === itemId);
      if (target?.abortController) {
        target.abortController.abort();
      }
      return prev.filter((q) => q.id !== itemId);
    });
  };

  const handleRetryItem = (itemId: string) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === itemId
          ? { ...q, status: "waiting", progress: 0, errorMsg: undefined }
          : q
      )
    );
  };

  const handleClearCompleted = () => {
    setQueue((prev) =>
      prev.filter((q) => q.status !== "success" && q.status !== "needs_review")
    );
  };

  const hasCompletedItems = queue.some(
    (q) => q.status === "success" || q.status === "needs_review"
  );
  const activeCount = queue.filter(
    (q) => q.status === "waiting" || q.status === "uploading" || q.status === "classifying"
  ).length;

  return (
    <div
      ref={dropZoneRef}
      className="rounded-xl border border-border/60 bg-card/60 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span>Upload Academic Material</span>
          {activeCount > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {activeCount} uploading
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>PDF · DOCX · PPTX · TXT · Images</span>
          <span className="text-border">•</span>
          <span>Max 50 MB per file</span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Optional Subject Assignment */}
        {subjects.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
              <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground">Destination:</span>
              <span className="truncate text-muted-foreground">
                {selectedSubjectId
                  ? subjects.find((s) => s.id === selectedSubjectId)?.name
                  : "Automatic intelligent routing"}
              </span>
            </div>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="rounded-md border border-border/60 bg-background text-foreground text-xs px-2.5 py-1 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer shrink-0 max-w-[200px]"
            >
              <option value="">Auto-classify (Recommended)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Validation Errors Banner */}
        {validationErrors.length > 0 && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                Upload Notice
              </span>
              <button
                type="button"
                onClick={() => setValidationErrors([])}
                className="text-xs hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            {validationErrors.map((err, i) => (
              <p key={i} className="text-[11px] pl-5">
                • {err}
              </p>
            ))}
          </div>
        )}

        {/* Main Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-7 px-4 text-center cursor-pointer transition-all duration-150 group",
            isDragging
              ? "border-primary bg-primary/5 shadow-inner"
              : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <div
            className={cn(
              "h-10 w-10 rounded-lg border flex items-center justify-center mb-2.5 transition-colors",
              isDragging
                ? "bg-primary/10 border-primary/30 text-primary scale-105"
                : "bg-secondary/60 border-border/40 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
            )}
          >
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-foreground mb-0.5">
            {isDragging ? "Drop files to upload" : "Drop files here or click to browse"}
          </p>
          <p className="text-[11px] text-muted-foreground mb-2.5">
            Select one or multiple files to upload simultaneously
          </p>
          <div className="flex items-center gap-1.5">
            {["PDF", "DOCX", "PPTX", "TXT", "Images"].map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/80 text-muted-foreground border border-border/40"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>

        {/* Upload Queue */}
        {queue.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Upload Queue ({queue.length})
              </span>
              {hasCompletedItems && (
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                >
                  Clear completed
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 rounded-lg border text-xs transition-all duration-150 flex flex-col gap-2",
                    item.status === "success"
                      ? "bg-emerald-500/[0.04] border-emerald-500/20"
                      : item.status === "needs_review"
                      ? "bg-amber-500/[0.04] border-amber-500/20"
                      : item.status === "error"
                      ? "bg-destructive/[0.04] border-destructive/20"
                      : "bg-background/80 border-border/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-md bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
                        {getFileIcon(item.type, "h-3.5 w-3.5")}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(item.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "waiting" && (
                        <span className="text-[10px] text-muted-foreground font-medium bg-secondary px-2 py-0.5 rounded">
                          Waiting…
                        </span>
                      )}

                      {item.status === "uploading" && (
                        <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Uploading {item.progress}%
                        </span>
                      )}

                      {item.status === "classifying" && (
                        <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3 animate-pulse" />
                          Checking location…
                        </span>
                      )}

                      {item.status === "success" && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {item.destinationSubject
                            ? `Saved to: ${item.destinationSubject}${
                                item.destinationFolder ? ` › ${item.destinationFolder}` : ""
                              }`
                            : "Saved"}
                        </span>
                      )}

                      {item.status === "needs_review" && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Needs confirmation
                        </span>
                      )}

                      {item.status === "error" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-destructive font-medium">
                            Failed
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRetryItem(item.id)}
                            title="Retry upload"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <RotateCw className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCancelItem(item.id)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer"
                        title={item.status === "uploading" ? "Cancel upload" : "Remove"}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {(item.status === "uploading" || item.status === "classifying") && (
                    <Progress value={item.progress} className="h-1 bg-secondary" />
                  )}

                  {item.status === "error" && item.errorMsg && (
                    <p className="text-[10px] text-destructive mt-0.5">
                      {item.errorMsg}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AIStudyPackDialog
        open={showConfirm}
        fileName={pendingDoc?.fileName || ""}
        fileTypeLabel={pendingDoc?.fileTypeLabel || ""}
        onGenerate={(remember) => {
          if (pendingDoc) {
            fetch("/api/generate-study-pack", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              keepalive: true,
              body: JSON.stringify({
                documentId: pendingDoc.documentId,
                fileUrl: pendingDoc.fileUrl,
                fileType: pendingDoc.fileType,
              }),
            }).catch((err) => console.warn("Failed study pack fire", err));

            if (remember) {
              settings.updateSetting("aiAssessmentRememberedChoice", "generate");
            }
          }
          setShowConfirm(false);
          setPendingDoc(null);
        }}
        onSkip={(remember) => {
          if (remember) {
            settings.updateSetting("aiAssessmentRememberedChoice", "skip");
          }
          setShowConfirm(false);
          setPendingDoc(null);
        }}
        onCancel={() => {
          setShowConfirm(false);
          setPendingDoc(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3: Lightweight File Preview Panel (Visual Preview + Structured Metadata)
// ---------------------------------------------------------------------------

function FileDetailPanel({
  doc,
  subjects,
  onClose,
  onDelete,
  onNavigate,
}: {
  doc: DocumentRow;
  subjects: SubjectItem[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const subject = subjects.find((s) => s.id === doc.subject_id);
  const fileSize = doc.uploads?.file_size;
  const isImage = isImageType(doc.file_type);
  const isPdf = (doc.file_type || "").toLowerCase() === "pdf";

  // Handle escape key to close preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      aria-label={`File preview for ${doc.title}`}
      className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-3.5 animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
            {getFileIcon(doc.file_type, "h-4 w-4")}
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-semibold text-foreground truncate"
              title={doc.title}
            >
              {doc.title}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">
              {doc.file_type?.toUpperCase() || "File"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close file preview"
          className="p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lightweight Visual File Preview */}
      {doc.file_url && (
        <div className="rounded-lg overflow-hidden border border-border/40 bg-muted/30">
          {isImage ? (
            <div className="relative w-full h-36 bg-black/5 flex items-center justify-center overflow-hidden">
              <img
                src={doc.file_url}
                alt={doc.title}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </div>
          ) : isPdf ? (
            <div className="relative w-full h-36 bg-muted/40 flex flex-col items-center justify-center p-3 text-center">
              <FileText className="h-8 w-8 text-red-500 mb-1.5" />
              <p className="text-[11px] font-medium text-foreground truncate max-w-full">
                PDF Document
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-6 px-2.5 mt-2 gap-1 cursor-pointer"
                onClick={() => window.open(doc.file_url!, "_blank", "noopener,noreferrer")}
              >
                <Eye className="h-3 w-3" />
                View Full PDF
              </Button>
            </div>
          ) : (
            <div className="relative w-full h-24 bg-muted/40 flex flex-col items-center justify-center p-3 text-center">
              <div className="h-8 w-8 rounded-md bg-secondary/80 flex items-center justify-center mb-1">
                {getFileIcon(doc.file_type, "h-4 w-4")}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Document preview available on download
              </p>
            </div>
          )}
        </div>
      )}

      {/* Structured Details Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-secondary/30 rounded-lg px-2.5 py-2 border border-border/30">
          <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
            <Calendar className="h-3 w-3" />
            <span className="text-[9px] font-medium uppercase">Date</span>
          </div>
          <p className="text-[11px] font-medium text-foreground truncate">
            {formatDate(doc.created_at)}
          </p>
        </div>

        <div className="bg-secondary/30 rounded-lg px-2.5 py-2 border border-border/30">
          <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
            <HardDrive className="h-3 w-3" />
            <span className="text-[9px] font-medium uppercase">Size</span>
          </div>
          <p className="text-[11px] font-medium text-foreground truncate">
            {formatFileSize(fileSize)}
          </p>
        </div>

        <div className="bg-secondary/30 rounded-lg px-2.5 py-2 border border-border/30">
          <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
            <Tag className="h-3 w-3" />
            <span className="text-[9px] font-medium uppercase">Subject</span>
          </div>
          <p className="text-[11px] font-medium text-foreground truncate">
            {subject?.name || doc.ai_subject || "Unassigned"}
          </p>
        </div>

        <div className="bg-secondary/30 rounded-lg px-2.5 py-2 border border-border/30">
          <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
            <Folder className="h-3 w-3" />
            <span className="text-[9px] font-medium uppercase">Folder</span>
          </div>
          <p className="text-[11px] font-medium text-foreground truncate">
            {doc.ai_topic || "Lectures"}
          </p>
        </div>
      </div>

      {/* Processing Status Banner */}
      <div className="p-2 rounded-lg bg-secondary/40 border border-border/30 flex items-center justify-between text-xs">
        <span className="text-[11px] text-muted-foreground">Status</span>
        <div>{getStatusBadge(doc.summary_status, doc.quiz_status, doc.classification_status)}</div>
      </div>

      {/* Action Shortcuts */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/30">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 cursor-pointer gap-1"
          onClick={() => doc.file_url && window.open(doc.file_url, "_blank")}
          disabled={!doc.file_url}
        >
          <ExternalLink className="h-3 w-3" />
          Open File
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 cursor-pointer gap-1"
          onClick={() => onNavigate(`/assistant?documentId=${doc.id}`)}
        >
          <BrainCircuit className="h-3 w-3" />
          Study AI
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 cursor-pointer gap-1"
          onClick={() => onNavigate(`/uploads/${doc.id}/summary`)}
        >
          <ScrollText className="h-3 w-3" />
          Summary
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 cursor-pointer gap-1"
          onClick={() => onNavigate(`/uploads/${doc.id}/quiz`)}
        >
          <HelpCircle className="h-3 w-3" />
          Quiz
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer gap-1"
        onClick={() => onDelete(doc.id)}
      >
        <Trash2 className="h-3 w-3" />
        Move to Recycle Bin
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3: Upload History Section (Enhanced Search, Filters, Rows & Empty States)
// ---------------------------------------------------------------------------

const FORMAT_TABS: { key: FormatFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pdf", label: "PDF" },
  { key: "docx", label: "DOCX" },
  { key: "pptx", label: "PPTX" },
  { key: "txt", label: "TXT" },
  { key: "image", label: "Images" },
];

function UploadHistorySection({
  documents,
  subjects,
  onUploadClick,
}: {
  documents: DocumentRow[];
  subjects: SubjectItem[];
  onUploadClick: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatFilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [detailDocId, setDetailDocId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Subject lookup map
  const subjectMap = useMemo(() => {
    const m = new Map<string, string>();
    subjects.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [subjects]);

  // Filter logic
  const filtered = useMemo(() => {
    return documents.filter((d) => {
      // Search by title or subject or topic
      if (search) {
        const q = search.toLowerCase();
        const subName = d.subject_id
          ? subjectMap.get(d.subject_id) || ""
          : d.ai_subject || "";
        const topicName = d.ai_topic || "";
        if (
          !d.title.toLowerCase().includes(q) &&
          !subName.toLowerCase().includes(q) &&
          !topicName.toLowerCase().includes(q) &&
          !(d.file_type || "").toLowerCase().includes(q)
        )
          return false;
      }

      // Format filter
      if (formatFilter === "image") {
        if (!isImageType(d.file_type)) return false;
      } else if (formatFilter !== "all") {
        if ((d.file_type || "").toLowerCase() !== formatFilter) return false;
      }

      // Status filter
      if (statusFilter === "completed") {
        const isCompleted =
          (d.summary_status === "completed" ||
            d.summary_status === "pending" ||
            d.summary_status === null) &&
          d.quiz_status !== "processing" &&
          d.quiz_status !== "failed" &&
          d.classification_status !== "needs_review";
        if (!isCompleted) return false;
      } else if (statusFilter === "processing") {
        const isProcessing =
          d.summary_status === "processing" || d.quiz_status === "processing";
        if (!isProcessing) return false;
      } else if (statusFilter === "needs_review") {
        const isNeedsReview =
          d.classification_status === "needs_review" ||
          d.classification_status === "pending";
        if (!isNeedsReview) return false;
      } else if (statusFilter === "failed") {
        const isFailed =
          d.summary_status === "failed" || d.quiz_status === "failed";
        if (!isFailed) return false;
      }

      return true;
    });
  }, [documents, search, formatFilter, statusFilter, subjectMap]);

  // Sort logic
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "date")
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "type")
        cmp = (a.file_type || "").localeCompare(b.file_type || "");
      else if (sortKey === "subject") {
        const sa = a.subject_id
          ? subjectMap.get(a.subject_id) || ""
          : a.ai_subject || "";
        const sb = b.subject_id
          ? subjectMap.get(b.subject_id) || ""
          : b.ai_subject || "";
        cmp = sa.localeCompare(sb);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, subjectMap]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const pageStart = (page - 1) * ITEMS_PER_PAGE;
  const paginated = sorted.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleDelete = useCallback(
    async (docId: string) => {
      setDeletingId(docId);
      try {
        await moveDocumentToRecycleBin(docId);
        startTransition(() => router.refresh());
        if (detailDocId === docId) setDetailDocId(null);
      } catch (err) {
        console.error("Delete failed:", err);
      } finally {
        setDeletingId(null);
      }
    },
    [router, detailDocId]
  );

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleResetFilters = () => {
    setSearch("");
    setFormatFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const renderSortHeader = (
    sortKeyVal: SortKey,
    label: string,
    className?: string
  ) => (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors",
        className
      )}
      onClick={() => handleSort(sortKeyVal)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyVal ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3 text-primary" />
          )
        ) : (
          <ChevronUp className="h-3 w-3 text-muted-foreground/30" />
        )}
      </span>
    </th>
  );

  const detailDoc = detailDocId
    ? documents.find((d) => d.id === detailDocId) ?? null
    : null;

  const isFilteringActive =
    search.trim() !== "" || formatFilter !== "all" || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-3.5">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Upload History
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {documents.length === 0
              ? "No uploads yet"
              : `${documents.length} file${
                  documents.length !== 1 ? "s" : ""
                } uploaded`}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search files, subjects…"
            className="pl-8 h-8 text-xs bg-background/80 border-border/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search query"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls (Format Pills + Compact Filter Dropdown) */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
        <div className="flex items-center gap-1">
          {FORMAT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setFormatFilter(tab.key);
                setPage(1);
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer border",
                formatFilter === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 text-xs px-2.5 gap-1.5 cursor-pointer font-medium",
                    statusFilter !== "all" && "border-primary text-primary bg-primary/5"
                  )}
                >
                  <Filter className="h-3 w-3" />
                  <span>
                    {statusFilter === "all"
                      ? "Filter"
                      : statusFilter === "completed"
                      ? "Completed"
                      : statusFilter === "processing"
                      ? "Processing"
                      : statusFilter === "needs_review"
                      ? "Needs Review"
                      : "Failed"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-36 bg-card">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Status
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "all"}
                  onCheckedChange={() => {
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="text-xs cursor-pointer"
                >
                  All Statuses
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "completed"}
                  onCheckedChange={() => {
                    setStatusFilter("completed");
                    setPage(1);
                  }}
                  className="text-xs cursor-pointer"
                >
                  Completed
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "processing"}
                  onCheckedChange={() => {
                    setStatusFilter("processing");
                    setPage(1);
                  }}
                  className="text-xs cursor-pointer"
                >
                  Processing
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "needs_review"}
                  onCheckedChange={() => {
                    setStatusFilter("needs_review");
                    setPage(1);
                  }}
                  className="text-xs cursor-pointer"
                >
                  Needs Review
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "failed"}
                  onCheckedChange={() => {
                    setStatusFilter("failed");
                    setPage(1);
                  }}
                  className="text-xs cursor-pointer"
                >
                  Failed
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Result Count */}
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {sorted.length} {sorted.length === 1 ? "file" : "files"}
          </span>
        </div>
      </div>

      {/* Empty States */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-border/60 bg-card/40">
          <div className="h-12 w-12 rounded-xl bg-secondary/80 border border-border/40 flex items-center justify-center mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No files uploaded yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            Upload your lectures, notes, assignments, and other academic
            material to get started.
          </p>
          <Button
            size="sm"
            onClick={onUploadClick}
            className="text-xs h-8 px-4 cursor-pointer gap-1.5 font-medium"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Files
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-border/60 bg-card/40">
          <Search className="h-7 w-7 text-muted-foreground mb-2" />
          <p className="text-xs font-semibold text-foreground mb-0.5">
            Nothing found
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Try another search or filter.
          </p>
          {isFilteringActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs h-7 px-3 cursor-pointer"
            >
              Reset filters
            </Button>
          )}
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Table Container */}
          <div className="flex-1 min-w-0 rounded-xl border border-border/60 bg-card/50 overflow-hidden shadow-sm">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border/50 bg-muted/30">
                  <tr>
                    {renderSortHeader("name", "FILE", "min-w-[220px]")}
                    {renderSortHeader("subject", "SUBJECT", "min-w-[140px]")}
                    {renderSortHeader("type", "TYPE", "w-20")}
                    {renderSortHeader("date", "DATE", "min-w-[110px]")}
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground min-w-[100px]">
                      STATUS
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-muted-foreground w-16">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {paginated.map((doc) => {
                    const subjectName = doc.subject_id
                      ? subjectMap.get(doc.subject_id)
                      : doc.ai_subject;
                    const isDeleting = deletingId === doc.id;
                    const isSelected = detailDocId === doc.id;

                    return (
                      <tr
                        key={doc.id}
                        className={cn(
                          "group transition-colors duration-100",
                          isSelected
                            ? "bg-primary/5"
                            : "hover:bg-muted/30"
                        )}
                      >
                        {/* File Name & Preview Trigger */}
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setDetailDocId(isSelected ? null : doc.id)
                            }
                            aria-label={`Preview ${doc.title}`}
                            className="flex items-center gap-2.5 text-left w-full group/name cursor-pointer"
                          >
                            <div className="h-7 w-7 rounded-md bg-secondary/80 border border-border/30 flex items-center justify-center shrink-0">
                              {getFileIcon(doc.file_type)}
                            </div>
                            <span
                              className="text-xs font-medium text-foreground truncate max-w-[200px] group-hover/name:text-primary transition-colors"
                              title={doc.title}
                            >
                              {doc.title}
                            </span>
                          </button>
                        </td>

                        {/* Subject */}
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-muted-foreground truncate max-w-[130px] block">
                            {subjectName || (
                              <span className="italic opacity-60">Unassigned</span>
                            )}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground bg-secondary/70 border border-border/30 px-1.5 py-0.5 rounded">
                            {doc.file_type?.toUpperCase() || "—"}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(doc.created_at)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5">
                          {getStatusBadge(
                            doc.summary_status,
                            doc.quiz_status,
                            doc.classification_status
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right">
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    aria-label={`Actions for ${doc.title}`}
                                    className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 ml-auto"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                }
                              />
                              <DropdownMenuContent
                                align="end"
                                className="w-44 bg-card/98 border border-border/70 shadow-lg"
                              >
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() => setDetailDocId(doc.id)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-2" />
                                  Preview File
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() =>
                                    doc.file_url &&
                                    window.open(
                                      doc.file_url,
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                  Open File
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() =>
                                    doc.file_url &&
                                    window.open(doc.file_url, "_blank")
                                  }
                                >
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() =>
                                    handleNavigate(
                                      `/assistant?documentId=${doc.id}`
                                    )
                                  }
                                >
                                  <BrainCircuit className="h-3.5 w-3.5 mr-2" />
                                  Study with AI
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() =>
                                    handleNavigate(`/uploads/${doc.id}/summary`)
                                  }
                                >
                                  <ScrollText className="h-3.5 w-3.5 mr-2" />
                                  Summary
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() =>
                                    handleNavigate(`/uploads/${doc.id}/quiz`)
                                  }
                                >
                                  <HelpCircle className="h-3.5 w-3.5 mr-2" />
                                  Quiz
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                  onClick={() => handleDelete(doc.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Move to Recycle Bin
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-border/30">
              {paginated.map((doc) => {
                const subjectName = doc.subject_id
                  ? subjectMap.get(doc.subject_id)
                  : doc.ai_subject;
                const isDeleting = deletingId === doc.id;
                const isSelected = detailDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={cn(
                      "p-3.5 flex items-start gap-3 transition-colors",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setDetailDocId(isSelected ? null : doc.id)}
                      className="h-8 w-8 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {getFileIcon(doc.file_type, "h-4 w-4")}
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setDetailDocId(isSelected ? null : doc.id)}
                        className="text-xs font-semibold text-foreground truncate block text-left w-full hover:text-primary transition-colors cursor-pointer"
                        title={doc.title}
                      >
                        {doc.title}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {subjectName || "Unassigned"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">
                          {doc.file_type || "File"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        {getStatusBadge(
                          doc.summary_status,
                          doc.quiz_status,
                          doc.classification_status
                        )}
                      </div>
                    </div>
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`Actions for ${doc.title}`}
                              className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors cursor-pointer shrink-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent
                          align="end"
                          className="w-44 bg-card/98 border border-border/70 shadow-lg"
                        >
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => setDetailDocId(doc.id)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            Preview File
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() =>
                              doc.file_url &&
                              window.open(
                                doc.file_url,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                            Open File
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() =>
                              handleNavigate(
                                `/assistant?documentId=${doc.id}`
                              )
                            }
                          >
                            <BrainCircuit className="h-3.5 w-3.5 mr-2" />
                            Study with AI
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Move to Recycle Bin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">
                  Showing {pageStart + 1}–
                  {Math.min(pageStart + ITEMS_PER_PAGE, sorted.length)} of{" "}
                  {sorted.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="h-6 w-6 p-0 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - page) <= 2
                    )
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
                        acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="text-[11px] text-muted-foreground px-1"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p as number)}
                          className={cn(
                            "h-6 w-6 text-[11px] font-medium rounded transition-colors cursor-pointer",
                            page === p
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    className="h-6 w-6 p-0 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Slide-in Details & Preview Panel */}
          {detailDoc && (
            <div className="hidden lg:block w-80 shrink-0">
              <FileDetailPanel
                doc={detailDoc}
                subjects={subjects}
                onClose={() => setDetailDocId(null)}
                onDelete={handleDelete}
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root export: UploadCenter
// ---------------------------------------------------------------------------

export function UploadCenter({
  documents,
  subjects,
  pendingDocs = [],
}: UploadCenterProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const dropZoneRef = useRef<HTMLDivElement | null>(null);

  const handleUploadComplete = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const handleScrollToUpload = useCallback(() => {
    dropZoneRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Main Upload Area */}
      <UploadArea
        subjects={subjects}
        onUploadComplete={handleUploadComplete}
        dropZoneRef={dropZoneRef}
      />

      {/* 2. Lightweight Status / Statistics Overview */}
      <UploadStatisticsStrip
        documents={documents}
        pendingCount={pendingDocs.length}
      />

      {/* 3. Needs Your Attention (only when pending classification files exist) */}
      {pendingDocs.length > 0 && (
        <ClassificationCard pendingDocs={pendingDocs} subjects={subjects} />
      )}

      {/* 4. Upload History */}
      <UploadHistorySection
        documents={documents}
        subjects={subjects}
        onUploadClick={handleScrollToUpload}
      />
    </div>
  );
}
