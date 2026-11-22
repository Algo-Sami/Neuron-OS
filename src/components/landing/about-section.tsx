"use client";

import { useRef } from "react";
import { Brain, Target, Zap, Clock } from "lucide-react";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

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
    icon: "😫",
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
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Accessibility guard: immediately render final static layout
      if (getPrefersReducedMotion()) {
        gsap.set(
          [
            "[data-about-badge]",
            "[data-about-title]",
            "[data-about-desc]",
            "[data-problem-row]",
            "[data-value-card]",
          ],
          { opacity: 1, x: 0, y: 0, scale: 1, clearProps: "all" }
        );
        return;
      }

      // Master section timeline triggered when About section crosses 75% viewport
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          once: true,
        },
        defaults: { ease: motion.ease.standard },
        onComplete: () => {
          // Clean up GPU will-change hints after animation settles to conserve memory
          gsap.set("[data-problem-row], [data-value-card]", {
            clearProps: "willChange",
          });
        },
      });

      // 1. Left: Badge, Title & Context Narrative
      tl.fromTo(
        "[data-about-badge]",
        { opacity: 0, y: 12, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: motion.ease.spring },
        0
      )
      .fromTo(
        "[data-about-title]",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: motion.duration.normal, ease: motion.ease.smooth },
        0.1
      )
      .fromTo(
        "[data-about-desc]",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.55, ease: motion.ease.smooth },
        0.22
      )

      // 2. Left: Problem → Solution rows (subtle slide from left)
      .fromTo(
        "[data-problem-row]",
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: motion.ease.standard,
        },
        0.3
      )

      // 3. Right: Value proposition cards (cascade elevation)
      .fromTo(
        "[data-value-card]",
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.09,
          ease: motion.ease.standard,
        },
        0.35
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative py-20 lg:py-28 bg-white border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Problem → Solution */}
          <div className="space-y-6 sm:space-y-8">
            <div className="space-y-3.5">
              <div
                data-about-badge
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200/70 shadow-xs"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  The Problem
                </span>
              </div>
              <h2
                data-about-title
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight"
              >
                Students Waste{" "}
                <span className="text-rose-600">Thousands of Hours</span>{" "}
                on Broken Workflows
              </h2>
              <p
                data-about-desc
                className="text-sm sm:text-base text-slate-600 leading-relaxed"
              >
                The average university student juggles 5+ apps just to manage their studies. Notes in one place, deadlines in another, lectures buried in email. Neuron OS solves this.
              </p>
            </div>

            {/* Problem → Solution list */}
            <div className="space-y-3">
              {PROBLEMS.map(({ icon, problem, solution }) => (
                <div
                  key={problem}
                  data-problem-row
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 will-change-transform"
                >
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <div className="text-xs sm:text-sm text-slate-400 line-through decoration-rose-400/70 font-medium">
                      {problem}
                    </div>
                    <div className="text-xs sm:text-sm text-emerald-600 font-bold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
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
                data-value-card
                className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-1.5 transition-all duration-300 group shadow-xs will-change-transform"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 border border-cyan-100 mb-4 group-hover:bg-slate-900 group-hover:text-white group-hover:scale-105 transition-all duration-300 shadow-xs">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-cyan-600 transition-colors">
                  {title}
                </h3>
                <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed">
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
