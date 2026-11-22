"use client";

import { useRef } from "react";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

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
}: (typeof TESTIMONIALS)[number]) {
  return (
    <div
      data-testimonial-card
      className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group shadow-xs will-change-transform"
    >
      <div>
        {/* Stars */}
        <div className="flex gap-1 text-amber-400 text-sm group-hover:scale-105 transition-transform duration-300 origin-left">
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
        <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs ring-2 ring-slate-100 group-hover:ring-cyan-200 group-hover:scale-105 transition-all duration-300">
          {initials}
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 group-hover:text-cyan-600 transition-colors">
            {name}
          </div>
          <div className="text-xs text-slate-500">
            {role} · {university}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Accessibility guard: immediately resolve static layout for reduced motion preference
      if (getPrefersReducedMotion()) {
        gsap.set(
          [
            "[data-testimonials-badge]",
            "[data-testimonials-title]",
            "[data-testimonials-desc]",
            "[data-testimonial-card]",
            "[data-trust-bar]",
          ],
          { opacity: 1, x: 0, y: 0, scale: 1, clearProps: "all" }
        );
        return;
      }

      // Master section timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          once: true,
        },
        defaults: { ease: motion.ease.standard },
        onComplete: () => {
          gsap.set("[data-testimonial-card], [data-trust-bar]", {
            clearProps: "willChange",
          });
        },
      });

      // 1. Header sequence
      tl.fromTo(
        "[data-testimonials-badge]",
        { opacity: 0, y: 12, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: motion.ease.spring },
        0
      )
        .fromTo(
          "[data-testimonials-title]",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: motion.duration.normal, ease: motion.ease.smooth },
          0.1
        )
        .fromTo(
          "[data-testimonials-desc]",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.55, ease: motion.ease.smooth },
          0.2
        )

        // 2. Testimonial cards staggered cascade
        .fromTo(
          "[data-testimonial-card]",
          { opacity: 0, y: 28, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.65,
            stagger: 0.08,
            ease: motion.ease.standard,
          },
          0.25
        )

        // 3. Bottom trust bar reveal
        .fromTo(
          "[data-trust-bar]",
          { opacity: 0, y: 16, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.55,
            ease: motion.ease.spring,
          },
          0.6
        );
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="relative py-20 lg:py-28 bg-[#f8fafc] border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14 sm:mb-16 space-y-3.5">
          <div
            data-testimonials-badge
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Student Reviews
            </span>
          </div>
          <h2
            data-testimonials-title
            className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Loved by <span className="text-cyan-600">Students</span>
          </h2>
          <p
            data-testimonials-desc
            className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto"
          >
            Real feedback from students who transformed their academic workflows with Neuron OS.
          </p>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </div>

        {/* Bottom trust bar */}
        <div data-trust-bar className="mt-12 flex justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-xs text-slate-600 bg-white border border-slate-200/80 px-6 py-3 rounded-full shadow-xs">
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
