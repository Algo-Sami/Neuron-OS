"use client";

import { useEffect, useRef } from "react";
import { Brain, Target, Zap, Clock } from "lucide-react";

const PROBLEMS = [
  {
    icon: "📚",
    problem: "Scattered notes across apps",
    solution: "One unified AI workspace",
  },
  {
    icon: "⏰",
    problem: "Missing assignment deadlines",
    solution: "AI-extracted smart reminders",
  },
  {
    icon: "😩",
    problem: "Hours rereading lecture slides",
    solution: "AI summaries in seconds",
  },
  {
    icon: "❓",
    problem: "No way to test understanding",
    solution: "Auto-generated quizzes",
  },
];

const VALUES = [
  {
    icon: Brain,
    title: "Second Brain for Students",
    desc: "Neuron OS acts as your intelligent academic memory — storing, organizing, and surfacing exactly what you need, when you need it.",
  },
  {
    icon: Target,
    title: "Precision AI — Your Own Notes",
    desc: "Unlike generic AI tools, Neuron's AI only uses your uploaded materials. Get precise answers grounded in your actual course content.",
  },
  {
    icon: Zap,
    title: "Built for Academic Workflows",
    desc: "Every feature is designed specifically for university students — from lecture uploads to exam preparation to deadline tracking.",
  },
  {
    icon: Clock,
    title: "Save 10+ Hours Per Week",
    desc: "AI handles the tedious parts — summarizing, organizing, and scheduling — so you can focus on deep understanding and retention.",
  },
];

export function AboutSection() {
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
      id="about"
      className="relative py-20 lg:py-28 bg-[#07090e] border-b border-white/[0.08]"
    >
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Problem → Solution */}
          <div className="space-y-6 sm:space-y-8">
            <div className="space-y-3.5">
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                  The Problem
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Students Waste{" "}
                <span className="text-rose-400">Thousands of Hours</span>{" "}
                on Broken Workflows
              </h2>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                The average university student juggles 5+ apps just to manage their studies. Notes in one place, deadlines in another, lectures buried in email. Neuron OS solves this.
              </p>
            </div>

            {/* Problem → Solution list */}
            <div className="space-y-3">
              {PROBLEMS.map(({ icon, problem, solution }) => (
                <div
                  key={problem}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-[#0b0f19]/80 border border-white/[0.08] shadow-xs hover:border-cyan-500/30 hover:bg-[#0d1424]/80 transition-all duration-200"
                >
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <div className="text-xs sm:text-sm text-slate-500 line-through decoration-rose-500/60 font-medium">
                      {problem}
                    </div>
                    <div className="text-xs sm:text-sm text-emerald-400 font-bold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] flex-shrink-0" />
                      {solution}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Value props */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-[#0b0f19]/80 border border-white/[0.08] hover:border-cyan-500/40 hover:bg-[#0d1424]/90 hover:shadow-[0_0_30px_rgba(56,189,248,0.1)] hover:-translate-y-1.5 transition-all duration-300 group shadow-xs"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4 group-hover:bg-gradient-to-tr group-hover:from-cyan-500 group-hover:to-blue-600 group-hover:text-white group-hover:border-transparent group-hover:scale-105 transition-all duration-300 shadow-xs">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  {title}
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
