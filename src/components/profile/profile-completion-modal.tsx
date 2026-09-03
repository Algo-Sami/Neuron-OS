"use client";

/**
 * ProfileCompletionModal
 *
 * A floating, non-blocking nudge that appears in the bottom-right corner
 * of the dashboard for users whose profile is incomplete.
 *
 * Behavior:
 * - Appears with a slide-up animation 2 seconds after mount.
 * - Dismissed per session only (sessionStorage). Reappears on the next login.
 * - Automatically stops showing once the user reaches 100%.
 * - Does NOT block any UI or navigation.
 * - Fetches the completion score from the server on mount.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowRight, CheckCircle2 } from "lucide-react";
import type { ProfileCompletionResult } from "@/lib/profile-completion";

const SESSION_KEY = "neuron_profile_modal_dismissed";

export function ProfileCompletionModal() {
  const router = useRouter();
  const [data, setData] = useState<ProfileCompletionResult | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // ── Fetch completion data on mount ──
  useEffect(() => {
    // Honour session dismiss — don't even fetch if already dismissed this session
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }

    (async () => {
      try {
        const { getProfileCompletionData } = await import("@/actions/profile");
        const result = await getProfileCompletionData();
        if (result && result.percentage < 100) {
          setData(result);
        }
        // If null (unauthenticated) or 100%, we simply don't show
      } catch {
        // Silently fail — never crash the dashboard for a nudge widget
      }
    })();
  }, []);

  // ── Slide-in with 2s delay after data is ready ──
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [data]);

  // ── Dismiss for the current session ──
  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  };

  // ── Navigate to profile page ──
  const handleCTA = () => {
    handleDismiss();
    router.push("/profile");
  };

  // Don't render anything if not needed
  if (!data || dismissed || data.percentage >= 100) return null;

  const { percentage, nextStep } = data;

  // Determine ring color based on percentage
  const ringColor =
    percentage >= 75 ? "#22c55e"  // green
    : percentage >= 50 ? "#38bdf8" // sky
    : "#f59e0b";                   // amber

  // SVG ring math
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      role="complementary"
      aria-label="Profile completion nudge"
      className={`
        fixed bottom-6 right-6 z-50
        w-[300px] bg-white border border-slate-200
        rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)]
        transition-all duration-500 ease-out
        ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"}
      `}
    >
      {/* ── Dismiss button ── */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss profile completion nudge"
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="p-4">
        {/* ── Header row: ring + text ── */}
        <div className="flex items-center gap-3.5 mb-3.5">
          {/* Circular progress ring */}
          <div className="relative shrink-0 w-11 h-11">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
              {/* Track */}
              <circle
                cx="22" cy="22" r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="4"
              />
              {/* Progress */}
              <circle
                cx="22" cy="22" r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700"
              />
            </svg>
            {/* Percentage label */}
            <span
              className="absolute inset-0 flex items-center justify-center text-[9px] font-black"
              style={{ color: ringColor }}
            >
              {percentage}%
            </span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 leading-tight">
              Profile {percentage}% Complete
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
              Unlock personalized recommendations
            </p>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3.5">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percentage}%`, backgroundColor: ringColor }}
          />
        </div>

        {/* ── Next step hint ── */}
        <div className="flex items-start gap-2 mb-4 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ringColor }} />
          <p className="text-[10px] text-slate-600 leading-relaxed flex-1">
            <span className="font-semibold text-slate-800">Next: </span>
            {nextStep}
          </p>
        </div>

        {/* ── CTA button ── */}
        <button
          type="button"
          onClick={handleCTA}
          className="w-full h-8 flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-xl text-white transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: "#0F172A" }}
        >
          Complete Profile <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* ── Optional decorative top stripe ── */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ backgroundColor: ringColor }}
      />
    </div>
  );
}

// ─── Completion Checklist (used on the Profile page) ──────────────────────────
// Exported separately so profile/page.tsx can import just what it needs.

interface ChecklistProps {
  data: ProfileCompletionResult;
}

export function ProfileCompletionChecklist({ data }: ChecklistProps) {
  const { percentage, missing } = data;

  if (percentage >= 100) {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-xs font-semibold text-emerald-700">
          Your profile is 100% complete. Great work! 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-900">Profile Completion</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {missing.length} item{missing.length !== 1 ? "s" : ""} remaining
          </p>
        </div>
        <span
          className="text-sm font-black"
          style={{
            color: percentage >= 75 ? "#22c55e" : percentage >= 50 ? "#38bdf8" : "#f59e0b",
          }}
        >
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: percentage >= 75 ? "#22c55e" : percentage >= 50 ? "#38bdf8" : "#f59e0b",
          }}
        />
      </div>

      {/* Missing items list */}
      <ul className="space-y-1.5">
        {missing.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[11px] text-slate-600">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
