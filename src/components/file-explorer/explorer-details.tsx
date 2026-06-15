"use client";

import React from "react";
import {
  FileText,
  Folder,
  Layers,
  Zap,
  ArrowRight,
  Brain,
  BrainCircuit,
  MessageSquare,
  Clock,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExplorerItemData } from "@/types/explorer";

interface ExplorerDetailsProps {
  selectedItems: ExplorerItemData[];
  onGenerateSummary?: (id: string) => void;
  onGenerateQuiz?: (id: string) => void;
  onStudyWithAI?: (id: string) => void;
  onClose?: () => void;
  isModalMode?: boolean;
}

export function ExplorerDetails({
  selectedItems,
  onGenerateSummary,
  onGenerateQuiz,
  onStudyWithAI,
  onClose,
  isModalMode = false,
}: ExplorerDetailsProps) {
  const hasSelection = selectedItems.length > 0;
  const isMultiple = selectedItems.length > 1;

  const formatSize = (bytes?: number | null) => {
    if (bytes === undefined || bytes === null) return "0.00 MB";
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getAiStatus = (item: ExplorerItemData) => {
    if (item.type !== "file") return null;
    const status = item.summaryStatus || item.aiStatus;
    if (status === "completed" || status === "processed") return "processed";
    if (status === "processing") return "processing";
    if (status === "failed") return "failed";
    return "pending";
  };

  // --- MODAL MODE ---
  if (isModalMode) {
    if (isMultiple) {
      const totalSize = selectedItems.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
      const filesCount = selectedItems.filter((item) => item.type === "file").length;
      const foldersCount = selectedItems.filter((item) => item.type !== "file").length;

      return (
        <div className="space-y-4 py-2 select-none">
          <div className="flex items-center gap-3 bg-secondary/15 p-3 rounded-lg border border-border/20">
            <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shadow-sm shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedItems.length} Items Selected</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {foldersCount} folder{foldersCount !== 1 ? "s" : ""}, {filesCount} file{filesCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs border-t border-border/20 pt-3">
            <div className="flex justify-between py-1 border-b border-border/10">
              <span className="text-muted-foreground">Total Size:</span>
              <span className="font-semibold text-foreground">{formatSize(totalSize)}</span>
            </div>
          </div>
        </div>
      );
    }

    if (!hasSelection) {
      return (
        <div className="text-center py-6 select-none">
          <p className="text-xs text-muted-foreground">No items selected to view properties.</p>
        </div>
      );
    }

    const item = selectedItems[0];
    const status = getAiStatus(item);

    return (
      <div className="space-y-4 py-2 select-none overflow-y-auto max-h-[80vh] no-scrollbar">
        {/* Header Block */}
        <div className="flex items-start gap-4 pb-3 border-b border-border/20">
          <div className={`h-12 w-12 rounded-xl shrink-0 flex items-center justify-center shadow-sm ${
            item.type === "subject"
              ? `${item.color || "bg-blue-500"} text-white`
              : "bg-secondary/80 border border-border/40 text-muted-foreground"
          }`}>
            {item.type === "subject" ? (
              <Layers className="h-6 w-6" />
            ) : item.type === "folder" ? (
              <Folder className="h-6 w-6 text-blue-400" />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground break-words leading-tight" title={item.name}>
              {item.name}
            </h3>
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-secondary/80 text-[9px] text-muted-foreground uppercase font-bold tracking-wider border border-border/40">
              {item.type === "subject" ? "Subject Portal" : item.type === "folder" ? "Folder" : `${item.fileType?.toUpperCase()} File`}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          {item.code && (
            <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
              <span className="text-muted-foreground text-[10px]">Course Code</span>
              <span className="font-semibold text-foreground uppercase">{item.code}</span>
            </div>
          )}

          {item.type === "file" && item.fileSize && (
            <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
              <span className="text-muted-foreground text-[10px]">File Size</span>
              <span className="font-semibold text-foreground">{formatSize(item.fileSize)}</span>
            </div>
          )}

          <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
            <span className="text-muted-foreground text-[10px]">Created Date</span>
            <span className="font-semibold text-foreground">{formatDate(item.createdAt)}</span>
          </div>

          {item.modifiedAt && (
            <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
              <span className="text-muted-foreground text-[10px]">Last Modified</span>
              <span className="font-semibold text-foreground">{formatDate(item.modifiedAt)}</span>
            </div>
          )}

          {item.lastStudied && (
            <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
              <span className="text-muted-foreground text-[10px]">Last Studied</span>
              <span className="font-semibold text-foreground">{formatDate(item.lastStudied)}</span>
            </div>
          )}

          {item.type !== "file" && (
            <>
              <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
                <span className="text-muted-foreground text-[10px]">Folders Count</span>
                <span className="font-semibold text-foreground">{item.folderCount || 0}</span>
              </div>
              <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
                <span className="text-muted-foreground text-[10px]">Documents Count</span>
                <span className="font-semibold text-foreground">{item.documentCount || 0}</span>
              </div>
            </>
          )}

          {item.type === "file" && (
            <>
              {item.aiSubject && (
                <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
                  <span className="text-muted-foreground text-[10px]">AI Subject</span>
                  <span className="font-semibold text-primary truncate">{item.aiSubject}</span>
                </div>
              )}
              {item.aiTopic && (
                <div className="flex flex-col gap-0.5 border-b border-border/10 pb-1.5">
                  <span className="text-muted-foreground text-[10px]">AI Folder</span>
                  <span className="font-semibold text-blue-400 truncate">{item.aiTopic}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* AI & Quick Actions Section */}
        {item.type === "file" && (
          <div className="space-y-3 pt-3 border-t border-border/20">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Academic Status</h4>
            
            <div className="grid grid-cols-2 gap-2 bg-secondary/15 p-2.5 rounded-lg border border-border/20 text-[10px] font-medium text-muted-foreground">
              <div className="flex items-center justify-between border-r border-border/20 pr-2">
                <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3 text-primary/75" /> Summary:</span>
                <span className={`px-1.5 py-0.25 rounded border text-[8px] font-bold capitalize ${
                  status === "processed"
                    ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/15"
                    : status === "failed"
                    ? "bg-red-500/5 text-red-400 border-red-500/15"
                    : "bg-amber-500/5 text-amber-400 border-amber-500/15 animate-pulse"
                }`}>
                  {status || "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between pl-2">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-blue-400/80" /> Quiz:</span>
                <span className={`px-1.5 py-0.25 rounded border text-[8px] font-bold capitalize ${
                  item.quizStatus === "generated" || item.quizStatus === "completed"
                    ? "bg-blue-500/5 text-blue-400 border-blue-500/15"
                    : "bg-zinc-500/5 text-zinc-400 border-zinc-500/15"
                }`}>
                  {item.quizStatus === "generated" || item.quizStatus === "completed" ? "Available" : "Not Started"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {item.summaryStatus === "completed" ? (
                <Link href={`/uploads/${item.id}/summary`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full h-8 text-[10px] border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-lg cursor-pointer text-primary font-semibold flex items-center justify-center gap-1.5">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Study Guide
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateSummary && onGenerateSummary(item.id)}
                  disabled={item.summaryStatus === "processing"}
                  className="flex-1 h-8 text-[10px] rounded-lg cursor-pointer font-semibold flex items-center justify-center gap-1.5"
                >
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Generate Summary
                </Button>
              )}

              {onStudyWithAI && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStudyWithAI(item.id)}
                  className="flex-1 h-8 text-[10px] border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 rounded-lg cursor-pointer text-purple-400 font-semibold flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat with PDF
                </Button>
              )}
            </div>

            {item.fileUrl && (
              <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] rounded-lg cursor-pointer font-semibold flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground border border-border/20">
                  <Download className="h-3.5 w-3.5" />
                  Download File
                </Button>
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- STANDARD DRAWER MODE ---
  if (isMultiple) {
    const totalSize = selectedItems.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
    const filesCount = selectedItems.filter((item) => item.type === "file").length;
    const foldersCount = selectedItems.filter((item) => item.type !== "file").length;

    return (
      <div className="flex flex-col h-full bg-card/10 border-l border-border/60 p-4 select-none animate-in fade-in duration-200 w-72 shrink-0">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Selection Properties</h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary/80 border border-border/40 flex items-center justify-center text-primary shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">{selectedItems.length} Items Selected</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {foldersCount} folder{foldersCount !== 1 ? "s" : ""}, {filesCount} file{filesCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-2.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Size:</span>
              <span className="font-semibold text-foreground">{formatSize(totalSize)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSelection) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-card/10 border-l border-border/60 p-6 text-center select-none w-72 shrink-0">
        <div className="h-12 w-12 rounded-2xl bg-secondary/50 border border-border/40 flex items-center justify-center text-muted-foreground/50 mb-3 shadow-inner">
          <Clock className="h-5 w-5" />
        </div>
        <h3 className="text-xs font-semibold text-foreground">Properties Panel</h3>
        <p className="text-[10px] text-muted-foreground mt-1 max-w-[170px] leading-relaxed">
          Select any course folder or lecture notes file to view properties and access AI study workflows.
        </p>
      </div>
    );
  }

  const item = selectedItems[0];
  const status = getAiStatus(item);

  return (
    <div className="flex flex-col h-full bg-card/20 border-l border-border/60 p-4 select-none animate-in slide-in-from-right-3 duration-200 w-72 shrink-0 overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Properties</h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground md:hidden cursor-pointer">
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4.5 flex-1">
        <div className="flex items-start gap-3">
          <div className={`h-11 w-11 rounded-xl shrink-0 flex items-center justify-center shadow-sm ${
            item.type === "subject"
              ? `${item.color || "bg-blue-500"} text-white`
              : "bg-secondary/80 border border-border/40 text-muted-foreground"
          }`}>
            {item.type === "subject" ? (
              <Layers className="h-5 w-5" />
            ) : item.type === "folder" ? (
              <Folder className="h-5 w-5 text-blue-400" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-foreground break-words leading-tight" title={item.name}>
              {item.name}
            </h3>
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-secondary/80 text-[8px] text-muted-foreground uppercase font-bold tracking-wider border border-border/40">
              {item.type === "subject" ? "Subject Portal" : item.type === "folder" ? "Folder" : `${item.fileType?.toUpperCase()} File`}
            </span>
          </div>
        </div>

        <div className="border-t border-border/40 pt-4 space-y-2.5 text-[10px]">
          {item.code && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Course Code:</span>
              <span className="font-semibold text-foreground uppercase">{item.code}</span>
            </div>
          )}

          {item.type === "file" && item.fileSize && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">File Size:</span>
              <span className="font-semibold text-foreground">{formatSize(item.fileSize)}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Created Date:</span>
            <span className="font-semibold text-foreground">{formatDate(item.createdAt)}</span>
          </div>

          {item.modifiedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Modified:</span>
              <span className="font-semibold text-foreground">{formatDate(item.modifiedAt)}</span>
            </div>
          )}

          {item.lastStudied && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Studied:</span>
              <span className="font-semibold text-foreground">{formatDate(item.lastStudied)}</span>
            </div>
          )}

          {item.type !== "file" && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Folders Count:</span>
                <span className="font-semibold text-foreground">{item.folderCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Documents Count:</span>
                <span className="font-semibold text-foreground">{item.documentCount || 0}</span>
              </div>
            </>
          )}

          {item.type === "file" && (
            <>
              {item.aiSubject && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Subject:</span>
                  <span className="font-semibold text-primary truncate max-w-[130px]">{item.aiSubject}</span>
                </div>
              )}
              {item.aiTopic && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Folder:</span>
                  <span className="font-semibold text-blue-400 truncate max-w-[130px]">{item.aiTopic}</span>
                </div>
              )}
            </>
          )}
        </div>

        {item.type === "file" && (
          <div className="border-t border-border/40 pt-4 flex flex-col gap-3 flex-1 mt-1">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Academic Tools</h4>
            
            <div className="flex flex-col gap-2 bg-secondary/15 p-2.5 rounded-lg border border-border/40 text-[9px] font-medium text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><BrainCircuit className="h-3 w-3 text-primary/75" /> AI Summary:</span>
                <span className={`px-1.5 py-0.25 rounded border text-[8px] font-bold capitalize ${
                  status === "processed"
                    ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/15"
                    : status === "failed"
                    ? "bg-red-500/5 text-red-400 border-red-500/15"
                    : "bg-amber-500/5 text-amber-400 border-amber-500/15 animate-pulse"
                }`}>
                  {status || "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-blue-400/80" /> AI Quiz:</span>
                <span className={`px-1.5 py-0.25 rounded border text-[8px] font-bold capitalize ${
                  item.quizStatus === "generated" || item.quizStatus === "completed"
                    ? "bg-blue-500/5 text-blue-400 border-blue-500/15"
                    : "bg-zinc-500/5 text-zinc-400 border-zinc-500/15"
                }`}>
                  {item.quizStatus === "generated" || item.quizStatus === "completed" ? "Available" : "Not Started"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {item.summaryStatus === "completed" ? (
                <Link href={`/uploads/${item.id}/summary`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full h-8 text-[10px] border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-lg cursor-pointer text-primary font-semibold flex items-center justify-center gap-1.5">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Open Study Guide
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateSummary && onGenerateSummary(item.id)}
                  disabled={item.summaryStatus === "processing"}
                  className="w-full h-8 text-[10px] rounded-lg cursor-pointer font-semibold flex items-center justify-center gap-1.5"
                >
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Generate Summary
                </Button>
              )}

              {onGenerateQuiz && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateQuiz(item.id)}
                  className="w-full h-8 text-[10px] border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg cursor-pointer text-blue-400 font-semibold flex items-center justify-center gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Practice AI Quiz
                </Button>
              )}

              {onStudyWithAI && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStudyWithAI(item.id)}
                  className="w-full h-8 text-[10px] border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 rounded-lg cursor-pointer text-purple-400 font-semibold flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat with PDF
                </Button>
              )}

              <Link href="/study-coach" className="w-full">
                <Button variant="outline" size="sm" className="w-full h-8 text-[10px] rounded-lg cursor-pointer font-semibold flex items-center justify-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  AI Study Coach
                </Button>
              </Link>

              {item.fileUrl && (
                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] rounded-lg cursor-pointer font-semibold flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Download className="h-3.5 w-3.5" />
                    Download File
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
