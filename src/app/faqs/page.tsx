"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { BrainCircuit, Search, ChevronDown, X, ArrowLeft, MessageCircle } from "lucide-react";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { FloatingWhatsApp } from "@/components/landing/floating-whatsapp";

// ─── FAQ Data ───────────────────────────────────────────────────────────────

const FAQ_CATEGORIES = [
  {
    id: "general",
    label: "General",
    emoji: "🧠",
    color: "violet",
    accent: "from-violet-500/10 to-violet-600/5",
    border: "border-violet-500/20",
    iconText: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    id: "ai",
    label: "AI Features",
    emoji: "⚡",
    color: "indigo",
    accent: "from-indigo-500/10 to-indigo-600/5",
    border: "border-indigo-500/20",
    iconText: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    id: "uploads",
    label: "Uploads & Documents",
    emoji: "📂",
    color: "cyan",
    accent: "from-cyan-500/10 to-cyan-600/5",
    border: "border-cyan-500/20",
    iconText: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    emoji: "🔒",
    color: "emerald",
    accent: "from-emerald-500/10 to-emerald-600/5",
    border: "border-emerald-500/20",
    iconText: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    id: "account",
    label: "Account & Auth",
    emoji: "👤",
    color: "amber",
    accent: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-500/20",
    iconText: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "pricing",
    label: "Pricing",
    emoji: "💳",
    color: "rose",
    accent: "from-rose-500/10 to-pink-500/5",
    border: "border-rose-500/20",
    iconText: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    id: "technical",
    label: "Technical Support",
    emoji: "🛠️",
    color: "sky",
    accent: "from-sky-500/10 to-blue-500/5",
    border: "border-sky-500/20",
    iconText: "text-sky-400",
    bg: "bg-sky-500/10",
  },
];

