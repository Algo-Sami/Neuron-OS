"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  File,
  FileText,
  Image,
  Archive,
  X,
  CheckCircle2,
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
  FolderOpen,
  CloudUpload,
  Info,
  Calendar,
  HardDrive,
  Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveUploadMetadata, moveDocumentToRecycleBin } from "@/actions/uploads";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
  ai_subject: string | null;
  ai_topic: string | null;
  subject_id: string | null;
  uploads?: { file_size: number | null } | null;
}

interface UploadCenterProps {
  documents: DocumentRow[];
  subjects: SubjectItem[];
}

type UploadStatus = "idle" | "selected" | "uploading" | "success" | "error";
type SortKey = "date" | "name" | "size" | "type" | "subject";
type SortDir = "asc" | "desc";
type FilterKey = "all" | "pdf" | "docx" | "pptx" | "txt" | "image" | "completed" | "processing" | "failed";

const ITEMS_PER_PAGE = 15;

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
  if (t === "pdf") return <FileText className={cn(className, "text-red-400")} />;
  if (t === "docx" || t === "doc") return <FileText className={cn(className, "text-blue-400")} />;
  if (t === "pptx" || t === "ppt") return <FileText className={cn(className, "text-orange-400")} />;
  if (t === "txt") return <FileText className={cn(className, "text-muted-foreground")} />;
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(t))
    return <Image className={cn(className, "text-emerald-400")} />;
  if (t === "zip" || t === "rar") return <Archive className={cn(className, "text-yellow-400")} />;
  return <File className={cn(className, "text-muted-foreground")} />;
}

function getStatusBadge(summaryStatus: string | null, quizStatus: string | null) {
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Processing
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }
  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/50">
      Uploaded
    </span>
  );
}

function isImageType(type: string | null | undefined) {
  return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes((type || "").toLowerCase());
}

// ---------------------------------------------------------------------------
// Upload Area (Section 1)
// ---------------------------------------------------------------------------

