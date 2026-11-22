"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

const FAQS = [
  {
    q: "How does Neuron OS AI work?",
    a: "Neuron OS uses Google's Gemini AI combined with RAG (Retrieval-Augmented Generation). When you upload a lecture file, it's processed and stored as vector embeddings. When you ask questions or request summaries, the AI retrieves the most relevant content from your specific materials and generates precise answers — not generic internet responses.",
  },
  {
    q: "Is my academic data secure?",
    a: "Yes. All your files and notes are stored securely using Supabase with Row-Level Security (RLS), meaning only you can access your data. Files are stored in private, encrypted storage buckets. We never use your academic content to train AI models.",
  },
  {
    q: "What file types can I upload?",
    a: "Neuron OS supports PDF files, Microsoft Word documents (.docx), PowerPoint presentations (.pptx/.ppt), and plain text files. Image-based PDFs are also processed using OCR technology. Support for more file types is continuously being added.",
  },
  {
    q: "Does it automatically generate quizzes from my lectures?",
    a: "Yes! After uploading any lecture file, you can click 'Generate Quiz' and Neuron OS will create contextually accurate multiple-choice questions, short answer questions, and true/false questions based specifically on the content of that lecture. You can then take the quiz and get instant AI feedback.",
  },
  {
    q: "Can I chat with my uploaded notes?",
    a: "Absolutely. The AI Assistant feature uses RAG to let you have a conversation with all your uploaded materials. Ask 'What are the key points from my OS lecture?' or 'Explain the concept mentioned in my database notes' and get accurate, grounded answers.",
  },
  {
    q: "How does the deadline extraction work?",
    a: "When you upload a syllabus, course outline, or any document containing dates and assignment names, the AI scans for deadline-related information and extracts it into your reminders system. It creates smart notification schedules so you're always aware of upcoming deadlines.",
  },
  {
    q: "Is Neuron OS free to use?",
    a: "Neuron OS offers a free tier that includes core features like file uploads, AI summaries, and basic quiz generation. Premium features including unlimited storage, advanced AI chat, and detailed analytics are available with a subscription. Sign up to explore the free tier today.",
  },
  {
    q: "Can I use Neuron OS on my phone?",
    a: "Yes! Neuron OS is fully responsive and optimized for mobile browsers. You can upload files, read summaries, take quizzes, and check deadlines from any device. A dedicated mobile app is on our roadmap.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      data-faq-item
      className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 will-change-transform"
    >
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className="w-full flex items-center justify-between gap-4 px-6 py-4.5 text-left hover:bg-slate-50/70 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm sm:text-base font-bold text-slate-900">{q}</span>
        <ChevronDown
          className={`h-5 w-5 text-slate-500 flex-shrink-0 transition-transform duration-300 ease-out ${
            open ? "rotate-180 text-cyan-600" : ""
          }`}
        />
      </button>

      {/* Smooth, robust CSS Grid accordion transition */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-5 pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
            {a}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FAQSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (getPrefersReducedMotion()) {
        gsap.set(
          ["[data-faq-badge]", "[data-faq-title]", "[data-faq-desc]", "[data-faq-item]"],
          { opacity: 1, x: 0, y: 0, scale: 1, clearProps: "all" }
        );
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          once: true,
        },
        defaults: { ease: motion.ease.standard },
        onComplete: () => {
          gsap.set("[data-faq-item]", { clearProps: "willChange" });
        },
      });

      // 1. Header sequence
      tl.fromTo(
        "[data-faq-badge]",
        { opacity: 0, y: 12, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: motion.ease.spring },
        0
      )
        .fromTo(
          "[data-faq-title]",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: motion.duration.normal, ease: motion.ease.smooth },
          0.1
        )
        .fromTo(
          "[data-faq-desc]",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.55, ease: motion.ease.smooth },
          0.2
        )

        // 2. FAQ items staggered cascade
        .fromTo(
          "[data-faq-item]",
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.05,
            ease: motion.ease.standard,
          },
          0.25
        );
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="faqs"
      className="relative py-20 lg:py-28 bg-[#f8fafc] border-b border-slate-200/70"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-14 space-y-3.5">
          <div
            data-faq-badge
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-800 shadow-xs"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              FAQ
            </span>
          </div>
          <h2
            data-faq-title
            className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Common <span className="text-cyan-600">Questions</span>
          </h2>
          <p
            data-faq-desc
            className="text-sm sm:text-base text-slate-600"
          >
            Everything you need to know about Neuron OS.
          </p>
        </div>

        {/* FAQ list */}
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
