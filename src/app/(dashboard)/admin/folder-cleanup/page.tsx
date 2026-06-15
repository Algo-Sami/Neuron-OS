"use client";

import React, { useState, useTransition } from "react";
import {
  auditDuplicateFoldersAction,
  mergeDuplicateFoldersAction,
  type DuplicateReport,
} from "@/actions/folder-audit";
import { Loader2, FolderX, CheckCircle2, AlertTriangle, Merge, Search, ShieldCheck } from "lucide-react";

export default function FolderCleanupPage() {
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<DuplicateReport[] | null>(null);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  const [mergedItems, setMergedItems] = useState<Set<string>>(new Set());
  const [mergingItem, setMergingItem] = useState<string | null>(null);
  const [mergeResults, setMergeResults] = useState<Record<string, { mergedCount: number; filesPreserved: number }>>({});
  const [allDone, setAllDone] = useState(false);

  const runAudit = () => {
    startTransition(async () => {
      const result = await auditDuplicateFoldersAction();
      setReport(result.reports);
      setTotalDuplicates(result.totalDuplicateFolders);
    });
  };

  const mergeOne = async (subjectId: string, subjectName: string, folderName: string) => {
    const key = `${subjectId}::${folderName}`;
    setMergingItem(key);
    try {
      const result = await mergeDuplicateFoldersAction(subjectId, folderName);
      setMergedItems((prev) => new Set([...prev, key]));
      setMergeResults((prev) => ({ ...prev, [key]: result }));
    } catch (err) {
      console.error("Merge failed:", err);
      alert(`Merge failed for "${folderName}": ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setMergingItem(null);
    }
  };

  const mergeAll = async () => {
    if (!report) return;
    for (const subjectReport of report) {
      for (const dup of subjectReport.duplicates) {
        const key = `${subjectReport.subjectId}::${dup.folderName}`;
        if (mergedItems.has(key)) continue;
        await mergeOne(subjectReport.subjectId, subjectReport.subjectName, dup.folderName);
      }
    }
    setAllDone(true);
  };

  const totalPending = report
    ? report.reduce((sum, r) => sum + r.duplicates.filter((d) => !mergedItems.has(`${r.subjectId}::${d.folderName}`)).length, 0)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <FolderX className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl font-bold tracking-tight">Folder Duplicate Cleanup</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Scans all subjects for duplicate system folders and merges them safely. No files are ever deleted.
          </p>
        </div>

        {/* Run Audit Button */}
        {report === null && (
          <div className="rounded-xl border border-border/50 bg-card/40 p-8 flex flex-col items-center gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <Search className="h-7 w-7 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ready to Scan</p>
              <p className="text-xs text-muted-foreground mt-1">
                This will audit all your subjects for duplicate folders. Read-only — nothing is changed yet.
              </p>
            </div>
            <button
              onClick={runAudit}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/90 hover:bg-amber-500 text-black font-semibold text-sm rounded-lg transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Scanning…</>
              ) : (
                <><Search className="h-4 w-4" /> Run Audit</>
              )}
            </button>
          </div>
        )}

        {/* All Clean State */}
        {report !== null && report.length === 0 && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 flex flex-col items-center gap-3 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">All Clean!</p>
            <p className="text-xs text-muted-foreground">No duplicate folders found across any of your subjects.</p>
            <button onClick={runAudit} className="text-xs text-muted-foreground hover:text-foreground underline mt-1 cursor-pointer">
              Re-run audit
            </button>
          </div>
        )}

        {/* Report */}
        {report !== null && report.length > 0 && (
          <div className="space-y-5">

            {/* Summary banner */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">
                  {totalDuplicates} duplicate folder{totalDuplicates !== 1 ? "s" : ""} found across {report.length} subject{report.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Files inside duplicate folders will be moved to the primary folder. Empty duplicates will then be removed.
                </p>
              </div>
              {totalPending > 0 && (
                <button
                  onClick={mergeAll}
                  disabled={mergingItem !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/90 hover:bg-amber-500 text-black font-semibold text-xs rounded-lg transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {mergingItem ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Merging…</>
                  ) : (
                    <><Merge className="h-3 w-3" /> Merge All ({totalPending})</>
                  )}
                </button>
              )}
            </div>

            {/* Subject reports */}
            {report.map((subjectReport) => (
              <div key={subjectReport.subjectId} className="rounded-xl border border-border/50 bg-card/30 overflow-hidden">
                {/* Subject header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-secondary/20 border-b border-border/30">
                  <span className="text-sm font-semibold text-foreground">{subjectReport.subjectName}</span>
                  <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 bg-background/50 rounded-md border border-border/30">
                    {subjectReport.duplicates.length} duplicate group{subjectReport.duplicates.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Duplicate rows */}
                <div className="divide-y divide-border/20">
                  {subjectReport.duplicates.map((dup) => {
                    const key = `${subjectReport.subjectId}::${dup.folderName}`;
                    const isDone = mergedItems.has(key);
                    const isMerging = mergingItem === key;
                    const result = mergeResults[key];
                    const totalFiles = Object.values(dup.fileCountsPerFolder).reduce((a, b) => a + b, 0);

                    return (
                      <div key={key} className="flex items-start gap-3 px-4 py-3">
                        {/* Status icon */}
                        <div className="mt-0.5 shrink-0">
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <FolderX className="h-4 w-4 text-amber-400/80" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold text-foreground">📁 {dup.folderName}</span>
                            <span className="text-[10px] text-amber-400 font-medium">×{dup.count} copies</span>
                            {totalFiles > 0 && (
                              <span className="text-[10px] text-muted-foreground">{totalFiles} file{totalFiles !== 1 ? "s" : ""} to preserve</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{dup.mergeRecommendation}</p>

                          {/* Merge result */}
                          {isDone && result && (
                            <p className="text-[10px] text-emerald-400 mt-1">
                              ✓ Merged {result.mergedCount} duplicate{result.mergedCount !== 1 ? "s" : ""}
                              {result.filesPreserved > 0 ? ` · ${result.filesPreserved} file${result.filesPreserved !== 1 ? "s" : ""} preserved` : " · no files were affected"}
                            </p>
                          )}
                        </div>

                        {/* Action */}
                        {!isDone && (
                          <button
                            onClick={() => mergeOne(subjectReport.subjectId, subjectReport.subjectName, dup.folderName)}
                            disabled={isMerging || mergingItem !== null}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/40 hover:bg-secondary/70 border border-border/40 text-[11px] font-semibold text-foreground rounded-md transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed shrink-0"
                          >
                            {isMerging ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Merging…</>
                            ) : (
                              <><Merge className="h-3 w-3" /> Merge</>
                            )}
                          </button>
                        )}
                        {isDone && (
                          <span className="text-[10px] font-semibold text-emerald-400 shrink-0 mt-1">Done</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* All done */}
            {allDone && totalPending === 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">All duplicates cleaned!</p>
                  <p className="text-xs text-muted-foreground">All files have been preserved. Duplicate folders have been removed.</p>
                </div>
              </div>
            )}

            {/* Re-audit */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={runAudit}
                disabled={isPending || mergingItem !== null}
                className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Re-scanning…" : "Re-run audit to verify"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
