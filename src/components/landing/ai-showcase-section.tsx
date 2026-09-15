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
      <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
        <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-rose-600">PDF</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs sm:text-sm font-semibold text-slate-900">OS_Lecture_07.pdf</div>
          <div className="text-xs text-slate-500">2.4 MB · Operating Systems</div>
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-blue-600">DOC</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs sm:text-sm font-semibold text-slate-900">Database_Notes.docx</div>
          <div className="text-xs text-slate-500">1.1 MB · Database Systems</div>
        </div>
        <Check className="h-4 w-4 text-emerald-600" />
      </div>

      <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs sm:text-sm text-blue-900 font-medium flex items-center gap-2.5">
        <span className="text-emerald-600 font-bold">✓</span>
        <span>AI is processing your upload...</span>
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
        AI Generated Summary
      </div>
      <div className="space-y-2.5">
        {[
          "Process Scheduling: CPU scheduling algorithms include FCFS, SJF, Round Robin, and Priority Scheduling.",
          "Memory Management: Virtual memory uses paging and segmentation to provide process isolation.",
          "Deadlock Prevention: Four conditions must hold simultaneously for deadlock to occur.",
        ].map((text, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-blue-600 font-bold text-xs mt-0.5">→</span>
            <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
        <span>Generated in 1.8 seconds</span>
      </div>
    </div>
  );
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
        Quiz Question 1/5
      </div>
      <p className="text-xs sm:text-sm text-slate-900 font-bold">
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
                  ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold"
                  : "bg-rose-50 border-rose-400 text-rose-800 font-semibold"
                : "bg-slate-50/80 border-slate-200/80 text-slate-700 hover:bg-slate-100/80"
            }`}
          >
            <span className="font-bold mr-2">{["A", "B", "C", "D"][i]}.</span>
            {opt}
            {selected !== null && i === 1 && <Check className="inline h-3.5 w-3.5 ml-2 text-emerald-600" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeadlinesPreview() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
        Extracted Deadlines
      </div>
      {[
        { task: "OS Assignment 2", date: "May 28", days: 4, col: "text-rose-700 bg-rose-50 border-rose-200" },
        { task: "DB Lab Report", date: "June 2", days: 9, col: "text-amber-700 bg-amber-50 border-amber-200" },
        { task: "Mid-Term Exam", date: "June 10", days: 17, col: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      ].map(({ task, date, days, col }) => (
        <div key={task} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <div className="h-2 w-2 rounded-full bg-blue-600" />
          <div className="flex-1">
            <div className="text-xs sm:text-sm font-semibold text-slate-900">{task}</div>
            <div className="text-xs text-slate-500">{date} · {days} days left</div>
          </div>
          <div className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${col}`}>
            {days}d
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
        <Calendar className="h-3.5 w-3.5 text-blue-600" />
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
      className="relative py-20 lg:py-28 bg-white border-b border-slate-200/70"
    >
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        {/* Header */}
        <div className="text-center mb-14 sm:mb-16 space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50/80 border border-blue-200/60 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">AI In Action</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            See the <span className="text-blue-600">Intelligence</span> Work
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
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
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                    isActive
                      ? "bg-blue-50/70 border-blue-400 shadow-md shadow-blue-500/5"
                      : "bg-white border-slate-200/80 hover:bg-slate-50/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                        isActive ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm sm:text-base font-bold ${isActive ? "text-blue-950" : "text-slate-900"}`}>
                        {s.title}
                      </div>
                      <div className={`text-xs sm:text-[13px] ${isActive ? "text-blue-600 font-medium" : "text-slate-500"}`}>
                        {s.subtitle}
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 transition-transform duration-200 ${isActive ? "text-blue-600 translate-x-1" : "text-slate-400"}`}
                    />
                  </div>

                  {/* Progress bar for active */}
                  {isActive && (
                    <div className="mt-3.5 h-1.5 rounded-full bg-blue-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600"
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
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_15px_35px_-10px_rgba(15,23,42,0.08)]">
              {/* Window bar */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-50/90 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 ml-2">Neuron OS — Live Preview</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">v1.0.4</span>
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
                    i === activeStep ? "w-6 h-2 bg-blue-600" : "w-2 h-2 bg-slate-200 hover:bg-slate-300"
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
