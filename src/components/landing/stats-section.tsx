"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  {
    value: 50000,
    suffix: "+",
    label: "Lectures Processed",
    color: "text-[#0078d4]",
    description: "PDFs, slides, and docs analyzed",
  },
  {
    value: 120000,
    suffix: "+",
    label: "AI Summaries Generated",
    color: "text-[#005a9e]",
    description: "Instant structured notes",
  },
  {
    value: 35000,
    suffix: "+",
    label: "Quizzes Created",
    color: "text-[#107c41]",
    description: "Auto-generated from lectures",
  },
  {
    value: 10,
    suffix: "hrs/wk",
    label: "Average Time Saved",
    color: "text-[#004578]",
    description: "Per student, per week",
  },
];

function useCountUp(target: number, duration: number = 1800, isVisible: boolean) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible, target, duration]);

  return count;
}

function StatCard({
  value,
  suffix,
  label,
  color,
  description,
  isVisible,
  index,
}: (typeof STATS)[number] & { isVisible: boolean; index: number }) {
  const count = useCountUp(value, 1800 + index * 150, isVisible);

  return (
    <div
      className="text-center p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-300/80 hover:-translate-y-1.5 transition-all duration-300 group"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s, box-shadow 0.3s, border-color 0.3s`,
      }}
    >
      <div className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold ${color} mb-1.5 tracking-tight group-hover:scale-105 transition-transform duration-300`}>
        {count.toLocaleString()}
        <span className="text-xl sm:text-2xl ml-0.5">{suffix}</span>
      </div>
      <div className="text-sm sm:text-base font-bold text-slate-800 mb-1">{label}</div>
      <div className="text-xs sm:text-[13px] text-slate-500">{description}</div>
    </div>
  );
}

export function StatsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="relative py-16 sm:py-24 bg-white border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 space-y-2.5">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Trusted by <span className="text-blue-600">Students Everywhere</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Real numbers from real students using Neuron OS every day.
          </p>
        </div>

        <div ref={sectionRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((stat, index) => (
            <StatCard key={stat.label} {...stat} isVisible={isVisible} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
