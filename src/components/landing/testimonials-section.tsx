"use client";

import { useEffect, useRef } from "react";

const TESTIMONIALS = [
  {
    name: "Sami Ullah Sardar",
    role: "SE Student",
    university: "CUI Attock Campus",
    initials: "SU",
    color: "from-violet-500 to-indigo-500",
    rating: 5,
    review:
      "Neuron OS completely changed how I study. The AI summaries save me 3+ hours per lecture, and the quiz generator is incredible for exam prep. I went from barely passing to top of my class.",
  },
  {
    name: "Ayesha Khan",
    role: "Medical Student",
    university: "King Edward Medical",
    initials: "AK",
    color: "from-cyan-500 to-blue-500",
    rating: 5,
    review:
      "I upload my anatomy slides and Neuron instantly gives me structured notes. The AI chat feature is like having a tutor available 24/7. Absolutely essential for medical school.",
  },
  {
    name: "Hammad Khalid",
    role: "SE Student",
    university: "CUI Attock Campus",
    initials: "HK",
    color: "from-emerald-500 to-teal-500",
    rating: 5,
    review:
      "The deadline extraction from syllabi is genius. I used to miss assignments constantly. Now Neuron reads my course outline and sets all my reminders automatically. Life-changing.",
  },
  {
    name: "Fatima Malik",
    role: "Business Student",
    university: "LUMS",
    initials: "FM",
    color: "from-rose-500 to-pink-500",
    rating: 5,
    review:
      "The semantic search across all my notes is unbelievable. I asked 'explain Porter's Five Forces from my lectures' and it found the exact answer from my uploaded slides instantly.",
  },
  {
    name: "Zakaria Hayat",
    role: "PhD Researcher",
    university: "Lund University",
    initials: "ZH",
    color: "from-amber-500 to-orange-500",
    rating: 5,
    review:
      "Even at PhD level, Neuron OS is incredibly useful. I upload research papers and get structured summaries. The AI understands academic writing better than any tool I've tried.",
  },
  {
    name: "Hira Baig",
    role: "Law Student",
    university: "Punjab Law College",
    initials: "HB",
    color: "from-purple-500 to-violet-500",
    rating: 5,
    review:
      "Law school involves reading hundreds of case files. Neuron summarizes each one and lets me search across all of them. The XP gamification system keeps me motivated to study daily.",
  },
];

function TestimonialCard({ name, role, university, initials, color, rating, review, index }: (typeof TESTIMONIALS)[number] & { index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.opacity = "0";
    card.style.transform = "translateY(24px)";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500 flex flex-col gap-4 group"
      style={{ transition: `opacity 0.7s ease ${index * 0.1}s, transform 0.7s ease ${index * 0.1}s, background 0.3s, border 0.3s` }}
    >
      {/* Stars */}
      <div className="flex gap-0.5">
        {Array.from({ length: rating }).map((_, i) => (
          <span key={i} className="text-amber-400 text-sm">★</span>
        ))}
      </div>

      {/* Review */}
      <blockquote className="text-sm text-neutral-400 leading-relaxed flex-1 group-hover:text-neutral-300 transition-colors duration-300">
        &ldquo;{review}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/[0.05]">
        <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
          {initials}
        </div>
        <div>
          <div className="text-sm font-bold text-white">{name}</div>
          <div className="text-xs text-neutral-500">{role} · {university}</div>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = titleRef.current;
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
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative py-24 lg:py-32 bg-[#080810]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-violet-900/8 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-16 space-y-4"
          style={{ transition: "opacity 0.7s ease, transform 0.7s ease" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/20 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Student Reviews</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
            Loved by{" "}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              Students
            </span>
          </h2>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            Real feedback from students who transformed their academic workflows with Neuron OS.
          </p>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} {...t} index={i} />
          ))}
        </div>

        {/* Bottom trust bar */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="flex gap-0.5 text-amber-400">★★★★★</span>
            <span>4.9/5 average rating</span>
          </div>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div>1,200+ active students</div>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div>10+ universities represented</div>
        </div>
      </div>
    </section>
  );
}
