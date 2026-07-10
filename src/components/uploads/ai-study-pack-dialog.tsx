"use client";

/**
 * AI Study Pack Confirmation Dialog
 *
 * Shown for Category 2 (assessment) files before triggering AI generation.
 * Includes a "Remember my choice" option that persists the decision in UserPreferences.
 */

import React, { useState } from "react";
import {
  BrainCircuit,
  Sparkles,
  BookOpen,
  FileText,
  Layers,
  HelpCircle,
  X,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIStudyPackDialogProps {
  open: boolean;
  fileName: string;
  fileTypeLabel: string; // e.g. "Assignment", "Quiz"
  onGenerate: (remember: boolean) => void;
  onSkip: (remember: boolean) => void;
  onCancel: () => void;
}

// ── Resource Preview ──────────────────────────────────────────────────────────

const RESOURCES = [
  { icon: FileText,   label: "Chapter Summary",        color: "text-blue-400" },
  { icon: Layers,     label: "Key Concepts & Terms",   color: "text-emerald-400" },
  { icon: BookOpen,   label: "Important Definitions",  color: "text-violet-400" },
  { icon: Zap,        label: "Flashcards",             color: "text-yellow-400" },
  { icon: HelpCircle, label: "MCQ Practice Questions", color: "text-rose-400" },
  { icon: Sparkles,   label: "Practice Question Set",  color: "text-cyan-400" },
];

// ── Dialog ────────────────────────────────────────────────────────────────────

export function AIStudyPackDialog({
  open,
  fileName,
  fileTypeLabel,
  onGenerate,
  onSkip,
  onCancel,
}: AIStudyPackDialogProps) {
  const [remember, setRemember] = useState(false);

  if (!open) return null;

  const truncatedName =
    fileName.length > 42 ? fileName.substring(0, 42) + "…" : fileName;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className={cn(
          "fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-full max-w-[440px] rounded-2xl overflow-hidden",
          "border border-white/10 shadow-2xl shadow-black/60",
          "bg-[#0f1117]/95 backdrop-blur-2xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top gradient bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <BrainCircuit className="h-5 w-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-bold text-white tracking-tight">
              Generate AI Study Pack?
            </h2>
            <p className="text-[11px] text-white/50 mt-0.5 truncate">
              <span className="text-violet-400 font-medium">{fileTypeLabel}</span>
              {" · "}
              {truncatedName}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors shrink-0 -mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5">
          {/* Description */}
          <p className="text-[12px] text-white/55 leading-relaxed mb-4">
            This file appears to be{" "}
            <span className="text-white/80 font-medium">{fileTypeLabel.toLowerCase()}</span> material.
            Neuron AI can generate a complete set of study resources for this document:
          </p>

          {/* Resource list */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 mb-4 grid grid-cols-2 gap-1">
            {RESOURCES.map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
                <span className="text-[11px] text-white/65 truncate">{label}</span>
              </div>
            ))}
          </div>

          {/* Remember choice */}
          <label className="flex items-center gap-2.5 cursor-pointer group mb-5">
            <div
              onClick={() => setRemember((v) => !v)}
              className={cn(
                "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all",
                remember
                  ? "bg-violet-500 border-violet-500"
                  : "border-white/20 bg-transparent group-hover:border-white/40"
              )}
            >
              {remember && (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-[11.5px] text-white/50 group-hover:text-white/70 transition-colors select-none">
              Remember my choice for {fileTypeLabel.toLowerCase()} files
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Primary: Generate */}
            <button
              onClick={() => onGenerate(remember)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12.5px] font-semibold",
                "bg-gradient-to-r from-violet-500 to-blue-500 text-white",
                "hover:from-violet-400 hover:to-blue-400 transition-all shadow-lg shadow-violet-500/20",
                "active:scale-[0.98]"
              )}
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              Generate
              <ChevronRight className="h-3 w-3 opacity-70" />
            </button>

            {/* Secondary: Not Now */}
            <button
              onClick={() => onSkip(remember)}
              className={cn(
                "h-9 px-4 rounded-xl text-[12px] font-medium",
                "border border-white/10 text-white/60",
                "hover:bg-white/5 hover:text-white/80 hover:border-white/20 transition-all",
                "active:scale-[0.98]"
              )}
            >
              Not Now
            </button>

            {/* Tertiary: Cancel */}
            <button
              onClick={onCancel}
              className={cn(
                "h-9 px-4 rounded-xl text-[12px] font-medium",
                "text-white/35 hover:text-white/55 transition-colors",
                "active:scale-[0.98]"
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
