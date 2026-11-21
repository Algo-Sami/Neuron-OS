"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Sparkles, HelpCircle, Calendar, ChevronRight, Check } from "lucide-react";

const STEPS = [
  {
    id: "upload",
    icon: Upload,
    title: "Upload Any Lecture",
    subtitle: "PDF, DOCX, PPTX — anything",
    preview: {
      type: "upload",
    },
  },
  {
    id: "summary",
    icon: Sparkles,
    title: "AI Generates Summary",
    subtitle: "Structured, concise, instant",
    preview: {
      type: "summary",
    },
  },
  {
    id: "quiz",
    icon: HelpCircle,
    title: "AI Creates Quizzes",
    subtitle: "MCQs, short answers, and more",
    preview: {
      type: "quiz",
    },
  },
  {
    id: "deadlines",
    icon: Calendar,
    title: "Extracts Deadlines",
    subtitle: "Sets smart reminder schedules",
    preview: {
      type: "deadlines",
    },
  },
];

function UploadPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#0b0f19]/80 border border-white/[0.08] hover:border-cyan-500/30 transition-colors">
        <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-rose-400">PDF</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs sm:text-sm font-semibold text-white">OS_Lecture_07.pdf</div>
          <div className="text-xs text-slate-400">2.4 MB · Operating Systems</div>
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] animate-pulse" />
      </div>

      <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#0b0f19]/80 border border-white/[0.08] hover:border-cyan-500/30 transition-colors">
        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-cyan-400">DOC</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs sm:text-sm font-semibold text-white">Database_Notes.docx</div>
          <div className="text-xs text-slate-400">1.1 MB · Database Systems</div>
        </div>
        <Check className="h-4 w-4 text-emerald-400" />
      </div>

      <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/25 text-xs sm:text-sm text-cyan-200 font-medium flex items-center gap-2.5">
        <span className="text-cyan-400 font-bold">✓</span>
        <span>AI is processing your upload...</span>
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        AI Generated Summary
      </div>
      <div className="space-y-2.5">
        {[
          "Process Scheduling: CPU scheduling algorithms include FCFS, SJF, Round Robin, and Priority Scheduling.",
          "Memory Management: Virtual memory uses paging and segmentation to provide process isolation.",
          "Deadlock Prevention: Four conditions must hold simultaneously for deadlock to occur.",
        ].map((text, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl bg-[#0b0f19]/80 border border-white/[0.08] hover:border-cyan-500/30 transition-colors">
            <span className="text-cyan-400 font-bold text-xs mt-0.5">→</span>
            <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        <span>Generated in 1.8 seconds</span>
      </div>
    </div>
  );
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
        Quiz Question 1/5
      </div>
      <p className="text-xs sm:text-sm text-white font-bold">
        Which scheduling algorithm can lead to starvation?
      </p>
      <div className="space-y-2">
        {["Round Robin", "Priority Scheduling", "FCFS", "Multilevel Queue"].map((opt, i) => (
          <button
            key={opt}
            onClick={() => setSelected(i)}
            type="button"
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] border transition-all duration-200 ${
              selected === i
                ? i === 1
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold"
                  : "bg-rose-500/15 border-rose-500/40 text-rose-300 font-semibold"
                : "bg-[#0b0f19]/80 border-white/[0.08] text-slate-300 hover:bg-white/[0.04] hover:border-cyan-500/30"
            }`}
          >
            <span className="font-bold mr-2 text-cyan-400">{["A", "B", "C", "D"][i]}.</span>
            {opt}
            {selected !== null && i === 1 && <Check className="inline h-3.5 w-3.5 ml-2 text-emerald-400" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeadlinesPreview() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
        Extracted Deadlines
      </div>
      {[
        { task: "OS Assignment 2", date: "May 28", days: 4, col: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
        { task: "DB Lab Report", date: "June 2", days: 9, col: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
        { task: "Mid-Term Exam", date: "June 10", days: 17, col: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
      ].map(({ task, date, days, col }) => (
        <div key={task} className="flex items-center gap-3 p-3 rounded-xl bg-[#0b0f19]/80 border border-white/[0.08]">
          <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
          <div className="flex-1">
            <div className="text-xs sm:text-sm font-semibold text-white">{task}</div>
            <div className="text-xs text-slate-400">{date} · {days} days left</div>
          </div>
          <div className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${col}`}>
            {days}d
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
        <span>Reminders automatically scheduled</span>
      </div>
    </div>
  );
}

const PREVIEW_COMPONENTS = {
  upload: UploadPreview,
  summary: SummaryPreview,
  quiz: QuizPreview,
  deadlines: DeadlinesPreview,
};

export function AIShowcaseSection() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.style.opacity = "0";
      previewRef.current.style.transform = "scale(0.99)";
      const t = setTimeout(() => {
        if (previewRef.current) {
          previewRef.current.style.opacity = "1";
          previewRef.current.style.transform = "scale(1)";
        }
      }, 70);
      return () => clearTimeout(t);
    }
  }, [activeStep]);

  const step = STEPS[activeStep];
  const PreviewComp = PREVIEW_COMPONENTS[step.preview.type as keyof typeof PREVIEW_COMPONENTS];

  return (
    <section
      id="ai-showcase"
      className="relative py-20 lg:py-28 bg-[#07090e] border-b border-white/[0.08]"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div
        ref={sectionRef}
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        {/* Header */}
        <div className="text-center mb-14 sm:mb-16 space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 shadow-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">AI In Action</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            See the <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">Intelligence</span> Work
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Watch how Neuron OS transforms raw lecture files into an organized, interactive study system.
          </p>
        </div>

        {/* Main showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Step selector */}
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === activeStep;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(i)}
                  type="button"
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? "bg-[#0d1424] border-cyan-500/50 shadow-[0_0_24px_rgba(56,189,248,0.12)]"
                      : "bg-[#0b0f19]/70 border-white/[0.08] hover:bg-[#0d1424]/60 hover:border-white/[0.16]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                        isActive
                          ? "bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(56,189,248,0.35)]"
                          : "bg-white/[0.04] text-slate-400 border border-white/[0.06]"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm sm:text-base font-bold ${isActive ? "text-white" : "text-slate-200"}`}>
                        {s.title}
                      </div>
                      <div className={`text-xs sm:text-[13px] ${isActive ? "text-cyan-400 font-medium" : "text-slate-400"}`}>
                        {s.subtitle}
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 transition-transform duration-200 ${
                        isActive ? "text-cyan-400 translate-x-1" : "text-slate-500"
                      }`}
                    />
                  </div>

                  {/* Progress bar for active */}
                  {isActive && (
                    <div className="mt-3.5 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                        style={{ animation: "showcaseProgress 4.5s linear forwards" }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview panel */}
          <div className="lg:sticky lg:top-24">
            <div className="rounded-2xl sm:rounded-3xl border border-white/[0.12] bg-[#0d1424]/90 backdrop-blur-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {/* Window bar */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-[#080d1a] border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs font-medium text-slate-300 ml-2">Neuron OS — Live Preview</span>
                </div>
                <span className="text-[11px] text-cyan-400 font-mono">v1.0.4</span>
              </div>
              <div
                ref={previewRef}
                className="p-5 sm:p-6 min-h-[300px]"
                style={{ transition: "opacity 0.2s ease, transform 0.2s ease" }}
              >
                <PreviewComp />
              </div>
            </div>

            {/* Step indicator dots */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  type="button"
                  aria-label={`Step ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeStep
                      ? "w-6 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                      : "w-2 h-2 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes showcaseProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
