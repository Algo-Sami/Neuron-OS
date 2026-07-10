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
    <div
      ref={itemRef}
      className="border border-white/[0.06] rounded-xl overflow-hidden"
      style={{ transition: `opacity 0.6s ease ${index * 0.07}s, transform 0.6s ease ${index * 0.07}s` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.03] transition-colors duration-200"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white">{q}</span>
        <ChevronDown
          className={`h-4 w-4 text-violet-400 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-6 pb-5 text-sm text-neutral-400 leading-relaxed border-t border-white/[0.04] pt-4">
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
    <section id="faqs" className="relative py-24 lg:py-32 bg-[#06060e]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)" }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-12 space-y-4"
          style={{ transition: "opacity 0.7s ease, transform 0.7s ease" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/20 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">FAQ</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Common{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-neutral-400">
            Everything you need to know about Neuron OS.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
