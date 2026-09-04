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
      className="border border-[#d0d4db] rounded-[4px] bg-white overflow-hidden shadow-xs hover:border-[#0078d4] transition-colors"
      style={{ transition: `opacity 0.4s ease ${index * 0.05}s, transform 0.4s ease ${index * 0.05}s, border-color 0.15s` }}
    >
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-[#f8fafc] transition-colors"
        aria-expanded={open}
      >
        <span className="text-xs sm:text-[13px] font-semibold text-[#201f1e]">{q}</span>
        <ChevronDown
          className={`h-4 w-4 text-[#0078d4] flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-4 text-xs sm:text-[12.5px] text-[#475569] leading-relaxed border-t border-[#e1dfdd] pt-3 bg-[#fbfcfd]">
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
      className="relative py-20 lg:py-28 bg-white border-b border-[#e1dfdd]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-12 space-y-3"
          style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db] shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">FAQ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#201f1e] tracking-tight">
            Common <span className="text-[#0078d4]">Questions</span>
          </h2>
          <p className="text-sm sm:text-base text-[#475569]">
            Everything you need to know about Neuron OS.
          </p>
        </div>

        {/* FAQ list */}
        <div className="space-y-2.5">
          {FAQS.map((faq, index) => (
            <FAQItem key={faq.q} {...faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