function UploadArea({
  subjects,
  onUploadComplete,
}: {
  subjects: SubjectItem[];
  onUploadComplete: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const validExtensions = [".pdf", ".docx", ".pptx", ".txt", ".jpg", ".jpeg", ".png", ".webp"];

  const validateFile = (f: File): string | null => {
    if (f.size > 50 * 1024 * 1024) return "File exceeds the 50 MB limit.";
    const hasValid = validExtensions.some((ext) =>
      f.name.toLowerCase().endsWith(ext)
    );
    if (!hasValid)
      return "Unsupported file type. Please upload PDF, DOCX, PPTX, TXT, or an image.";
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setStatus("error");
      setErrorMsg(err);
      return;
    }
    setFile(f);
    setStatus("selected");
    setErrorMsg("");
    setProgress(0);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(10);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Please log in to upload files.");

      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${user.id}/${Date.now()}_${cleanName}`;
      setProgress(25);

      const { error: storageErr } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (storageErr) throw storageErr;
      setProgress(70);

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);

      const ext = file.name.split(".").pop()?.toLowerCase() || "unknown";
      const result = await saveUploadMetadata({
        fileName: file.name,
        fileUrl: publicUrl,
        fileType: ext,
        fileSize: file.size,
      });
      setProgress(90);

      // Kick off background AI processing
      if (result.documentId) {
        fetch("/api/process-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: result.documentId,
            userId: user.id,
            fileUrl: publicUrl,
            fileType: ext,
          }),
        }).catch((err) => console.error("Failed to queue document processing", err));
      }

      setProgress(100);
      setStatus("success");

      setTimeout(() => {
        setFile(null);
        setStatus("idle");
        setProgress(0);
        setSelectedSubjectId("");
        onUploadComplete();
      }, 2000);
    } catch (err: unknown) {
      console.error("Upload failed", err);
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setErrorMsg("");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <CloudUpload className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Upload Academic Material
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            PDF · DOCX · PPTX · TXT · Images &nbsp;·&nbsp; Max 50 MB per file
          </p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {/* Drop zone — only visible when no file is selected */}
        {status === "idle" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-12 px-6 text-center cursor-pointer transition-all duration-200 group",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border/60 hover:border-primary/40 hover:bg-primary/[0.02]"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div
              className={cn(
                "h-14 w-14 rounded-2xl border flex items-center justify-center mb-4 transition-all duration-200",
                isDragging
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-secondary/80 border-border/40 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20"
              )}
            >
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {isDragging ? "Drop to upload" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              or click anywhere in this area to browse
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {["PDF", "DOCX", "PPTX", "TXT", "Images"].map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-secondary/80 border border-border/40 text-[10px] font-semibold text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error banner when no file is selected */}
        {status === "error" && !file && (
          <div>
            <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/5 p-3 rounded-xl border border-destructive/15 mb-3">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {/* Show drop zone again so user can retry */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border/60 hover:border-primary/40 rounded-xl flex flex-col items-center justify-center py-8 px-6 text-center cursor-pointer transition-all duration-200"
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Upload className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="text-xs font-medium text-muted-foreground">Click to try again</p>
            </div>
          </div>
        )}

        {/* File preview + upload controls */}
        {file && (
          <div className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-4">
            {/* File info */}
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
                {getFileIcon(
                  file.name.split(".").pop(),
                  "h-5 w-5"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold text-foreground truncate"
                  title={file.name}
                >
                  {file.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold bg-secondary/70 px-1.5 py-0.5 rounded-md border border-border/30">
                    {file.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
              </div>
              {status === "selected" && (
                <button
                  onClick={reset}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Subject selector */}
            {status === "selected" && subjects.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Assign to Subject (optional)
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-secondary/50 text-foreground text-xs px-3 py-2 outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors cursor-pointer"
                >
                  <option value="">Let AI classify automatically</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.code ? ` (${s.code})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  AI will auto-classify if no subject is selected.
                </p>
              </div>
            )}

            {/* Error during upload */}
            {status === "error" && (
              <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/5 p-3 rounded-lg border border-destructive/15">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success message */}
            {status === "success" && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/15">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Upload complete! File saved and AI processing started.</span>
              </div>
            )}

            {/* Progress bar */}
            {(status === "uploading" || status === "success") && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {status === "uploading" && (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    )}
                    <span>
                      {status === "success"
                        ? "Finalizing & processing…"
                        : progress < 30
                        ? "Preparing upload…"
                        : progress < 75
                        ? "Uploading securely…"
                        : "Saving metadata…"}
                    </span>
                  </div>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-secondary" />
              </div>
            )}

            {/* Action buttons */}
            {(status === "selected" || status === "error") && (
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/20">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="text-xs h-8 text-muted-foreground cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  className="text-xs h-8 min-w-[110px] cursor-pointer gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Info strip */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground border-t border-border/30 pt-4">
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            <span>Max 50 MB per file</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>Files are processed by AI for summaries & quizzes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Uploads appear in your history below</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File Detail Panel (inline slide-in)
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

  return (
    <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
            {getFileIcon(doc.file_type, "h-5 w-5")}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate" title={doc.title}>
              {doc.title}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">
              {doc.file_type?.toUpperCase() || "File"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            icon: <Calendar className="h-3.5 w-3.5" />,
            label: "Upload Date",
            value: formatDate(doc.created_at),
          },
          {
            icon: <HardDrive className="h-3.5 w-3.5" />,
            label: "File Size",
            value: formatFileSize(fileSize),
          },
          {
            icon: <Tag className="h-3.5 w-3.5" />,
            label: "Subject",
            value: subject?.name || doc.ai_subject || "Unclassified",
          },
          {
            icon: <Info className="h-3.5 w-3.5" />,
            label: "AI Status",
            value:
              doc.summary_status === "completed"
                ? "Processed"
                : doc.summary_status === "processing"
                ? "Processing…"
                : doc.summary_status === "failed"
                ? "Failed"
                : "Pending",
          },
        ].map((row) => (
          <div
            key={row.label}
            className="bg-secondary/40 rounded-lg px-3 py-2.5 border border-border/30"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              {row.icon}
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {row.label}
              </span>
            </div>
            <p className="text-xs font-semibold text-foreground truncate">
              {row.value}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 cursor-pointer gap-1.5"
          onClick={() => doc.file_url && window.open(doc.file_url, "_blank")}
          disabled={!doc.file_url}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open File
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 cursor-pointer gap-1.5"
          onClick={() => onNavigate(`/assistant?documentId=${doc.id}`)}
        >
          <BrainCircuit className="h-3.5 w-3.5" />
          Study with AI
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 cursor-pointer gap-1.5"
          onClick={() => onNavigate(`/uploads/${doc.id}/summary`)}
        >
          <ScrollText className="h-3.5 w-3.5" />
          Summary
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 cursor-pointer gap-1.5"
          onClick={() => onNavigate(`/uploads/${doc.id}/quiz`)}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Quiz
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer gap-1.5"
        onClick={() => onDelete(doc.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Move to Recycle Bin
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload History Table (Section 2)
// ---------------------------------------------------------------------------

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pdf", label: "PDF" },
  { key: "docx", label: "DOCX" },
  { key: "pptx", label: "PPTX" },
  { key: "txt", label: "TXT" },
  { key: "image", label: "Images" },
  { key: "completed", label: "Completed" },
  { key: "processing", label: "Processing" },
  { key: "failed", label: "Failed" },
];

function UploadHistorySection({
  documents,
  subjects,
}: {
  documents: DocumentRow[];
  subjects: SubjectItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
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

  // Filter
  const filtered = useMemo(() => {
    return documents.filter((d) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const subName = d.subject_id ? (subjectMap.get(d.subject_id) || "") : (d.ai_subject || "");
        if (
          !d.title.toLowerCase().includes(q) &&
          !subName.toLowerCase().includes(q) &&
          !(d.file_type || "").toLowerCase().includes(q)
        )
          return false;
      }

      // Type/status filter
      if (filter === "image") return isImageType(d.file_type);
      if (filter === "completed")
        return d.summary_status === "completed" || d.quiz_status === "completed";
      if (filter === "processing")
        return d.summary_status === "processing" || d.quiz_status === "processing";
      if (filter === "failed")
        return d.summary_status === "failed" || d.quiz_status === "failed";
      if (filter !== "all")
        return (d.file_type || "").toLowerCase() === filter;

      return true;
    });
  }, [documents, search, filter, subjectMap]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "date")
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "size")
        cmp = (a.uploads?.file_size || 0) - (b.uploads?.file_size || 0);
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

  const handleFilter = (key: FilterKey) => {
    setFilter(key);
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

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k)
      return <ChevronUp className="h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );
  };

  const SortHeader = ({
    sortKeyVal,
    label,
    className,
  }: {
    sortKeyVal: SortKey;
    label: string;
    className?: string;
  }) => (
    <th
      className={cn(
        "px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors",
        className
      )}
      onClick={() => handleSort(sortKeyVal)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon k={sortKeyVal} />
      </span>
    </th>
  );

  const detailDoc = detailDocId
    ? documents.find((d) => d.id === detailDocId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Upload History</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {documents.length === 0
              ? "No uploads yet"
              : `${documents.length} file${documents.length !== 1 ? "s" : ""} uploaded`}
          </p>
        </div>
        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search files, subjects…"
            className="pl-8 h-8 text-xs bg-background/80 border-border/60"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleFilter(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer border",
              filter === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
        {/* Result count badge */}
        <span className="ml-auto shrink-0 text-[10px] font-semibold text-muted-foreground bg-secondary/50 border border-border/40 px-2 py-1 rounded-md">
          {sorted.length} result{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Empty State */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border/50 bg-card/30">
          <div className="h-16 w-16 rounded-2xl bg-secondary/60 border border-border/40 flex items-center justify-center mb-5">
            <FolderOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No uploaded materials yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Upload your first lecture, notes, assignment, or study material
            using the area above to begin.
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border/50 bg-card/30">
          <Search className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No results found</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting your search or filter.
          </p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Table container */}
          <div className="flex-1 min-w-0 rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border/50 bg-secondary/30">
                  <tr>
                    <SortHeader sortKeyVal="name" label="File Name" className="min-w-[200px]" />
                    <SortHeader sortKeyVal="subject" label="Subject" className="min-w-[140px]" />
                    <SortHeader sortKeyVal="type" label="Type" className="min-w-[80px]" />
                    <SortHeader sortKeyVal="size" label="Size" className="min-w-[80px]" />
                    <SortHeader sortKeyVal="date" label="Date" className="min-w-[120px]" />
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[110px]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16">
                      Actions
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
                            : "hover:bg-secondary/30"
                        )}
                      >
                        {/* File Name */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              setDetailDocId(isSelected ? null : doc.id)
                            }
                            className="flex items-center gap-2.5 text-left w-full group/name"
                          >
                            <div className="h-7 w-7 rounded-md bg-secondary/60 border border-border/30 flex items-center justify-center shrink-0">
                              {getFileIcon(doc.file_type)}
                            </div>
                            <span
                              className="text-xs font-medium text-foreground truncate max-w-[160px] group-hover/name:text-primary transition-colors"
                              title={doc.title}
                            >
                              {doc.title}
                            </span>
                          </button>
                        </td>
                        {/* Subject */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground truncate max-w-[130px] block">
                            {subjectName || (
                              <span className="italic opacity-60">Unclassified</span>
                            )}
                          </span>
                        </td>
                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground bg-secondary/60 border border-border/30 px-1.5 py-0.5 rounded-md">
                            {doc.file_type?.toUpperCase() || "—"}
                          </span>
                        </td>
                        {/* Size */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatFileSize(doc.uploads?.file_size)}
                          </span>
                        </td>
                        {/* Date */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(doc.created_at)}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          {getStatusBadge(doc.summary_status, doc.quiz_status)}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                }
                              />
                              <DropdownMenuContent
                                align="end"
                                className="w-48 bg-card/95 border border-border/70 shadow-2xl backdrop-blur-md"
                              >
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
                                  Generate Summary
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer"
                                  onClick={() =>
                                    handleNavigate(`/uploads/${doc.id}/quiz`)
                                  }
                                >
                                  <HelpCircle className="h-3.5 w-3.5 mr-2" />
                                  Generate Quiz
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

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border/30">
              {paginated.map((doc) => {
                const subjectName = doc.subject_id
                  ? subjectMap.get(doc.subject_id)
                  : doc.ai_subject;
                const isDeleting = deletingId === doc.id;

                return (
                  <div key={doc.id} className="p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
                      {getFileIcon(doc.file_type, "h-4.5 w-4.5")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-semibold text-foreground truncate"
                        title={doc.title}
                      >
                        {doc.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {subjectName || "Unclassified"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatFileSize(doc.uploads?.file_size)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        {getStatusBadge(doc.summary_status, doc.quiz_status)}
                      </div>
                    </div>
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors cursor-pointer shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent
                          align="end"
                          className="w-44 bg-card/95 border border-border/70 shadow-2xl backdrop-blur-md"
                        >
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
                            onClick={() =>
                              handleNavigate(`/assistant?documentId=${doc.id}`)
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
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Table footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-secondary/20">
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
                    className="h-7 w-7 p-0 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {/* Page numbers (show max 5 around current) */}
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
                          onClick={() => setPage(p as number)}
                          className={cn(
                            "h-7 w-7 text-[11px] font-semibold rounded-md transition-colors cursor-pointer",
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
                    className="h-7 w-7 p-0 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* File Detail Panel — slide in beside table */}
          {detailDoc && (
            <div className="hidden lg:block w-72 shrink-0">
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

export function UploadCenter({ documents, subjects }: UploadCenterProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleUploadComplete = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      {/* Section 1: Upload Area */}
      <UploadArea subjects={subjects} onUploadComplete={handleUploadComplete} />

      {/* Section divider */}
      <div className="relative flex items-center gap-4">
        <div className="flex-1 border-t border-border/40" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
          Upload History
        </span>
        <div className="flex-1 border-t border-border/40" />
      </div>

      {/* Section 2: History */}
      <UploadHistorySection documents={documents} subjects={subjects} />
    </div>
  );
}
