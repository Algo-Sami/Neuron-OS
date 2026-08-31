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
  File as FileIcon,
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
  FolderOpen,
  Copy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { 
  saveUploadMetadata, 
  moveDocumentToRecycleBin, 
  checkDuplicateUploadAction,
  getSummaryFileLocationAction
} from "@/actions/uploads";
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
import { DuplicateUploadDialog } from "./duplicate-upload-dialog";
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

export interface DocumentRow {
  id: string;
  title: string;
  file_type: string | null;
  file_url: string | null;
  created_at: string;
  deleted_at?: string | null;
  summary_status: string | null;
  quiz_status: string | null;
  classification_status?: string | null;
  ai_subject: string | null;
  ai_topic: string | null;
  subject_id: string | null;
  folder_id?: string | null;
  size?: number | null;
  uploads?: { file_size: number | null } | null;
  file_deleted?: boolean;
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
  | "duplicate"
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
  duplicateInfo?: {
    existingFile: {
      id: string;
      name: string;
      subjectName?: string | null;
      folderName?: string | null;
      size?: number | null;
      createdAt?: string;
    };
    suggestedCopyName: string;
  };
}

type SortKey = "date" | "name" | "type" | "subject";
type SortDir = "asc" | "desc";
type FormatFilterKey = "all" | "pdf" | "docx" | "pptx" | "txt" | "image";
type StatusFilterKey = "all" | "completed" | "processing" | "needs_review" | "failed" | "deleted";

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
  return <FileIcon className={cn(className, "text-muted-foreground")} />;
}

