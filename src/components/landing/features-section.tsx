"use client";

import { useEffect, useRef } from "react";
import {
  Brain, FileText, HelpCircle, Bell, MessageSquare,
  BarChart3, Search, Users
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Smart Organization",
    desc: "Automatically categorize and structure your notes, lectures, and materials into intelligent subject trees.",
    color: "violet",
    gradient: "from-violet-500/10 to-violet-600/5",
    border: "border-violet-500/20",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
  {
    icon: FileText,
    title: "AI Summaries",
    desc: "Upload any lecture PDF, DOCX, or PPTX and get concise, structured AI summaries in seconds.",
    color: "indigo",
    gradient: "from-indigo-500/10 to-indigo-600/5",
    border: "border-indigo-500/20",
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-400",
  },
  {
    icon: HelpCircle,
    title: "Quiz Generation",
    desc: "Turn any lecture or note into an interactive quiz with MCQs, short answers, and instant AI feedback.",
    color: "cyan",
    gradient: "from-cyan-500/10 to-cyan-600/5",
    border: "border-cyan-500/20",
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    desc: "AI extracts deadlines from your syllabi and sets intelligent reminder schedules automatically.",
    color: "amber",
    gradient: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-500/20",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
  {
    icon: MessageSquare,
    title: "AI Chat With Notes",
    desc: "Ask questions directly about your uploaded content. Get precise answers grounded in your own materials via RAG.",
    color: "emerald",
    gradient: "from-emerald-500/10 to-emerald-600/5",
    border: "border-emerald-500/20",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
  {
    icon: BarChart3,
    title: "Study Analytics",
    desc: "Track XP points, study streaks, quiz scores, and learning velocity with beautiful visual dashboards.",
    color: "rose",
    gradient: "from-rose-500/10 to-pink-500/5",
    border: "border-rose-500/20",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-400",
  },
  {
    icon: Search,
    title: "Semantic Search",
    desc: "Find exactly what you need across all your notes and uploads using vector-powered semantic search.",
    color: "sky",
    gradient: "from-sky-500/10 to-blue-500/5",
    border: "border-sky-500/20",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
  },
  {
    icon: Users,
    title: "Collaboration System",
    desc: "Share notes, summaries, and study materials with classmates in a structured collaborative workspace.",
    color: "purple",
    gradient: "from-purple-500/10 to-violet-500/5",
    border: "border-purple-500/20",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-400",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  desc,
  gradient,
  border,
  iconBg,
  iconColor,
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
      className={`group relative p-6 rounded-2xl bg-gradient-to-br ${gradient} border ${border} 
        hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/30
        transition-all duration-500 cursor-default`}
      style={{
        opacity: 0,
        transform: "translateY(32px)",
        transition: `opacity 0.6s ease ${index * 0.08}s, transform 0.6s ease ${index * 0.08}s, box-shadow 0.3s, scale 0.3s`,
      }}
    >
      {/* Hover glow overlay */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

      {/* Icon */}
      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>

      {/* Content */}
      <h3 className="text-base font-bold text-white mb-2 group-hover:text-white transition-colors">
        {title}
      </h3>
      <p className="text-sm text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors">
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
    <section id="features" className="relative py-24 lg:py-32 bg-[#080810]">
      {/* Subtle top separator */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

      {/* Background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-violet-900/10 blur-[150px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div
          ref={titleRef}
          className="text-center mb-16 space-y-4"
          style={{ opacity: 0, transform: "translateY(24px)", transition: "opacity 0.7s ease, transform 0.7s ease" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/20 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Everything You Need</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
            Built for{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Smart Students
            </span>
          </h2>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            8 powerful AI features working together to transform how you learn, organize, and succeed academically.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