const FAQS: { category: string; q: string; a: string }[] = [
  // General
  {
    category: "general",
    q: "What is Neuron OS?",
    a: "Neuron OS is an AI-powered academic operating system designed for university students. It unifies your lecture notes, AI summaries, quizzes, and deadline tracking into one beautifully designed workspace — eliminating the chaos of juggling multiple apps.",
  },
  {
    category: "general",
    q: "Who is Neuron OS designed for?",
    a: "Neuron OS is built for university and college students across all disciplines — from computer science and engineering to medicine, law, and business. If you attend lectures and need to study smarter, Neuron OS is for you.",
  },
  {
    category: "general",
    q: "Does Neuron OS support reminders and deadline tracking?",
    a: "Yes. Neuron OS automatically extracts deadlines and important dates from your uploaded syllabi and course outlines. It then creates smart reminder schedules so you never miss an assignment or exam.",
  },
  {
    category: "general",
    q: "Can I organize my notes automatically?",
    a: "Absolutely. Neuron OS uses AI to classify and organize your uploaded files into subject-based workspaces. You can create subjects, link files, and let the AI maintain a clean, structured academic library for you.",
  },
  {
    category: "general",
    q: "Does Neuron OS work on mobile devices?",
    a: "Yes — Neuron OS is fully responsive and optimized for mobile browsers. You can access all features including uploads, summaries, quizzes, and chat on your phone. A dedicated mobile app is on our roadmap.",
  },
  // AI Features
  {
    category: "ai",
    q: "How does the Neuron AI work?",
    a: "Neuron OS uses Google's Gemini AI combined with RAG (Retrieval-Augmented Generation). When you upload a document, it's processed into vector embeddings stored in a private database. When you request a summary or ask a question, the AI retrieves the most relevant passages from your content and generates precise, grounded responses — not generic internet answers.",
  },
  {
    category: "ai",
    q: "Does the AI generate quizzes automatically?",
    a: "Yes. After uploading any lecture document, you can click 'Generate Quiz' and Neuron OS will create contextually accurate multiple-choice questions, short-answer questions, and true/false questions based on that specific lecture. You can take the quiz, submit answers, and get instant AI feedback explaining each answer.",
  },
  {
    category: "ai",
    q: "Can I chat with my uploaded notes?",
    a: "Yes — the AI Assistant uses RAG to let you converse with your entire uploaded content library. Ask 'What are the key concepts from my OS lecture?' or 'Explain the Porter's Five Forces from my business notes' and get grounded, accurate answers from your own materials.",
  },
  {
    category: "ai",
    q: "How accurate are the AI summaries?",
    a: "AI summaries are generated directly from your uploaded content, so they reflect exactly what's in your materials. Neuron OS structures summaries with headings, bullet points, and key takeaways for maximum clarity. Accuracy depends on the quality and clarity of the source document.",
  },
  {
    category: "ai",
    q: "Can I search across all my notes with AI?",
    a: "Yes. Neuron OS features semantic search powered by vector embeddings. Unlike keyword search, it understands the meaning of your query — so searching 'process scheduling' will find relevant content even if the exact phrase doesn't appear verbatim in your notes.",
  },
  {
    category: "ai",
    q: "Does Neuron OS support gamification and XP?",
    a: "Yes. Neuron OS includes an XP and achievement system. You earn experience points for uploading files, completing quizzes, maintaining study streaks, and using AI features. This gamified approach keeps you motivated and consistent in your academic work.",
  },
  // Uploads
  {
    category: "uploads",
    q: "Can I upload PDFs and lecture slides?",
    a: "Yes. Neuron OS supports PDF files, Microsoft Word documents (.docx), PowerPoint presentations (.pptx and .ppt), and plain text files. Image-based PDFs are also supported using OCR technology to extract text before AI processing.",
  },
  {
    category: "uploads",
    q: "Is there a file size limit for uploads?",
    a: "The free tier supports file uploads up to 10MB per file. The Scholar (premium) plan increases this limit significantly. Very large files are automatically chunked and processed in segments to ensure complete AI analysis.",
  },
  {
    category: "uploads",
    q: "How long does AI processing take after uploading?",
    a: "Most documents are processed within 2–5 seconds. Larger files (50+ pages) may take up to 30 seconds. You'll see a real-time processing indicator. Once complete, AI summaries, quiz generation, and semantic search are all immediately available.",
  },
  {
    category: "uploads",
    q: "Can I organize uploads by subject?",
    a: "Yes. You can create subject workspaces (e.g., 'Operating Systems', 'Database Systems') and link uploaded files to specific subjects. The AI then maintains context per subject, allowing you to ask subject-specific questions.",
  },
  {
    category: "uploads",
    q: "Can I delete uploaded files?",
    a: "Yes. You can delete any uploaded file from your workspace at any time. Deleting a file removes it from storage and its associated vector embeddings, meaning it will no longer appear in semantic search or AI chat responses.",
  },
  // Privacy
  {
    category: "privacy",
    q: "Is my academic data secure?",
    a: "Yes, security is a core priority. All data is stored using Supabase with Row-Level Security (RLS), meaning only your authenticated account can access your files and notes. Files are stored in private, encrypted storage buckets. We use HTTPS for all data transmission.",
  },
  {
    category: "privacy",
    q: "Is my content used to train AI models?",
    a: "No. Your uploaded content is never used to train AI models. Your academic materials are stored privately and processed only to generate responses for your own use. We take academic privacy seriously.",
  },
  {
    category: "privacy",
    q: "Who can see my uploaded files?",
    a: "Only you. Every file and note in Neuron OS is private to your account, protected by database-level Row-Level Security. No other users, not even Neuron OS administrators, can access your personal academic content.",
  },
  {
    category: "privacy",
    q: "What data do you collect?",
    a: "We collect your email address for authentication, the files you choose to upload, and usage metadata (such as quiz scores and XP progress). We do not sell your data to third parties. Please see our Privacy Policy for full details.",
  },
  // Account
  {
    category: "account",
    q: "How do I create an account?",
    a: "Click 'Get Started' on the landing page or go to the login page and switch to the 'Sign Up' tab. Enter your full name, university email, and a secure password. You'll receive a verification email to confirm your account.",
  },
  {
    category: "account",
    q: "Can I use a Google or social login?",
    a: "Email/password authentication is currently available. OAuth integrations (Google, GitHub) are on the product roadmap and will be added in upcoming releases.",
  },
  {
    category: "account",
    q: "How do I reset my password?",
    a: "On the login page, click 'Forgot Password' and enter your email address. You'll receive a password reset link. If you don't receive it, check your spam folder or contact us at neuronosofficial@gmail.com.",
  },
  {
    category: "account",
    q: "Can I change my email address?",
    a: "You can update your profile information including display name and profile picture from the Profile section of your dashboard. Email changes require verification and can be requested through account settings.",
  },
  // Pricing
  {
    category: "pricing",
    q: "Is Neuron OS free to use?",
    a: "Yes. Neuron OS offers a free Student tier that includes 5 file uploads per month, 5 AI summaries, 5 quiz generations, 1 subject workspace, and 20 AI chat messages. This lets you explore all core features at no cost.",
  },
  {
    category: "pricing",
    q: "What's included in the Scholar plan?",
    a: "The Scholar plan (coming soon) includes unlimited file uploads, unlimited AI summaries and quiz generation, unlimited subject workspaces, unlimited AI chat, semantic search across all notes, detailed analytics, and priority AI processing.",
  },
  {
    category: "pricing",
    q: "Is there a free trial for premium features?",
    a: "We're currently in early access. Sign up for the waitlist on the Pricing section and you'll be among the first to access Scholar features, likely with an extended trial period as a thank-you for being an early supporter.",
  },
  {
    category: "pricing",
    q: "Do you offer student discounts?",
    a: "Yes — student pricing is core to our mission. The Scholar plan is priced specifically for student budgets. Institutional plans are available for universities wanting to provide Neuron OS to their entire student body.",
  },
  // Technical
  {
    category: "technical",
    q: "What browsers does Neuron OS support?",
    a: "Neuron OS works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated to the latest version for the best experience. Internet Explorer is not supported.",
  },
  {
    category: "technical",
    q: "Why is my uploaded file not processing?",
    a: "Ensure the file is a supported format (PDF, DOCX, PPTX, TXT) and under the size limit. If the problem persists, try re-uploading the file. For scanned PDFs, OCR processing may take longer. Contact support via WhatsApp if issues continue.",
  },
  {
    category: "technical",
    q: "Why are my AI responses slow?",
    a: "AI response speed depends on document size and server load. Large documents with many pages may take longer to process. Free tier users share processing resources. Scholar plan users receive priority AI processing for consistently faster responses.",
  },
  {
    category: "technical",
    q: "How do I report a bug or issue?",
    a: "You can report bugs by messaging us on WhatsApp (+92 318 500 5228) or emailing neuronosofficial@gmail.com. Please describe the issue, the steps to reproduce it, and your browser/device. We take all reports seriously and respond within 24 hours.",
  },
  {
    category: "technical",
    q: "Is there an API for developers?",
    a: "A public API for Neuron OS is on the roadmap for institutional integrations. If you're a developer or institution interested in early API access, reach out via LinkedIn or email.",
  },
];

