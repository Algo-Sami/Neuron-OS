"use client";

import { useEffect, useRef, useState } from "react";
import {
  Brain,
  FileText,
  HelpCircle,
  Bell,
  MessageSquare,
  BarChart3,
  Search,
  Users,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Smart Organization",
    desc: "Automatically categorize and structure your notes, lectures, and materials into intelligent subject trees.",
    glowColor: "from-cyan-500/20 to-blue-500/10",
    badge: "8-Layer AI",
  },
  {
    icon: FileText,
    title: "AI Summaries",
    desc: "Upload any lecture PDF, DOCX, or PPTX and get concise, structured AI summaries in seconds.",
    glowColor: "from-blue-500/20 to-indigo-500/10",
    badge: "Study Packs",
  },
  {
    icon: HelpCircle,
    title: "Quiz Generation",
    desc: "Turn any lecture or note into an interactive quiz with MCQs, short answers, and instant AI feedback.",
    glowColor: "from-emerald-500/20 to-teal-500/10",
    badge: "Adaptive Recall",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    desc: "AI extracts deadlines from your syllabi and sets intelligent reminder schedules automatically.",
    glowColor: "from-amber-500/20 to-rose-500/10",
    badge: "Zero Missed Tasks",
  },
  {
    icon: MessageSquare,
    title: "AI Chat With Notes",
    desc: "Ask questions directly about your uploaded content. Get precise answers grounded in your own materials via RAG.",
    glowColor: "from-purple-500/20 to-indigo-500/10",
    badge: "Zero Hallucination",
  },
  {
    icon: BarChart3,
    title: "Study Analytics",
    desc: "Track XP points, study streaks, quiz scores, and learning velocity with beautiful visual dashboards.",
    glowColor: "from-cyan-500/20 to-teal-500/10",
    badge: "Gamified XP",
  },
  {
    icon: Search,
    title: "Semantic Search",
    desc: "Find exactly what you need across all your notes and uploads using vector-powered semantic search.",
    glowColor: "from-blue-500/20 to-cyan-500/10",
    badge: "1536d Vectors",
  },
  {
    icon: Users,
    title: "Collaboration System",
    desc: "Share notes, summaries, and study materials with classmates in a structured collaborative workspace.",
    glowColor: "from-indigo-500/20 to-purple-500/10",
    badge: "Live Whiteboard",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  desc,
  badge,
  glowColor,
  index,
}: (typeof FEATURES)[number] & { index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const [isHovered, setIsHovered] = useState(false);

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

  // Subtle 3D mouse tilt calculation (restrained to 6 degrees max)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransform("perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)");
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-white/[0.02] border border-white/[0.08] hover:border-cyan-500/40 hover:bg-white/[0.04] transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      style={{
        opacity: 0,
        transform: transform || "translateY(20px)",
        transition: isHovered
          ? "transform 0.1s ease-out, border-color 0.25s, background-color 0.25s"
          : `opacity 0.5s ease ${index * 0.05}s, transform 0.4s ease, border-color 0.25s`,
      }}
    >
      {/* Dynamic ambient card glow on hover */}
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${glowColor} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
      />

      <div>
        {/* Top Icon & Badge Row */}
        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] group-hover:scale-105 transition-all duration-300 shadow-inner flex-shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-mono font-medium px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.08] group-hover:text-cyan-300 group-hover:border-cyan-500/30 transition-colors">
            {badge}
          </span>
        </div>

        {/* Content */}
        <h3 className="text-base sm:text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
          {title}
        </h3>
        <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed font-normal">
          {desc}
        </p>
      </div>

      {/* Subtle indicator bar */}
      <div className="mt-5 pt-3 border-t border-white/[0.04] flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 group-hover:text-cyan-400 transition-colors">
        <span>Learn more</span>
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
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
      className="relative py-20 lg:py-28 bg-[#07090e] border-b border-white/[0.06] overflow-hidden"
    >
      {/* Background ambient light */}
      <div className="absolute top-1/3 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div
          ref={titleRef}
          className="text-center mb-14 sm:mb-20 space-y-3.5"
          style={{ opacity: 0, transform: "translateY(16px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-cyan-500/25 shadow-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
              Complete Feature Architecture
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Built for{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              High-Velocity Learning
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            8 autonomous AI capabilities working together to transform raw academic materials into verifiable exam mastery.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
