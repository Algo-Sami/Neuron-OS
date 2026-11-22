"use client";

import { useRef } from "react";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

const STATS = [
  { value: 50, suffix: "K+", label: "Lectures Processed", desc: "PDFs, slides, and docs analyzed" },
  { value: 120, suffix: "K+", label: "AI Summaries Generated", desc: "Instant structured study notes" },
  { value: 35, suffix: "K+", label: "Quizzes Created", desc: "Auto-generated from course materials" },
  { value: 10, suffix: " hrs/wk", label: "Average Time Saved", desc: "Per student, each week" },
];

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(
    () => {
      // Accessibility guard: immediately reveal static final values for reduced-motion users
      if (getPrefersReducedMotion()) {
        gsap.set("[data-stat-header]", { opacity: 1, y: 0 });
        gsap.set("[data-stat-card]", { opacity: 1, y: 0, clearProps: "all" });
        STATS.forEach((s, i) => {
          const el = numRefs.current[i];
          if (el) el.textContent = s.value.toLocaleString();
        });
        return;
      }

      // Master section timeline triggered when stats section enters 80% viewport
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          once: true,
        },
        defaults: { ease: motion.ease.standard },
        onComplete: () => {
          // Clean up GPU will-change hints after animation settles
          gsap.set("[data-stat-card]", { clearProps: "willChange" });
        },
      });

      // 1. Header subtle fade-up
      tl.fromTo(
        "[data-stat-header]",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: motion.duration.normal, ease: motion.ease.smooth },
        0
      );

      // 2. Cards staggered entrance (opacity + subtle y elevation)
      tl.fromTo(
        "[data-stat-card]",
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: motion.duration.normal,
          stagger: motion.stagger.normal,
          ease: motion.ease.smooth,
        },
        0.15
      );

      // 3. Coordinated numerical CountUp animations (direct DOM text update, zero re-renders)
      STATS.forEach((stat, i) => {
        const el = numRefs.current[i];
        if (!el) return;

        // Start text at 0
        el.textContent = "0";

        const counter = { val: 0 };
        tl.to(
          counter,
          {
            val: stat.value,
            duration: 1.6,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = Math.round(counter.val).toLocaleString();
            },
          },
          0.3 // Begins rolling as cards settle into place
        );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-16 sm:py-20 bg-[#f8fafc] border-y border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div data-stat-header className="text-center mb-10 sm:mb-14 space-y-2.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Trusted by <span className="text-cyan-600">Students Everywhere</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Real performance numbers from students who transformed their study habits.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              data-stat-card
              className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_30px_-5px_rgba(15,23,42,0.08)] hover:-translate-y-1 transition-all duration-300 group will-change-transform"
              aria-label={`${s.value}${s.suffix} ${s.label}`}
            >
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-2 font-mono">
                <span
                  ref={(el) => {
                    numRefs.current[i] = el;
                  }}
                >
                  {s.value}
                </span>
                <span className="text-cyan-600 ml-0.5">{s.suffix}</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                {s.label}
              </div>
              <div className="text-xs sm:text-[13px] text-slate-500">
                {s.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
