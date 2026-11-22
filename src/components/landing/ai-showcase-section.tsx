"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, Sparkles, HelpCircle, Calendar, ChevronRight, Check } from "lucide-react";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

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
      <div
        data-preview-item
        className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs"
      >
        <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-rose-600">PDF</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs sm:text-sm font-semibold text-slate-900">OS_Lecture_07.pdf</div>
          <div className="text-xs text-slate-500">2.4 MB · Operating Systems</div>
        </div>
        <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse" />
      </div>

      <div
        data-preview-item
        className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs"
      >
        <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-sky-600">DOC</span>
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="text-xs sm:text-sm font-semibold text-slate-900">Database_Notes.docx</div>
          <div className="text-xs text-slate-500">1.1 MB · Database Systems</div>
        </div>
        <Check className="h-4 w-4 text-emerald-600" />
      </div>

      <div
        data-preview-item
        className="p-3.5 rounded-xl bg-cyan-50/80 border border-cyan-200/80 text-xs sm:text-sm text-cyan-900 font-medium flex items-center gap-2.5 shadow-xs"
      >
        <span className="text-cyan-600 font-bold">✓</span>
        <span>AI is processing your upload...</span>
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className="space-y-3">
      <div
        data-preview-item
        className="text-xs font-bold uppercase tracking-wider text-cyan-600 mb-1 flex items-center gap-1.5"
      >
        <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
        AI Generated Summary
      </div>
      <div className="space-y-2.5">
        {[
          "Process Scheduling: CPU scheduling algorithms include FCFS, SJF, Round Robin, and Priority Scheduling.",
          "Memory Management: Virtual memory uses paging and segmentation to provide process isolation.",
          "Deadlock Prevention: Four conditions must hold simultaneously for deadlock to occur.",
        ].map((text, i) => (
          <div
            key={i}
            data-preview-item
            className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 shadow-xs"
          >
            <span className="text-cyan-600 font-bold text-xs mt-0.5">→</span>
            <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div
        data-preview-item
        className="flex items-center gap-1.5 text-xs text-slate-500 pt-1"
      >
        <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
        <span>Generated in 1.8 seconds</span>
      </div>
    </div>
  );
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div
        data-preview-item
        className="text-xs font-bold uppercase tracking-wider text-cyan-600 flex items-center gap-1.5"
      >
        <HelpCircle className="h-3.5 w-3.5 text-cyan-600" />
        Quiz Question 1/5
      </div>
      <p
        data-preview-item
        className="text-xs sm:text-sm text-slate-900 font-bold"
      >
        Which scheduling algorithm can lead to starvation?
      </p>
      <div className="space-y-2">
        {["Round Robin", "Priority Scheduling", "FCFS", "Multilevel Queue"].map((opt, i) => (
          <button
            key={opt}
            data-preview-item
            onClick={() => setSelected(i)}
            type="button"
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] border transition-all duration-200 shadow-xs ${
              selected === i
                ? i === 1
                  ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold"
                  : "bg-rose-50 border-rose-400 text-rose-800 font-semibold"
                : "bg-slate-50/80 border-slate-200/80 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="font-bold mr-2 text-slate-900">{["A", "B", "C", "D"][i]}.</span>
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
      <div
        data-preview-item
        className="text-xs font-bold uppercase tracking-wider text-cyan-600 flex items-center gap-1.5"
      >
        <Calendar className="h-3.5 w-3.5 text-cyan-600" />
        Extracted Deadlines
      </div>
      {[
        { task: "OS Assignment 2", date: "May 28", days: 4, col: "text-rose-700 bg-rose-50 border-rose-200" },
        { task: "DB Lab Report", date: "June 2", days: 9, col: "text-amber-700 bg-amber-50 border-amber-200" },
        { task: "Mid-Term Exam", date: "June 10", days: 17, col: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      ].map(({ task, date, days, col }) => (
        <div
          key={task}
          data-preview-item
          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs"
        >
          <div className="h-2 w-2 rounded-full bg-cyan-600" />
          <div className="flex-1">
            <div className="text-xs sm:text-sm font-semibold text-slate-900">{task}</div>
            <div className="text-xs text-slate-500">{date} · {days} days left</div>
          </div>
          <div className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${col}`}>
            {days}d
          </div>
        </div>
      ))}
      <div
        data-preview-item
        className="text-xs text-slate-500 flex items-center gap-1.5 pt-1"
      >
        <Calendar className="h-3.5 w-3.5 text-cyan-600" />
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
  const [isPaused, setIsPaused] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  const sectionRef = useRef<HTMLDivElement>(null);
  const previewWindowRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);

  // Manual step switch handler with timer reset
  const handleSelectStep = useCallback((index: number) => {
    setActiveStep(index);
    setTimerKey((k) => k + 1);
  }, []);

  // Automated advancement every 4.5 seconds (pausable on user hover/interaction)
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
      setTimerKey((k) => k + 1);
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaused, timerKey]);

  // Master entrance timeline
  useGSAP(
    () => {
      if (getPrefersReducedMotion()) {
        gsap.set(
          [
            "[data-showcase-badge]",
            "[data-showcase-title]",
            "[data-showcase-desc]",
            "[data-step-card]",
            "[data-preview-window]",
            "[data-step-indicators]",
            "[data-ambient-glow]",
          ],
          { opacity: 1, x: 0, y: 0, scale: 1, clearProps: "all" }
        );
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          once: true,
        },
        defaults: { ease: motion.ease.standard },
        onComplete: () => {
          gsap.set("[data-step-card], [data-preview-window]", {
            clearProps: "willChange",
          });
        },
      });

      // 1. Header reveal sequence
      tl.fromTo(
        "[data-showcase-badge]",
        { opacity: 0, y: 12, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: motion.ease.spring },
        0
      )
        .fromTo(
          "[data-showcase-title]",
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: motion.duration.normal, ease: motion.ease.smooth },
          0.1
        )
        .fromTo(
          "[data-showcase-desc]",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.55, ease: motion.ease.smooth },
          0.2
        )

        // 2. Left step cards staggered slide-in
        .fromTo(
          "[data-step-card]",
          { opacity: 0, x: -20 },
          {
            opacity: 1,
            x: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: motion.ease.standard,
          },
          0.25
        )

        // 3. Right preview window elevation & ambient glow reveal
        .fromTo(
          "[data-preview-window]",
          { opacity: 0, y: 26, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            ease: motion.ease.standard,
          },
          0.3
        )
        .fromTo(
          "[data-ambient-glow]",
          { opacity: 0, scale: 0.9 },
          { opacity: 0.7, scale: 1, duration: 1.2, ease: "sine.out" },
          0.3
        )
        .fromTo(
          "[data-step-indicators]",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.4 },
          0.5
        );

      // Continuous gentle ambient breathing glow behind the preview window
      gsap.to("[data-ambient-glow]", {
        scale: 1.08,
        opacity: 0.85,
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    },
    { scope: sectionRef }
  );

  // Dynamic AI generation micro-stagger on step transition
  useGSAP(
    () => {
      if (getPrefersReducedMotion()) return;
      if (!previewContentRef.current) return;

      const items = previewContentRef.current.querySelectorAll("[data-preview-item]");

      gsap.fromTo(
        previewContentRef.current,
        { opacity: 0, y: 8, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "power2.out" }
      );

      if (items.length > 0) {
        gsap.fromTo(
          items,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.28, stagger: 0.05, ease: "power2.out", delay: 0.04 }
        );
      }
    },
    { dependencies: [activeStep], scope: previewContentRef }
  );

  // Subtle interactive 3D perspective depth on pointer hover (desktop only)
  useEffect(() => {
    if (getPrefersReducedMotion()) return;
    const el = previewWindowRef.current;
    if (!el || typeof window === "undefined") return;

    // Only apply on fine-pointer devices (mouse/trackpad, not touch)
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const setRotateX = gsap.quickTo(el, "rotateX", { duration: 0.4, ease: "power2.out" });
    const setRotateY = gsap.quickTo(el, "rotateY", { duration: 0.4, ease: "power2.out" });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      // Controlled, subtle tilt (max ±2.5 degrees)
      setRotateX(-y * 5);
      setRotateY(x * 5);
    };

    const handleMouseLeave = () => {
      setRotateX(0);
      setRotateY(0);
    };

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
      gsap.set(el, { rotateX: 0, rotateY: 0 });
    };
  }, []);

  const step = STEPS[activeStep];
  const PreviewComp = PREVIEW_COMPONENTS[step.preview.type as keyof typeof PREVIEW_COMPONENTS];

  return (
    <section
      ref={sectionRef}
      id="ai-showcase"
      className="relative py-20 lg:py-28 bg-[#f8fafc] border-b border-slate-200/70 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="text-center mb-14 sm:mb-16 space-y-3.5">
          <div
            data-showcase-badge
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-800 shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">AI In Action</span>
          </div>
          <h2
            data-showcase-title
            className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            See the <span className="text-cyan-600">Intelligence</span> Work
          </h2>
          <p
            data-showcase-desc
            className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto"
          >
            Watch how Neuron OS transforms raw lecture files into an organized, interactive study system.
          </p>
        </div>

        {/* Main showcase grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Step selector */}
          <div
            className="space-y-3"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === activeStep;
              return (
                <button
                  key={s.id}
                  data-step-card
                  onClick={() => handleSelectStep(i)}
                  type="button"
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 will-change-transform ${
                    isActive
                      ? "bg-white border-cyan-500 shadow-md shadow-cyan-500/10"
                      : "bg-white/70 border-slate-200/80 hover:bg-white hover:border-slate-300 shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                        isActive ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm sm:text-base font-bold ${isActive ? "text-slate-900" : "text-slate-800"}`}>
                        {s.title}
                      </div>
                      <div className={`text-xs sm:text-[13px] ${isActive ? "text-cyan-600 font-semibold" : "text-slate-500"}`}>
                        {s.subtitle}
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 transition-transform duration-200 ${isActive ? "text-cyan-600 translate-x-1" : "text-slate-400"}`}
                    />
                  </div>

                  {/* Progress bar for active step */}
                  {isActive && (
                    <div className="mt-3.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        key={`progress-${activeStep}-${timerKey}`}
                        className="h-full rounded-full bg-cyan-600"
                        style={{
                          animation: "showcaseProgress 4.5s linear forwards",
                          animationPlayState: isPaused ? "paused" : "running",
                        }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview panel */}
          <div
            className="lg:sticky lg:top-28 relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Ambient AI Glow Backdrop */}
            <div
              data-ambient-glow
              className="absolute -top-10 -right-10 -bottom-10 -left-10 bg-gradient-to-tr from-cyan-400/20 via-sky-300/10 to-indigo-400/15 rounded-3xl blur-3xl pointer-events-none -z-10"
            />

            {/* Window Container with subtle 3D perspective */}
            <div
              ref={previewWindowRef}
              data-preview-window
              className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_15px_35px_-10px_rgba(15,23,42,0.08)] will-change-transform"
              style={{ perspective: 1000, transformStyle: "preserve-3d" }}
            >
              {/* Window bar */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-50/90 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 ml-2">Neuron OS — Live Preview</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">v1.0.4</span>
              </div>

              {/* Preview Content Area */}
              <div
                ref={previewContentRef}
                className="p-5 sm:p-6 min-h-[300px]"
              >
                <PreviewComp />
              </div>
            </div>

            {/* Step indicator dots */}
            <div
              data-step-indicators
              className="flex items-center justify-center gap-2 mt-4"
            >
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectStep(i)}
                  type="button"
                  aria-label={`Step ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeStep ? "w-6 h-2 bg-slate-900" : "w-2 h-2 bg-slate-200 hover:bg-slate-300"
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
