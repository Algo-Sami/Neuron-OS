"use client";

import React, { useState } from "react";
import { ChevronRight, FolderOpen, Copy, Check } from "lucide-react";
import { BreadcrumbSegment } from "@/types/explorer";
import { cn } from "@/lib/utils";

interface ExplorerBreadcrumbProps {
  segments: BreadcrumbSegment[];
  onNavigate: (subjectId: string | null, folderId: string | null) => void;
}

export function ExplorerBreadcrumb({ segments, onNavigate }: ExplorerBreadcrumbProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPath = () => {
    const path = "Subjects" + segments.map((s) => ` > ${s.label}`).join("");
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 h-8 bg-background/50 hover:bg-background/80 focus-within:bg-background border border-border/50 focus-within:border-primary/50 rounded-md px-2 transition-all duration-150 group cursor-default">
      
      {/* Windows Explorer–style folder icon */}
      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mr-0.5" />

      {/* Address segments */}
      <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
        {/* Root */}
        <button
          onClick={() => onNavigate(null, null)}
          className={cn(
            "text-[11px] font-medium px-1.5 py-0.5 rounded transition-colors shrink-0",
            segments.length === 0
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          Subjects
        </button>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <React.Fragment key={`${segment.subjectId}-${segment.folderId}-${index}`}>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <button
                onClick={() => onNavigate(segment.subjectId, segment.folderId)}
                className={cn(
                  "flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors shrink-0 max-w-[160px] truncate",
                  isLast
                    ? "text-foreground font-semibold bg-secondary/40"
                    : "text-muted-foreground font-medium hover:text-foreground hover:bg-secondary/60"
                )}
                title={segment.label}
              >
                {index === 0 && segment.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0 inline-block"
                    style={{ backgroundColor: segment.color }}
                  />
                )}
                <span className="truncate">{segment.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Copy path button */}
      <button
        onClick={handleCopyPath}
        title="Copy path"
        className="opacity-0 group-hover:opacity-100 ml-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all shrink-0"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-400" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