function getStatusBadge(
  summaryStatus: string | null,
  quizStatus: string | null,
  classificationStatus?: string | null,
  fileDeleted?: boolean
) {
  if (fileDeleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        File Deleted
      </span>
    );
  }

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
    summaryStatus === "completed" || quizStatus === "completed";

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
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
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
      if (d.file_deleted) return false;
      return d.summary_status === "completed" || d.quiz_status === "completed";
    }).length;
  }, [documents]);

  const processingCount = useMemo(() => {
    return documents.filter(
      (d) => !d.file_deleted && (d.summary_status === "processing" || d.quiz_status === "processing")
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

  const [duplicateDialogItem, setDuplicateDialogItem] = useState<{
    item: UploadQueueItem;
    suggestedCopyName: string;
    existingFile?: {
      id: string;
      name: string;
      subjectName?: string | null;
      folderName?: string | null;
      size?: number | null;
      createdAt?: string;
    };
  } | null>(null);

  const handleUploadAsCopy = useCallback((item: UploadQueueItem, copyName: string) => {
    setDuplicateDialogItem(null);
    const renamedFile = new File([item.file], copyName, { type: item.file.type });
    setQueue((prev) =>
      prev.map((q) =>
        q.id === item.id
          ? {
              ...q,
              file: renamedFile,
              name: copyName,
              status: "waiting",
              progress: 0,
              errorMsg: undefined,
              duplicateInfo: undefined,
            }
          : q
      )
    );
  }, []);

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
            ? { ...q, status: "uploading", progress: 10, abortController }
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

        // ── 1. Application-level Duplicate Preflight Check ─────────────────────
        //    Checks destination folder before uploading file bytes to storage.
        try {
          const dupCheck = await checkDuplicateUploadAction({
            fileName: item.name,
            subjectId: selectedSubjectId || undefined,
          });

          if (dupCheck.success && dupCheck.isDuplicate) {
            const suggestedCopyName = dupCheck.suggestedCopyName || `${item.name} (1)`;
            const duplicateInfo = {
              existingFile: dupCheck.existingFile || {
                id: '',
                name: item.name,
                subjectName: null,
                folderName: null,
                size: item.size,
              },
              suggestedCopyName,
            };

            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      status: "duplicate",
                      progress: 0,
                      duplicateInfo,
                      errorMsg: `A file named "${item.name}" already exists in this location.`,
                    }
                  : q
              )
            );

            // Pop dialog for immediate resolution
            setDuplicateDialogItem({
              item,
              suggestedCopyName,
              existingFile: duplicateInfo.existingFile,
            });
            return;
          }
        } catch (checkErr) {
          console.warn("[Upload Preflight] Duplicate check exception:", checkErr);
        }

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

        if (!result.success) {
          if (result.code === "DUPLICATE_FILE") {
            const suggestedCopyName = result.suggestedCopyName || `${item.name} (1)`;
            const duplicateInfo = {
              existingFile: result.existingFile || {
                id: '',
                name: item.name,
                subjectName: null,
                folderName: null,
                size: item.size,
              },
              suggestedCopyName,
            };

            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      status: "duplicate",
                      progress: 0,
                      duplicateInfo,
                      errorMsg: `A file named "${item.name}" already exists in this location.`,
                    }
                  : q
              )
            );

            setDuplicateDialogItem({
              item,
              suggestedCopyName,
              existingFile: duplicateInfo.existingFile,
            });
            return;
          }

          throw new Error(result.message || "Failed to save document metadata.");
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

        // AI study pack dispatch check — ONLY for lecture files
        const isLectureFolder =
          /lecture/i.test(destinationFolder || "") ||
          /lecture/i.test(classification.label || "");

        if (isLectureFolder && settings.aiAutoLectures !== false) {
          fireStudyPack();
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
                      : item.status === "duplicate"
                      ? "bg-amber-500/[0.04] border-amber-500/30"
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

                      {item.status === "duplicate" && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <Copy className="h-3 w-3" />
                            Already exists
                          </span>
                          {item.duplicateInfo?.suggestedCopyName && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleUploadAsCopy(
                                  item,
                                  item.duplicateInfo!.suggestedCopyName
                                )
                              }
                              className="h-6 text-[10px] px-2 py-0 rounded border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                              title={`Upload as ${item.duplicateInfo.suggestedCopyName}`}
                            >
                              Upload as Copy
                            </Button>
                          )}
                        </div>
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

                  {item.status === "duplicate" && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-normal">
                      A file with this name already exists in this location. You can upload it as a copy ({item.duplicateInfo?.suggestedCopyName}) or cancel.
                    </p>
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

      {duplicateDialogItem && (
        <DuplicateUploadDialog
          open={!!duplicateDialogItem}
          fileName={duplicateDialogItem.item.name}
          suggestedCopyName={duplicateDialogItem.suggestedCopyName}
          existingFileInfo={duplicateDialogItem.existingFile}
          onUploadAsCopy={async (copyName) => {
            handleUploadAsCopy(duplicateDialogItem.item, copyName);
          }}
          onCancel={() => {
            handleCancelItem(duplicateDialogItem.item.id);
            setDuplicateDialogItem(null);
          }}
        />
      )}

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

// ---------------------------------------------------------------------------
// Clean "View Details" Panel — only essential metadata, no bloat
// ---------------------------------------------------------------------------
function FileDetailPanel({
  doc,
  subjects,
  onClose,
}: {
  doc: DocumentRow;
  subjects: SubjectItem[];
  onClose: () => void;
}) {
  const subject = subjects.find((s) => s.id === doc.subject_id);
  const fileSize = doc.size ?? doc.uploads?.file_size;
  const rawExt = (doc.file_type || "").toLowerCase().replace(/^\./, "");

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      aria-label={`Details for ${doc.title}`}
      className="rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-xl shadow-black/10 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 ring-1 ring-border/50"
    >
      {/* ── Coloured Header strip ── */}
      <div className="px-3.5 pt-3.5 pb-3 border-b border-border/60 bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-secondary border border-border/50 flex items-center justify-center shrink-0">
              {getFileIcon(doc.file_type, "h-3.5 w-3.5")}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-tight" title={doc.title}>
                {doc.title}
              </p>
              <span className="text-[9px] text-muted-foreground uppercase font-medium tracking-wide">
                {rawExt || "file"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Deleted notice ── */}
      {doc.file_deleted && (
        <div className="mx-3 mt-2.5 p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[10px] text-destructive leading-snug">
            This file has been permanently removed from storage.
          </p>
        </div>
      )}

      {/* ── 4 Key Metadata Cards ── */}
      <div className="p-3 grid grid-cols-1 gap-1.5">

        {/* Date Uploaded */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/60 transition-colors">
          <div className="h-6 w-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Calendar className="h-3 w-3 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Date Uploaded</p>
            <p className="text-[11px] font-medium text-foreground mt-0.5 truncate">{formatDate(doc.created_at)}</p>
          </div>
        </div>

        {/* File Size */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/60 transition-colors">
          <div className="h-6 w-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="h-3 w-3 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">File Size</p>
            <p className="text-[11px] font-medium text-foreground mt-0.5 truncate">{formatFileSize(fileSize)}</p>
          </div>
        </div>

        {/* Subject */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/60 transition-colors">
          <div className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Tag className="h-3 w-3 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Subject</p>
            <p className="text-[11px] font-medium text-foreground mt-0.5 truncate">
              {subject?.name || doc.ai_subject || <span className="italic text-muted-foreground">Unassigned</span>}
            </p>
          </div>
        </div>

        {/* Folder */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/60 transition-colors">
          <div className="h-6 w-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Folder className="h-3 w-3 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Folder</p>
            <p className="text-[11px] font-medium text-foreground mt-0.5 truncate">{doc.ai_topic || "Lectures"}</p>
          </div>
        </div>

        {/* Date Deleted (only shown for deleted files) */}
        {doc.file_deleted && doc.deleted_at && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/15 transition-colors">
            <div className="h-6 w-6 rounded-md bg-destructive/15 border border-destructive/30 flex items-center justify-center shrink-0">
              <Calendar className="h-3 w-3 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-destructive uppercase tracking-wider">Date Deleted</p>
              <p className="text-[11px] font-medium text-destructive mt-0.5 truncate">{formatDate(doc.deleted_at)}</p>
            </div>
          </div>
        )}

      </div>
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
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null);
  const [navigatingSummaryId, setNavigatingSummaryId] = useState<string | null>(null);

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
      if (statusFilter === "deleted") {
        if (!d.file_deleted) return false;
      } else if (d.file_deleted) {
        if (statusFilter !== "all") return false;
      } else if (statusFilter === "completed") {
        const isCompleted =
          d.summary_status === "completed" || d.quiz_status === "completed";
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

  const handleSummaryAction = async (doc: DocumentRow) => {
    setNavigatingSummaryId(doc.id);
    try {
      const result = await getSummaryFileLocationAction(doc.id);
      if (result.success && result.subjectId) {
        const targetUrl = result.folderId
          ? `/subjects/${result.subjectId}?folder=${result.folderId}&select=${result.fileId || doc.id}`
          : `/subjects/${result.subjectId}?select=${result.fileId || doc.id}`;
        handleNavigate(targetUrl);
      } else if (result.viewerUrl) {
        handleNavigate(result.viewerUrl);
      } else {
        handleNavigate(`/uploads/${doc.id}/summary`);
      }
    } catch (err) {
      console.warn("Failed to resolve summary location, falling back:", err);
      handleNavigate(`/uploads/${doc.id}/summary`);
    } finally {
      setNavigatingSummaryId(null);
    }
  };

  const handleRegenerateSummary = async (doc: DocumentRow) => {
    if (!doc.file_url) return;
    setGeneratingDocId(doc.id);
    try {
      await fetch("/api/generate-study-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          fileUrl: doc.file_url,
          fileType: doc.file_type || "pdf",
          force: true,
        }),
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Failed to regenerate summary:", err);
    } finally {
      setTimeout(() => setGeneratingDocId(null), 1500);
    }
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
        "px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer select-none hover:text-foreground transition-colors",
        className
      )}
      onClick={() => handleSort(sortKeyVal)}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {sortKey === sortKeyVal ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3 text-primary" />
          )
        ) : (
          <ChevronUp className="h-3 w-3 opacity-20" />
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
                      : statusFilter === "failed"
                      ? "Failed"
                      : "File Deleted"}
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
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "deleted"}
                  onCheckedChange={() => {
                    setStatusFilter("deleted");
                    setPage(1);
                  }}
                  className="text-xs cursor-pointer text-destructive focus:text-destructive"
                >
                  File Deleted
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
        <div className="flex flex-col lg:flex-row items-start gap-4 w-full">
          {/* Table Container */}
          <div className="flex-1 min-w-0 w-full rounded-2xl border border-border/60 bg-card overflow-hidden shadow-lg shadow-black/5">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/50">
                    {renderSortHeader("name", "FILE", "w-auto min-w-[150px]")}
                    {renderSortHeader("subject", "SUBJECT", "w-[140px]")}
                    {renderSortHeader("type", "TYPE", "w-[65px]")}
                    {renderSortHeader("date", "DATE", "w-[105px]")}
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[100px]">
                      STATUS
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-12">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paginated.map((doc) => {
                    const subjectName = doc.subject_id
                      ? subjectMap.get(doc.subject_id)
                      : doc.ai_subject;
                    const isDeleting = deletingId === doc.id;
                    const isSelected = detailDocId === doc.id;
                    const rawExt = (doc.file_type || "").toLowerCase();

                    // Only show AI study tools for lecture files
                    const isLectureFile = /lecture/i.test(doc.ai_topic || "");

                    return (
                      <tr
                        key={doc.id}
                        className={cn(
                          "group transition-all duration-150 cursor-default",
                          isSelected
                            ? "bg-primary/6 border-l-2 border-l-primary"
                            : "hover:bg-muted/40 border-l-2 border-l-transparent",
                          doc.file_deleted && "opacity-60"
                        )}
                      >
                        {/* File Name */}
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setDetailDocId(isSelected ? null : doc.id)}
                            aria-label={`View details for ${doc.title}`}
                            className="flex items-center gap-2.5 text-left w-full cursor-pointer group/row"
                          >
                            <div className={cn(
                              "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border transition-all",
                              rawExt === "pdf" ? "bg-rose-500/10 border-rose-500/20" :
                              rawExt === "docx" || rawExt === "doc" ? "bg-blue-500/10 border-blue-500/20" :
                              rawExt === "pptx" || rawExt === "ppt" ? "bg-amber-500/10 border-amber-500/20" :
                              isImageType(rawExt) ? "bg-violet-500/10 border-violet-500/20" :
                              "bg-secondary border-border/40"
                            )}>
                              {getFileIcon(doc.file_type, "h-3.5 w-3.5")}
                            </div>
                            <div className="min-w-0">
                              <span
                                className={cn(
                                  "text-xs font-semibold block truncate max-w-[170px] lg:max-w-[220px] transition-colors",
                                  doc.file_deleted
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground group-hover/row:text-primary"
                                )}
                                title={doc.title}
                              >
                                {doc.title}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] font-semibold text-primary/70 uppercase tracking-wider">Details open</span>
                              )}
                            </div>
                          </button>
                        </td>

                        {/* Subject */}
                        <td className="px-3 py-2.5">
                          {subjectName ? (
                            <span className="text-xs font-medium text-foreground/80 truncate max-w-[125px] block">
                              {subjectName}
                            </span>
                          ) : (
                            <span className="text-[11px] italic text-muted-foreground/60">Unassigned</span>
                          )}
                        </td>

                        {/* Type badge */}
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
                            rawExt === "pdf" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" :
                            rawExt === "docx" || rawExt === "doc" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                            rawExt === "pptx" || rawExt === "ppt" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                            isImageType(rawExt) ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" :
                            "bg-secondary text-muted-foreground border-border/40"
                          )}>
                            {doc.file_type?.toUpperCase() || "—"}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                            {formatDate(doc.created_at)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          {getStatusBadge(
                            doc.summary_status,
                            doc.quiz_status,
                            doc.classification_status,
                            doc.file_deleted
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5 text-right">
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    aria-label={`Actions for ${doc.title}`}
                                    className="h-7 w-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 ml-auto border border-transparent hover:border-border/50"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                }
                              />
                              <DropdownMenuContent
                                align="end"
                                className="w-48 bg-card/98 border border-border/70 shadow-xl shadow-black/10 rounded-xl"
                              >
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() => setDetailDocId(doc.id)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-2" />
                                  View Details
                                </DropdownMenuItem>

                                {!doc.file_deleted ? (
                                  <>
                                    <DropdownMenuItem
                                      className="text-xs cursor-pointer"
                                      onClick={() =>
                                        doc.file_url &&
                                        window.open(doc.file_url, "_blank", "noopener,noreferrer")
                                      }
                                    >
                                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                      Open File
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-xs cursor-pointer"
                                      disabled={!doc.subject_id}
                                      onClick={() => {
                                        if (doc.subject_id) {
                                          const targetUrl = doc.folder_id
                                            ? `/subjects/${doc.subject_id}?folder=${doc.folder_id}&select=${doc.id}`
                                            : `/subjects/${doc.subject_id}?select=${doc.id}`;
                                          handleNavigate(targetUrl);
                                        }
                                      }}
                                    >
                                      <FolderOpen className="h-3.5 w-3.5 mr-2 text-primary" />
                                      Open File Location
                                    </DropdownMenuItem>

                                    {/* AI Tools — only for lecture files */}
                                    {isLectureFile && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-xs cursor-pointer"
                                          onClick={() => handleNavigate(`/assistant?documentId=${doc.id}`)}
                                        >
                                          <BrainCircuit className="h-3.5 w-3.5 mr-2 text-violet-500" />
                                          Study with AI
                                        </DropdownMenuItem>

                                        {doc.summary_status === "completed" ? (
                                          <DropdownMenuItem
                                            className="text-xs cursor-pointer"
                                            disabled={navigatingSummaryId === doc.id}
                                            onClick={() => handleSummaryAction(doc)}
                                          >
                                            {navigatingSummaryId === doc.id ? (
                                              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-primary" />
                                            ) : (
                                              <ScrollText className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                                            )}
                                            Open Summary Location
                                          </DropdownMenuItem>
                                        ) : doc.summary_status === "processing" || generatingDocId === doc.id ? (
                                          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-primary" />
                                            Generating Summary…
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            className="text-xs cursor-pointer"
                                            onClick={() => handleRegenerateSummary(doc)}
                                          >
                                            <RotateCw className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                            {doc.summary_status === "failed" ? "Regenerate Summary" : "Generate Summary"}
                                          </DropdownMenuItem>
                                        )}

                                        <DropdownMenuItem
                                          className="text-xs cursor-pointer"
                                          onClick={() => handleNavigate(`/uploads/${doc.id}/quiz`)}
                                        >
                                          <HelpCircle className="h-3.5 w-3.5 mr-2 text-blue-500" />
                                          Quiz
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                      onClick={() => handleDelete(doc.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                                      Move to Recycle Bin
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuSeparator />
                                    <div className="px-2 py-1.5 text-[10px] text-muted-foreground italic">
                                      File permanently deleted from storage.
                                    </div>
                                  </>
                                )}
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
                const isLectureFile = /lecture/i.test(doc.ai_topic || "");

                return (
                  <div
                    key={doc.id}
                    className={cn(
                      "p-3.5 flex items-start gap-3 transition-colors",
                      isSelected && "bg-primary/5",
                      doc.file_deleted && "opacity-75 bg-muted/5"
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
                        className={cn(
                          "text-xs font-semibold truncate block text-left w-full transition-colors cursor-pointer",
                          doc.file_deleted
                            ? "text-muted-foreground line-through hover:text-foreground"
                            : "text-foreground hover:text-primary"
                        )}
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
                          doc.classification_status,
                          doc.file_deleted
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
                          className="w-48 bg-card/98 border border-border/70 shadow-lg"
                        >
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => setDetailDocId(doc.id)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            View Details
                          </DropdownMenuItem>

                          {!doc.file_deleted ? (
                            <>
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
                                disabled={!doc.subject_id}
                                onClick={() => {
                                  if (doc.subject_id) {
                                    const targetUrl = doc.folder_id
                                      ? `/subjects/${doc.subject_id}?folder=${doc.folder_id}&select=${doc.id}`
                                      : `/subjects/${doc.subject_id}?select=${doc.id}`;
                                    handleNavigate(targetUrl);
                                  }
                                }}
                              >
                                <FolderOpen className="h-3.5 w-3.5 mr-2 text-primary" />
                                Open File Location
                              </DropdownMenuItem>

                              {/* AI Tools — only for lecture files */}
                              {isLectureFile && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-xs cursor-pointer"
                                    onClick={() =>
                                      handleNavigate(`/assistant?documentId=${doc.id}`)
                                    }
                                  >
                                    <BrainCircuit className="h-3.5 w-3.5 mr-2 text-violet-500" />
                                    Study with AI
                                  </DropdownMenuItem>

                                  {doc.summary_status === "completed" ? (
                                    <DropdownMenuItem
                                      className="text-xs cursor-pointer"
                                      disabled={navigatingSummaryId === doc.id}
                                      onClick={() => handleSummaryAction(doc)}
                                    >
                                      {navigatingSummaryId === doc.id ? (
                                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-primary" />
                                      ) : (
                                        <ScrollText className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                                      )}
                                      Open Summary Location
                                    </DropdownMenuItem>
                                  ) : doc.summary_status === "processing" || generatingDocId === doc.id ? (
                                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-primary" />
                                      Generating Summary…
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      className="text-xs cursor-pointer"
                                      onClick={() => handleRegenerateSummary(doc)}
                                    >
                                      <RotateCw className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                      {doc.summary_status === "failed" ? "Regenerate Summary" : "Generate Summary"}
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(doc.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Move to Recycle Bin
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1 text-[10px] text-muted-foreground italic leading-tight">
                                File has been permanently deleted from storage.
                              </div>
                            </>
                          )}
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

          {/* Right-side Details Panel (matching the Preview Panel in Subjects) */}
          {detailDoc && (
            <div className="w-full lg:w-64 xl:w-72 shrink-0 animate-in fade-in slide-in-from-right-4 duration-200">
              <FileDetailPanel
                doc={detailDoc}
                subjects={subjects}
                onClose={() => setDetailDocId(null)}
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
  const supabase = useMemo(() => createClient(), []);

  const handleUploadComplete = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // Real-time listener: automatically refresh when documents, summaries, or tasks update in Supabase
  useEffect(() => {
    const channel = supabase
      .channel("upload-center-live-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => {
          startTransition(() => router.refresh());
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_summaries" },
        () => {
          startTransition(() => router.refresh());
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "background_tasks" },
        () => {
          startTransition(() => router.refresh());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  // Smart polling: only poll if a document is actively being processed by the AI worker
  const hasActiveProcessing = useMemo(() => {
    return documents.some(
      (d) =>
        !d.file_deleted &&
        (d.summary_status === "processing" || d.quiz_status === "processing")
    );
  }, [documents]);

  useEffect(() => {
    if (!hasActiveProcessing) return;

    const interval = setInterval(() => {
      startTransition(() => router.refresh());
    }, 3500);

    return () => clearInterval(interval);
  }, [hasActiveProcessing, router]);

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
