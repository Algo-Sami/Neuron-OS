"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Sparkles, HelpCircle, Calendar, ChevronRight, Check } from "lucide-react";

const STEPS = [
  {
    id: "upload",
    icon: Upload,
    title: "Upload Any Lecture",
    subtitle: "PDF, DOCX, PPTX — anything",
    color: "violet",
    accentColor: "from-violet-600 to-violet-400",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/10",
    textColor: "text-violet-400",
    preview: {
      type: "upload",
    },
  },
  {
    id: "summary",
    icon: Sparkles,
    title: "AI Generates Summary",
    subtitle: "Structured, concise, instant",
    color: "indigo",
    accentColor: "from-indigo-600 to-indigo-400",
    borderColor: "border-indigo-500/30",
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-400",
    preview: {
      type: "summary",
    },
  },
  {
    id: "quiz",
    icon: HelpCircle,
    title: "AI Creates Quizzes",
    subtitle: "MCQs, short answers, and more",
    color: "cyan",
    accentColor: "from-cyan-600 to-cyan-400",
    borderColor: "border-cyan-500/30",
    bgColor: "bg-cyan-500/10",
    textColor: "text-cyan-400",
    preview: {
      type: "quiz",
    },
  },
  {
    id: "deadlines",
    icon: Calendar,
    title: "Extracts Deadlines",
    subtitle: "Sets smart reminder schedules",
    color: "amber",
    accentColor: "from-amber-600 to-amber-400",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
    preview: {
      type: "deadlines",
    },
  },
];

function UploadPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
          <span className="text-xs font-black text-red-400">PDF</span>
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-sm font-semibold text-white">OS_Lecture_07.pdf</div>
          <div className="text-xs text-neutral-500">2.4 MB · Operating Systems</div>
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <span className="text-xs font-black text-blue-400">DOC</span>
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-sm font-semibold text-white">Database_Notes.docx</div>
          <div className="text-xs text-neutral-500">1.1 MB · Database Systems</div>
        </div>
        <Check className="h-4 w-4 text-emerald-400" />
      </div>
      <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
        ✓ AI is processing your upload...
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">AI Summary</div>
      <div className="space-y-2">
        {[
          "Process Scheduling: CPU scheduling algorithms include FCFS, SJF, Round Robin, and Priority Scheduling.",
          "Memory Management: Virtual memory uses paging and segmentation to provide process isolation.",
          "Deadlock Prevention: Four conditions must hold simultaneously for deadlock to occur.",
        ].map((text, i) => (
          <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <span className="text-indigo-400 font-bold text-xs mt-0.5">→</span>
            <p className="text-xs text-neutral-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Sparkles className="h-3 w-3 text-indigo-400" />
        Generated in 1.8 seconds
      </div>
    </div>
  );
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Quiz Question 1/5</div>
      <p className="text-sm text-white font-medium">Which scheduling algorithm can lead to starvation?</p>
      <div className="space-y-2">
        {["Round Robin", "Priority Scheduling", "FCFS", "Multilevel Queue"].map((opt, i) => (
          <button
            key={opt}
            onClick={() => setSelected(i)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all duration-200 ${
              selected === i
                ? i === 1
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "bg-red-500/20 border-red-500/50 text-red-300"
                : "bg-white/[0.03] border-white/[0.06] text-neutral-300 hover:bg-white/[0.06]"
            }`}
          >
            <span className="font-bold mr-2">{["A", "B", "C", "D"][i]}.</span>
            {opt}
            {selected !== null && i === 1 && <Check className="inline h-3 w-3 ml-2 text-emerald-400" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeadlinesPreview() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Extracted Deadlines</div>
      {[
        { task: "OS Assignment 2", date: "May 28", days: 4, col: "red" },
        { task: "DB Lab Report", date: "June 2", days: 9, col: "amber" },
        { task: "Mid-Term Exam", date: "June 10", days: 17, col: "emerald" },
      ].map(({ task, date, days, col }) => (
        <div key={task} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          <div className={`h-2 w-2 rounded-full bg-${col}-400 animate-pulse`} />
          <div className="flex-1">
            <div className="text-xs font-semibold text-white">{task}</div>
            <div className="text-[11px] text-neutral-500">{date} · {days} days left</div>
          </div>
          <div className={`text-[10px] font-bold text-${col}-400 px-2 py-1 rounded-md bg-${col}-500/10`}>
            {days}d
          </div>
        </div>
      ))}
      <div className="text-xs text-neutral-500 flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-amber-400" />
        Reminders automatically scheduled
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
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(32px)";
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
      previewRef.current.style.transform = "scale(0.97)";
      const t = setTimeout(() => {
        if (previewRef.current) {
          previewRef.current.style.opacity = "1";
          previewRef.current.style.transform = "scale(1)";
        }
      }, 80);
      return () => clearTimeout(t);
    }
  }, [activeStep]);

  const step = STEPS[activeStep];
  const PreviewComp = PREVIEW_COMPONENTS[step.preview.type as keyof typeof PREVIEW_COMPONENTS];

  return (
    <section
      id="ai-showcase"
      className="relative py-24 lg:py-32 bg-[#06060e]"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)" }} />

      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.8s ease, transform 0.8s ease" }}
      >
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/20 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">AI In Action</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
            See the{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Intelligence
            </span>{" "}
            Work
          </h2>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
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
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-400 ${
                    isActive
                      ? `bg-gradient-to-br ${s.accentColor.replace("from-", "from-").replace(" to-", " to-")}/10 ${s.borderColor} shadow-lg`
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive ? s.bgColor : "bg-white/[0.04]"}`}>
                      <Icon className={`h-5 w-5 transition-colors duration-300 ${isActive ? s.textColor : "text-neutral-500"}`} />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-bold transition-colors duration-300 ${isActive ? "text-white" : "text-neutral-400"}`}>
                        {s.title}
                      </div>
                      <div className={`text-xs transition-colors duration-300 ${isActive ? "text-neutral-400" : "text-neutral-600"}`}>
                        {s.subtitle}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-all duration-300 ${isActive ? `${s.textColor} translate-x-0.5` : "text-neutral-700"}`} />
                  </div>

                  {/* Progress bar for active */}
                  {isActive && (
                    <div className="mt-3 h-0.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${s.accentColor}`}
                        style={{ animation: "progressBar 4s linear forwards" }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview panel */}
          <div className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d1a] overflow-hidden shadow-2xl shadow-black/50">
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0a12] border-b border-white/[0.05]">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex-1 text-center text-[11px] text-neutral-600">Neuron OS — AI Engine</div>
              </div>
              <div
                ref={previewRef}
                className="p-6 min-h-[300px]"
                style={{ transition: "opacity 0.3s ease, transform 0.3s ease" }}
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
                  className={`rounded-full transition-all duration-300 ${
                    i === activeStep ? "w-6 h-2 bg-violet-500" : "w-2 h-2 bg-white/20 hover:bg-white/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
