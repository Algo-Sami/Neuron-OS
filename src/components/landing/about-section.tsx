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
      className="relative py-20 lg:py-28 bg-[#f8fafc] border-b border-[#e1dfdd]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Problem → Solution */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-white border border-[#d0d4db] shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">
                  The Problem
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#201f1e] tracking-tight leading-tight">
                Students Waste{" "}
                <span className="text-[#a4262c]">Thousands of Hours</span>{" "}
                on Broken Workflows
              </h2>
              <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
                The average university student juggles 5+ apps just to manage their studies. Notes in one place, deadlines in another, lectures buried in email. Neuron OS solves this.
              </p>
            </div>

            {/* Problem → Solution list */}
            <div className="space-y-2.5">
              {PROBLEMS.map(({ icon, problem, solution }) => (
                <div
                  key={problem}
                  className="flex items-center gap-3.5 p-3.5 rounded-[4px] bg-white border border-[#d0d4db] shadow-xs"
                >
                  <span className="text-xl">{icon}</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 items-center">
                    <div className="text-xs text-[#605e5c] line-through decoration-[#a4262c]/60">
                      {problem}
                    </div>
                    <div className="text-xs text-[#107c41] font-semibold flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#107c41]" />
                      {solution}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Value props */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-5 rounded-[4px] bg-white border border-[#d0d4db] hover:border-[#0078d4] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-150 group"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] bg-[#f0f6ff] border border-[#c7e0f4] text-[#0078d4] mb-3 group-hover:bg-[#0078d4] group-hover:text-white transition-colors">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-[#201f1e] mb-1.5 group-hover:text-[#0078d4] transition-colors">
                  {title}
                </h3>
                <p className="text-xs text-[#475569] leading-relaxed">
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
