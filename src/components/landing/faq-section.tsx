"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

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

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(12px)";
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
    <div
      ref={itemRef}
      className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-xs hover:border-blue-300/80 hover:shadow-md transition-all duration-200"
      style={{ transition: `opacity 0.4s ease ${index * 0.05}s, transform 0.4s ease ${index * 0.05}s, border-color 0.2s` }}
    >
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50/70 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm sm:text-base font-bold text-slate-900">{q}</span>
        <ChevronDown
          className={`h-5 w-5 text-blue-600 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-6 pb-5 pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
          {a}
        </div>
      </div>
    </div>
  );
}

export function FAQSection() {
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
      id="faqs"
      className="relative py-20 lg:py-28 bg-white border-b border-slate-200/70"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-12 sm:mb-14 space-y-3.5"
          style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50/80 border border-blue-200/60 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Common <span className="text-blue-600">Questions</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Everything you need to know about Neuron OS.
          </p>
        </div>

        {/* FAQ list */}
        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <FAQItem key={faq.q} {...faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
