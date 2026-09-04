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
      <div className="flex items-center gap-3 p-3 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db]">
        <div className="h-9 w-9 rounded-[3px] bg-[#fde7e9] border border-[#f8a5ab] flex items-center justify-center">
          <span className="text-[10px] font-bold text-[#a4262c]">PDF</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs font-semibold text-[#201f1e]">OS_Lecture_07.pdf</div>
          <div className="text-[11px] text-[#605e5c]">2.4 MB · Operating Systems</div>
        </div>
        <div className="h-2 w-2 rounded-full bg-[#107c41]" />
      </div>

      <div className="flex items-center gap-3 p-3 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db]">
        <div className="h-9 w-9 rounded-[3px] bg-[#e5f1fb] border border-[#99c8f5] flex items-center justify-center">
          <span className="text-[10px] font-bold text-[#0078d4]">DOC</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs font-semibold text-[#201f1e]">Database_Notes.docx</div>
          <div className="text-[11px] text-[#605e5c]">1.1 MB · Database Systems</div>
        </div>
        <Check className="h-4 w-4 text-[#107c41]" />
      </div>

      <div className="p-3 rounded-[3px] bg-[#f0f6ff] border border-[#c7e0f4] text-xs text-[#004578] font-medium flex items-center gap-2">
        <span className="text-[#107c41] font-bold">✓</span>
        <span>AI is processing your upload...</span>
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#0078d4] mb-1">
        AI Generated Summary
      </div>
      <div className="space-y-2">
        {[
          "Process Scheduling: CPU scheduling algorithms include FCFS, SJF, Round Robin, and Priority Scheduling.",
          "Memory Management: Virtual memory uses paging and segmentation to provide process isolation.",
          "Deadlock Prevention: Four conditions must hold simultaneously for deadlock to occur.",
        ].map((text, i) => (
          <div key={i} className="flex gap-2.5 p-2.5 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db]">
            <span className="text-[#0078d4] font-bold text-xs mt-0.5">→</span>
            <p className="text-xs text-[#323130] leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-[#605e5c] pt-1">
        <Sparkles className="h-3 w-3 text-[#0078d4]" />
        <span>Generated in 1.8 seconds</span>
      </div>
    </div>
  );
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#0078d4]">
        Quiz Question 1/5
      </div>
      <p className="text-xs sm:text-sm text-[#201f1e] font-semibold">
        Which scheduling algorithm can lead to starvation?
      </p>
      <div className="space-y-2">
        {["Round Robin", "Priority Scheduling", "FCFS", "Multilevel Queue"].map((opt, i) => (
          <button
            key={opt}
            onClick={() => setSelected(i)}
            type="button"
            className={`w-full text-left px-3 py-2 rounded-[3px] text-xs border transition-colors ${
              selected === i
                ? i === 1
                  ? "bg-[#dff6dd] border-[#107c41] text-[#107c41] font-semibold"
                  : "bg-[#fde7e9] border-[#a4262c] text-[#a4262c] font-semibold"
                : "bg-[#f8fafc] border-[#d0d4db] text-[#323130] hover:bg-[#f3f2f1]"
            }`}
          >
            <span className="font-bold mr-2">{["A", "B", "C", "D"][i]}.</span>
            {opt}
            {selected !== null && i === 1 && <Check className="inline h-3 w-3 ml-2 text-[#107c41]" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeadlinesPreview() {
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#0078d4]">
        Extracted Deadlines
      </div>
      {[
        { task: "OS Assignment 2", date: "May 28", days: 4, col: "text-[#a4262c] bg-[#fde7e9] border-[#f8a5ab]" },
        { task: "DB Lab Report", date: "June 2", days: 9, col: "text-[#ca5010] bg-[#fff4ce] border-[#fce196]" },
        { task: "Mid-Term Exam", date: "June 10", days: 17, col: "text-[#107c41] bg-[#dff6dd] border-[#b0e6b5]" },
      ].map(({ task, date, days, col }) => (
        <div key={task} className="flex items-center gap-3 p-2.5 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db]">
          <div className="h-2 w-2 rounded-full bg-[#0078d4]" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-[#201f1e]">{task}</div>
            <div className="text-[11px] text-[#605e5c]">{date} · {days} days left</div>
          </div>
          <div className={`text-[10.5px] font-bold px-2 py-0.5 rounded-[2px] border ${col}`}>
            {days}d
          </div>
        </div>
      ))}
      <div className="text-xs text-[#605e5c] flex items-center gap-1.5 pt-1">
        <Calendar className="h-3 w-3 text-[#0078d4]" />
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
      className="relative py-20 lg:py-28 bg-white border-b border-[#e1dfdd]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        {/* Header */}
        <div className="text-center mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db] shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-[#0078d4]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">AI In Action</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#201f1e] tracking-tight">
            See the <span className="text-[#0078d4]">Intelligence</span> Work
          </h2>
          <p className="text-sm sm:text-base text-[#475569] max-w-2xl mx-auto">
            Watch how Neuron OS transforms raw lecture files into an organized, interactive study system.
          </p>
        </div>

        {/* Main showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Step selector */}
          <div className="space-y-2.5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === activeStep;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(i)}
                  type="button"
                  className={`w-full text-left p-4 rounded-[4px] border transition-all duration-150 ${
                    isActive
                      ? "bg-[#e5f1fb] border-[#0078d4] shadow-xs"
                      : "bg-[#f8fafc] border-[#d0d4db] hover:bg-[#f3f2f1] hover:border-[#b3d6fc]"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`h-9 w-9 rounded-[3px] flex items-center justify-center transition-colors ${
                        isActive ? "bg-[#0078d4] text-white" : "bg-white border border-[#d0d4db] text-[#605e5c]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${isActive ? "text-[#004578]" : "text-[#201f1e]"}`}>
                        {s.title}
                      </div>
                      <div className={`text-xs ${isActive ? "text-[#0078d4]" : "text-[#605e5c]"}`}>
                        {s.subtitle}
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${isActive ? "text-[#0078d4] translate-x-0.5" : "text-[#a19f9d]"}`}
                    />
                  </div>

                  {/* Progress bar for active */}
                  {isActive && (
                    <div className="mt-2.5 h-1 rounded-full bg-[#c7e0f4] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0078d4]"
                        style={{ animation: "showcaseProgress 4.5s linear forwards" }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview panel */}
          <div className="lg:sticky lg:top-20">
            <div className="rounded-[6px] border border-[#d0d4db] bg-white overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
              {/* Window bar */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#f3f4f6] border-b border-[#e1dfdd]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#e81123]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffb900]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#107c41]/70" />
                  </div>
                  <span className="text-[11px] font-medium text-[#605e5c] ml-2">Neuron OS — Live Preview</span>
                </div>
                <span className="text-[10px] text-[#8a8886] font-mono">v1.0.4</span>
              </div>
              <div
                ref={previewRef}
                className="p-5 min-h-[280px]"
                style={{ transition: "opacity 0.2s ease, transform 0.2s ease" }}
              >
                <PreviewComp />
              </div>
            </div>

            {/* Step indicator dots */}
            <div className="flex items-center justify-center gap-1.5 mt-3.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  type="button"
                  aria-label={`Step ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === activeStep ? "w-5 h-1.5 bg-[#0078d4]" : "w-1.5 h-1.5 bg-[#d0d4db] hover:bg-[#a19f9d]"
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
