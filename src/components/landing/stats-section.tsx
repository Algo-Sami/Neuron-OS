"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  {
    value: 50000,
    suffix: "+",
    label: "Lectures Processed",
    color: "text-cyan-400 drop-shadow-[0_0_20px_rgba(56,189,248,0.35)]",
    description: "PDFs, slides, and docs analyzed",
  },
  {
    value: 120000,
    suffix: "+",
    label: "AI Summaries Generated",
    color: "text-indigo-400 drop-shadow-[0_0_20px_rgba(129,140,248,0.35)]",
    description: "Instant structured notes",
  },
  {
    value: 35000,
    suffix: "+",
    label: "Quizzes Created",
    color: "text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.35)]",
    description: "Auto-generated from lectures",
  },
  {
    value: 10,
    suffix: "hrs/wk",
    label: "Average Time Saved",
    color: "text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.35)]",
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
      className="text-center p-6 sm:p-7 rounded-2xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_15px_40px_rgba(56,189,248,0.12)] hover:border-cyan-500/35 hover:-translate-y-1.5 transition-all duration-300 group relative overflow-hidden"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s, box-shadow 0.3s, border-color 0.3s`,
      }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />
      
      <div className={`text-3xl sm:text-4xl lg:text-5xl font-black ${color} mb-2 tracking-tight font-mono group-hover:scale-105 transition-transform duration-300`}>
        {count.toLocaleString()}
        <span className="text-xl sm:text-2xl ml-0.5">{suffix}</span>
      </div>
      <div className="text-sm sm:text-base font-bold text-white mb-1 tracking-wide">{label}</div>
      <div className="text-xs sm:text-[13px] text-slate-400">{description}</div>
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
    <section className="relative py-16 sm:py-24 bg-[#07090e] border-b border-white/[0.06] overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 space-y-3">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Trusted by{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Students Everywhere
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Real performance numbers from students using Neuron OS daily.
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
