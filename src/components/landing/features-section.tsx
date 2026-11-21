"use client";

import { useEffect, useRef } from "react";
import {
  Brain,
  FileText,
  HelpCircle,
  Bell,
  MessageSquare,
  Users,
  Flame,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Smart Organization",
    description: "Automatically categorize and structure your notes, lectures, and materials into intelligent subject trees.",
    tag: "8-Layer AI",
    color: "text-sky-600 bg-sky-50 border-sky-100",
  },
  {
    icon: FileText,
    title: "AI Summaries",
    description: "Upload any lecture PDF, DOCX, or PPTX and get concise, structured AI summaries in seconds.",
    tag: "Study Packs",
    color: "text-blue-600 bg-blue-50 border-blue-100",
  },
  {
    icon: HelpCircle,
    title: "Quiz Generation",
    description: "Turn any lecture or note into an interactive quiz with MCQs, short answers, and instant AI feedback.",
    tag: "Adaptive Recall",
    color: "text-cyan-600 bg-cyan-50 border-cyan-100",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    description: "Extract assignment dates and exam schedules automatically from uploaded syllabi and course outlines.",
    tag: "Smart Schedules",
    color: "text-indigo-600 bg-indigo-50 border-indigo-100",
  },
  {
    icon: MessageSquare,
    title: "AI Chat with Notes",
    description: "Ask questions and get grounded answers cited directly from your course materials via vector search.",
    tag: "Instant RAG",
    color: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    icon: Users,
    title: "Study Rooms",
    description: "Collaborate with classmates in real time. Share summaries, study together, and prepare for exams.",
    tag: "Realtime",
    color: "text-violet-600 bg-violet-50 border-violet-100",
  },
  {
    icon: Flame,
    title: "XP & Streaks",
    description: "Earn XP, maintain study streaks, and unlock achievements as you review materials and take quizzes.",
    tag: "Gamified",
    color: "text-amber-600 bg-amber-50 border-amber-100",
  },
  {
    icon: ShieldCheck,
    title: "Zero-Hallucination Guard",
    description: "Every answer is strictly grounded in your uploaded documents, backed by strict confidence thresholds.",
    tag: "Strict Grounding",
    color: "text-teal-600 bg-teal-50 border-teal-100",
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      className="relative py-20 lg:py-28 bg-white border-b border-slate-200/70"
    >
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        {/* Header (Wasmer inspired) */}
        <div className="text-center mb-14 sm:mb-18 space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold uppercase tracking-wider">
            <span>Core Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Your Coursework. <span className="text-cyan-600">Your Mastery.</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            8 autonomous AI capabilities designed specifically for modern students to learn faster and retain more.
          </p>
        </div>

        {/* 8 Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {FEATURES.map(({ icon: Icon, title, description, tag, color }) => (
            <div
              key={title}
              className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.03)] hover:shadow-[0_16px_36px_-6px_rgba(15,23,42,0.08)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border shadow-xs ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                    {tag}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 group-hover:text-cyan-600 transition-colors">
                  {title}
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed">
                  {description}
                </p>
              </div>

              {/* Action arrow button (Wasmer inspired) */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">
                  Explore feature
                </span>
                <div className="h-8 w-8 rounded-full bg-slate-900 group-hover:bg-cyan-600 text-white flex items-center justify-center shadow-xs transition-colors">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
