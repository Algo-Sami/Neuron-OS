"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  {
    value: 50000,
    suffix: "+",
    label: "Lectures Processed",
    color: "text-violet-400",
    description: "PDFs, slides, and docs analyzed",
  },
  {
    value: 120000,
    suffix: "+",
    label: "AI Summaries Generated",
    color: "text-cyan-400",
    description: "Instant structured notes",
  },
  {
    value: 35000,
    suffix: "+",
    label: "Quizzes Created",
    color: "text-indigo-400",
    description: "Auto-generated from lectures",
  },
  {
    value: 10,
    suffix: "hrs/wk",
    label: "Average Time Saved",
    color: "text-emerald-400",
    description: "Per student, per week",
  },
];

function useCountUp(target: number, duration: number = 2000, isVisible: boolean) {
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
      // Ease out cubic
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
  const count = useCountUp(value, 2000 + index * 200, isVisible);

  return (
    <div
      className="text-center p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500 group"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${index * 0.15}s, transform 0.7s ease ${index * 0.15}s, background 0.3s, border 0.3s`,
      }}
    >
      <div className={`text-4xl sm:text-5xl font-black ${color} mb-2 group-hover:scale-110 transition-transform duration-300 inline-block`}>
        {count.toLocaleString()}
        <span className="text-2xl sm:text-3xl">{suffix}</span>
      </div>
      <div className="text-base font-bold text-white mb-1">{label}</div>
      <div className="text-sm text-neutral-500">{description}</div>
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
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative py-24 lg:py-32 bg-[#06060e]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Trusted by{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Students Everywhere
            </span>
          </h2>
          <p className="mt-3 text-neutral-500">Real numbers from real students using Neuron OS every day.</p>
        </div>

        <div ref={sectionRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((stat, index) => (
            <StatCard key={stat.label} {...stat} isVisible={isVisible} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