// ─── Components ────────────────────────────────────────────────────────────

function FAQItem({ q, a, index, isOpen, onToggle }: {
  q: string; a: string; index: number; isOpen: boolean; onToggle: () => void;
}) {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(12px)";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        observer.disconnect();
      }
    }, { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={itemRef}
      className={`border rounded-xl overflow-hidden transition-all duration-300 ${
        isOpen ? "border-violet-500/30 bg-violet-500/[0.03]" : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
      style={{ transition: `opacity 0.5s ease ${index * 0.04}s, transform 0.5s ease ${index * 0.04}s, border-color 0.2s, background 0.2s` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span className={`text-sm font-semibold leading-relaxed transition-colors duration-200 ${isOpen ? "text-white" : "text-neutral-300"}`}>
          {q}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 mt-0.5 transition-all duration-300 ${isOpen ? "rotate-180 text-violet-400" : "text-neutral-600"}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-400 ease-in-out"
        style={{ maxHeight: isOpen ? "600px" : "0px", opacity: isOpen ? 1 : 0 }}
      >
        <div className="px-6 pb-5 text-sm text-neutral-400 leading-relaxed border-t border-white/[0.04] pt-4">
          {a}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function FAQsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = activeCategory === "all" || faq.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q || faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: FAQS.length };
    FAQS.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #a78bfa 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/20">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Help Center</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight text-white">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Questions
            </span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about Neuron OS. Browse by category or search below.
            Can&apos;t find an answer?{" "}
            <a
              href="https://wa.me/923185005228"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
            >
              Chat with us on WhatsApp.
            </a>
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.10] rounded-2xl pl-11 pr-12 py-3.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-600 pt-2">
            <span>{FAQS.length} questions answered</span>
            <span className="h-1 w-1 rounded-full bg-neutral-700" />
            <span>{FAQ_CATEGORIES.length} categories</span>
            <span className="h-1 w-1 rounded-full bg-neutral-700" />
            <span className="text-emerald-500">Always updated</span>
          </div>
        </div>
      </section>

      <div className="absolute top-[26rem] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

      {/* Main content */}
      <section className="relative py-12 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8">

            {/* Sidebar: categories */}
            <aside className="lg:w-64 flex-shrink-0">
              <div className="lg:sticky lg:top-24 space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-neutral-600 px-3 mb-3">
                  Categories
                </div>

                {/* All */}
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeCategory === "all"
                      ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span>🗂️</span> All Questions
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeCategory === "all" ? "bg-violet-500/20 text-violet-400" : "bg-white/[0.06] text-neutral-500"}`}>
                    {categoryCounts.all}
                  </span>
                </button>

                {FAQ_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeCategory === cat.id
                        ? `${cat.bg} ${cat.iconText} border ${cat.border}`
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>{cat.emoji}</span> {cat.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${activeCategory === cat.id ? `bg-white/10 ${cat.iconText}` : "bg-white/[0.06] text-neutral-500"}`}>
                      {categoryCounts[cat.id] || 0}
                    </span>
                  </button>
                ))}

                {/* WhatsApp support CTA */}
                <div className="mt-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-3">
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Still have questions?
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Our team responds within 1 hour on WhatsApp.
                  </p>
                  <a
                    href="https://wa.me/923185005228"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </aside>

            {/* FAQ list */}
            <div className="flex-1 min-w-0">
              {/* Active category header */}
              {activeCategory !== "all" && (
                <div className="mb-6 flex items-center gap-3">
                  {(() => {
                    const cat = FAQ_CATEGORIES.find((c) => c.id === activeCategory);
                    return cat ? (
                      <>
                        <div className={`h-8 w-8 rounded-lg ${cat.bg} flex items-center justify-center text-base`}>
                          {cat.emoji}
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${cat.iconText}`}>{cat.label}</div>
                          <div className="text-xs text-neutral-600">{filteredFaqs.length} questions</div>
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Search result info */}
              {searchQuery && (
                <div className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
                  <Search className="h-4 w-4" />
                  <span>
                    {filteredFaqs.length} result{filteredFaqs.length !== 1 ? "s" : ""} for{" "}
                    <span className="text-white font-medium">&ldquo;{searchQuery}&rdquo;</span>
                  </span>
                </div>
              )}

              {/* FAQ items */}
              {filteredFaqs.length > 0 ? (
                <div className="space-y-3">
                  {filteredFaqs.map((faq, index) => {
                    const id = `${faq.category}-${index}`;
                    return (
                      <FAQItem
                        key={id}
                        q={faq.q}
                        a={faq.a}
                        index={index}
                        isOpen={openItems.has(id)}
                        onToggle={() => toggleItem(id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-3xl">
                    🔍
                  </div>
                  <div>
                    <div className="text-base font-bold text-white mb-1">No results found</div>
                    <div className="text-sm text-neutral-500 max-w-xs">
                      Try different keywords or browse a category. You can also{" "}
                      <a href="https://wa.me/923185005228" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                        ask us directly
                      </a>
                      .
                    </div>
                  </div>
                  <button
                    onClick={() => { setSearchQuery(""); setActiveCategory("all"); }}
                    className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-violet-600/20 border border-violet-500/20 hover:bg-violet-600/30 transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative py-20 border-t border-white/[0.05]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-3xl mx-auto px-4 text-center space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BrainCircuit className="h-8 w-8 text-violet-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Still have questions?
          </h2>
          <p className="text-neutral-400">
            Our team is online and happy to help. Reach us on WhatsApp for the fastest response.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/923185005228"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-2xl bg-emerald-600 hover:bg-emerald-500 shadow-2xl shadow-emerald-600/25 transition-all duration-300 hover:scale-105"
            >
              <MessageCircle className="h-5 w-5" />
              Chat on WhatsApp
            </a>
            <Link
              href="/"
              className="px-8 py-4 text-base font-semibold text-neutral-300 hover:text-white border border-white/10 hover:border-white/20 rounded-2xl transition-all duration-300"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
      <FloatingWhatsApp />
    </div>
  );
}
