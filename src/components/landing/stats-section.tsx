"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { value: 50, suffix: "K+", label: "Lectures Processed", desc: "PDFs, slides, and docs analyzed" },
  { value: 120, suffix: "K+", label: "AI Summaries Generated", desc: "Instant structured study notes" },
  { value: 35, suffix: "K+", label: "Quizzes Created", desc: "Auto-generated from course materials" },
  { value: 10, suffix: " hrs/wk", label: "Average Time Saved", desc: "Per student, each week" },
];

function useCountUp(target: number, duration: number = 1800, start: boolean = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    let animId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(ease * target));
      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [target, duration, start]);

  return count;
}

function StatCard({
  value,
  suffix,
  label,
  desc,
  index,
}: (typeof STATS)[number] & { index: number }) {
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const count = useCountUp(value, 1600 + index * 100, inView);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_30px_-5px_rgba(15,23,42,0.08)] hover:-translate-y-1 transition-all duration-300 group"
    >
      <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight mb-2 font-mono">
        {count}
        <span className="text-cyan-600 ml-0.5">{suffix}</span>
      </div>
      <div className="text-sm sm:text-base font-bold text-slate-900 mb-1">
        {label}
      </div>
      <div className="text-xs sm:text-[13px] text-slate-500">
        {desc}
      </div>
    </div>
  );
}

export function StatsSection() {
  return (
    <section className="relative py-16 sm:py-20 bg-[#f8fafc] border-y border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14 space-y-2.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Trusted by <span className="text-cyan-600">Students Everywhere</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Real performance numbers from students who transformed their study habits.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((s, i) => (
            <StatCard key={s.label} {...s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
