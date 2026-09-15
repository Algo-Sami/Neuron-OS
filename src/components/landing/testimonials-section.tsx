"use client";

import { useEffect, useRef } from "react";

const TESTIMONIALS = [
  {
    name: "Sami Ullah Sardar",
    role: "SE Student",
    university: "CUI Attock Campus",
    initials: "SU",
    rating: 5,
    review:
      "Neuron OS completely changed how I study. The AI summaries save me 3+ hours per lecture, and the quiz generator is incredible for exam prep. I went from barely passing to top of my class.",
  },
  {
    name: "Ayesha Khan",
    role: "Medical Student",
    university: "King Edward Medical",
    initials: "AK",
    rating: 5,
    review:
      "I upload my anatomy slides and Neuron instantly gives me structured notes. The AI chat feature is like having a tutor available 24/7. Absolutely essential for medical school.",
  },
  {
    name: "Hammad Khalid",
    role: "SE Student",
    university: "CUI Attock Campus",
    initials: "HK",
    rating: 5,
    review:
      "The deadline extraction from syllabi is genius. I used to miss assignments constantly. Now Neuron reads my course outline and sets all my reminders automatically. Life-changing.",
  },
  {
    name: "Fatima Malik",
    role: "Business Student",
    university: "LUMS",
    initials: "FM",
    rating: 5,
    review:
      "The semantic search across all my notes is unbelievable. I asked 'explain Porter's Five Forces from my lectures' and it found the exact answer from my uploaded slides instantly.",
  },
  {
    name: "Zakaria Hayat",
    role: "PhD Researcher",
    university: "Lund University",
    initials: "ZH",
    rating: 5,
    review:
      "Even at PhD level, Neuron OS is incredibly useful. I upload research papers and get structured summaries. The AI understands academic writing better than any tool I've tried.",
  },
  {
    name: "Hira Baig",
    role: "Law Student",
    university: "Punjab Law College",
    initials: "HB",
    rating: 5,
    review:
      "Law school involves reading hundreds of case files. Neuron summarizes each one and lets me search across all of them. The XP gamification system keeps me motivated to study daily.",
  },
];

function TestimonialCard({
  name,
  role,
  university,
  initials,
  rating,
  review,
  index,
}: (typeof TESTIMONIALS)[number] & { index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";
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
      className="p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group shadow-xs"
      style={{
        transition: `opacity 0.5s ease ${index * 0.08}s, transform 0.5s ease ${index * 0.08}s, box-shadow 0.25s, border-color 0.25s`,
      }}
    >
      <div>
        {/* Stars */}
        <div className="flex gap-1 text-amber-400 text-sm">
          {Array.from({ length: rating }).map((_, i) => (
            <span key={i}>★</span>
          ))}
        </div>

        {/* Review */}
        <blockquote className="text-xs sm:text-[13.5px] text-slate-600 leading-relaxed flex-1 mt-3.5 mb-4">
          &ldquo;{review}&rdquo;
        </blockquote>
      </div>

      {/* Author */}
      <div className="flex items-center gap-3 pt-3.5 border-t border-slate-100">
        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs ring-2 ring-blue-50">
          {initials}
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">{name}</div>
          <div className="text-xs text-slate-500">{role} · {university}</div>
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
    el.style.transform = "translateY(16px)";
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
    <section
      className="relative py-20 lg:py-28 bg-white border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-14 sm:mb-16 space-y-3.5"
          style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50/80 border border-blue-200/60 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Student Reviews
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Loved by <span className="text-blue-600">Students</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Real feedback from students who transformed their academic workflows with Neuron OS.
          </p>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} {...t} index={i} />
          ))}
        </div>

        {/* Bottom trust bar */}
        <div className="mt-12 flex justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-xs text-slate-600 bg-slate-50/80 border border-slate-200/80 px-6 py-3 rounded-full shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="flex gap-0.5 text-amber-500 font-bold">★★★★★</span>
              <span className="font-bold text-slate-800">4.9/5 average rating</span>
            </div>
            <div className="h-3.5 w-px bg-slate-300 hidden sm:block" />
            <div className="font-medium text-slate-700">1,200+ active students</div>
            <div className="h-3.5 w-px bg-slate-300 hidden sm:block" />
            <div className="font-medium text-slate-700">10+ universities represented</div>
          </div>
        </div>
      </div>
    </section>
  );
}
