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
      className="p-5 rounded-[4px] bg-[#f8fafc] border border-[#d0d4db] hover:bg-white hover:border-[#0078d4] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-150 flex flex-col gap-3 group"
      style={{
        transition: `opacity 0.5s ease ${index * 0.08}s, transform 0.5s ease ${index * 0.08}s, background-color 0.15s, border-color 0.15s`,
      }}
    >
      {/* Stars */}
      <div className="flex gap-0.5">
        {Array.from({ length: rating }).map((_, i) => (
          <span key={i} className="text-[#f7630c] text-xs">★</span>
        ))}
      </div>

      {/* Review */}
      <blockquote className="text-xs text-[#323130] leading-relaxed flex-1">
        &ldquo;{review}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-2.5 pt-2.5 border-t border-[#e1dfdd]">
        <div className="h-8 w-8 rounded-[3px] bg-[#0078d4] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {initials}
        </div>
        <div>
          <div className="text-xs font-semibold text-[#201f1e]">{name}</div>
          <div className="text-[11px] text-[#605e5c]">{role} · {university}</div>
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
      className="relative py-20 lg:py-28 bg-white border-b border-[#e1dfdd]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-14 space-y-3"
          style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db] shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">
              Student Reviews
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#201f1e] tracking-tight">
            Loved by <span className="text-[#0078d4]">Students</span>
          </h2>
          <p className="text-sm sm:text-base text-[#475569] max-w-xl mx-auto">
            Real feedback from students who transformed their academic workflows with Neuron OS.
          </p>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} {...t} index={i} />
          ))}
        </div>

        {/* Bottom trust bar */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-[#605e5c]">
          <div className="flex items-center gap-1.5">
            <span className="flex gap-0.5 text-[#f7630c]">★★★★★</span>
            <span className="font-semibold text-[#201f1e]">4.9/5 average rating</span>
          </div>
          <div className="h-3.5 w-px bg-[#d0d4db] hidden sm:block" />
          <div>1,200+ active students</div>
          <div className="h-3.5 w-px bg-[#d0d4db] hidden sm:block" />
          <div>10+ universities represented</div>
        </div>
      </div>
    </section>
  );
}
