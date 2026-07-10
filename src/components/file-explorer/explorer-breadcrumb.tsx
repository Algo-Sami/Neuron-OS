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
    const path = "Neuron OS" + segments.map((s) => ` > ${s.label}`).join("");
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 h-8 rounded-md px-2 w-full group cursor-default",
        "bg-white dark:bg-[#252526]",
        "border border-[#e5e7eb] dark:border-[#3a3a3a]",
        "hover:border-[#d1d5db] dark:hover:border-[#4a4a4a]",
        "transition-colors duration-[120ms]"
      )}
    >
      {/* Windows-style folder icon */}
      <FolderOpen className="h-3.5 w-3.5 text-[#ffb300] shrink-0 mr-0.5" />

      {/* Address segments */}
      <nav className="flex items-center gap-0 overflow-x-auto no-scrollbar flex-1 min-w-0">
        {/* Root — "Neuron OS" */}
        <button
          onClick={() => onNavigate(null, null)}
          className={cn(
            "text-[12px] font-medium px-1.5 py-1 rounded-md transition-colors duration-[100ms] shrink-0 whitespace-nowrap",
            segments.length === 0
              ? "text-[#1f2937] dark:text-white font-semibold"
              : "text-[#6b7280] dark:text-[#9ca3af] hover:text-[#1f2937] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          )}
        >
          Neuron OS
        </button>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          return (
            <React.Fragment key={`${segment.subjectId}-${segment.folderId}-${index}`}>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9ca3af] dark:text-[#6b7280] mx-0.5" />
              <button
                onClick={() => onNavigate(segment.subjectId, segment.folderId)}
                title={segment.label}
                className={cn(
                  "flex items-center gap-1 text-[12px] px-1.5 py-1 rounded-md transition-colors duration-[100ms] shrink-0 max-w-[180px] truncate whitespace-nowrap",
                  isLast
                    ? "text-[#1f2937] dark:text-white font-semibold"
                    : "text-[#6b7280] dark:text-[#9ca3af] font-medium hover:text-[#1f2937] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                )}
              >
                {index === 0 && segment.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0 inline-block mr-0.5"
                    style={{ backgroundColor: segment.color }}
                  />
                )}
                <span className="truncate">{segment.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Copy path — revealed on hover */}
      <button
        onClick={handleCopyPath}
        title="Copy path"
        className="opacity-0 group-hover:opacity-100 ml-1 p-1 rounded-md text-[#9ca3af] hover:text-[#4b5563] dark:hover:text-[#d4d4d4] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-all duration-[100ms] shrink-0 cursor-pointer"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
