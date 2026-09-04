"use client";

import { useEffect, useRef } from "react";
import {
  Brain,
  FileText,
  HelpCircle,
  Bell,
  MessageSquare,
  BarChart3,
  Search,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Smart Organization",
    desc: "Automatically categorize and structure your notes, lectures, and materials into intelligent subject trees.",
  },
  {
    icon: FileText,
    title: "AI Summaries",
    desc: "Upload any lecture PDF, DOCX, or PPTX and get concise, structured AI summaries in seconds.",
  },
  {
    icon: HelpCircle,
    title: "Quiz Generation",
    desc: "Turn any lecture or note into an interactive quiz with MCQs, short answers, and instant AI feedback.",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    desc: "AI extracts deadlines from your syllabi and sets intelligent reminder schedules automatically.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat With Notes",
    desc: "Ask questions directly about your uploaded content. Get precise answers grounded in your own materials via RAG.",
  },
  {
    icon: BarChart3,
    title: "Study Analytics",
    desc: "Track XP points, study streaks, quiz scores, and learning velocity with beautiful visual dashboards.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    desc: "Find exactly what you need across all your notes and uploads using vector-powered semantic search.",
  },
  {
    icon: Users,
    title: "Collaboration System",
    desc: "Share notes, summaries, and study materials with classmates in a structured collaborative workspace.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  desc,
  index,
}: (typeof FEATURES)[number] & { index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
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
      className="group relative p-5 rounded-[4px] bg-white border border-[#d0d4db] hover:border-[#0078d4] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-200 cursor-default"
      style={{
        opacity: 0,
        transform: "translateY(20px)",
        transition: `opacity 0.5s ease ${index * 0.06}s, transform 0.5s ease ${index * 0.06}s, border-color 0.15s, box-shadow 0.15s`,
      }}
    >
      {/* Icon */}
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] bg-[#f0f6ff] border border-[#c7e0f4] text-[#0078d4] mb-3 group-hover:bg-[#0078d4] group-hover:text-white transition-colors duration-150">
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <h3 className="text-sm font-semibold text-[#201f1e] mb-1.5 group-hover:text-[#0078d4] transition-colors">
        {title}
      </h3>
      <p className="text-xs text-[#475569] leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

export function FeaturesSection() {
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
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
      id="features"
      className="relative py-20 lg:py-28 bg-[#f8fafc] border-b border-[#e1dfdd]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div
          ref={titleRef}
          className="text-center mb-14 space-y-3"
          style={{ opacity: 0, transform: "translateY(16px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-white border border-[#d0d4db] shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">
              Everything You Need
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#201f1e] tracking-tight">
            Built for <span className="text-[#0078d4]">Smart Students</span>
          </h2>
          <p className="text-sm sm:text-base text-[#475569] max-w-2xl mx-auto">
            8 powerful AI features working together to transform how you learn, organize, and succeed academically.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
