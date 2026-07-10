"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Play, Sparkles, Zap, Brain, BookOpen } from "lucide-react";

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subtle parallax on mouse move
    const hero = heroRef.current;
    if (!hero) return;
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 30;
      const y = (clientY / innerHeight - 0.5) * 30;
      const orb1 = hero.querySelector<HTMLElement>(".hero-orb-1");
      const orb2 = hero.querySelector<HTMLElement>(".hero-orb-2");
      const orb3 = hero.querySelector<HTMLElement>(".hero-orb-3");
      if (orb1) orb1.style.transform = `translate(${x * 0.6}px, ${y * 0.6}px)`;
      if (orb2) orb2.style.transform = `translate(${-x * 0.4}px, ${-y * 0.4}px)`;
      if (orb3) orb3.style.transform = `translate(${x * 0.3}px, ${y * 0.8}px)`;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      id="home"
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#080810]"
    >
      {/* Animated Background Orbs */}
      <div className="hero-orb-1 absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[120px] transition-transform duration-700 ease-out pointer-events-none" />
      <div className="hero-orb-2 absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[100px] transition-transform duration-700 ease-out pointer-events-none" />
      <div className="hero-orb-3 absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/5 blur-[80px] transition-transform duration-700 ease-out pointer-events-none" />

      {/* Dot Grid */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #a78bfa 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Gradient border bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex flex-col items-center text-center gap-8">

          {/* Badge */}
          <div className="hero-fade-in flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-violet-500/20 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-300">
              AI-Powered Academic Intelligence
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Headline */}
          <div className="hero-fade-in-delay-1 space-y-4 max-w-5xl">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.0] text-white">
              Your{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  AI-Powered
                </span>
              </span>
              <br />
              Academic{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Operating System
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              Upload lectures, generate AI summaries, create quizzes, track deadlines,
              and study smarter — all in one beautifully designed workspace.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="hero-fade-in-delay-2 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/login"
              className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-2xl shadow-violet-600/30 hover:shadow-violet-500/50 transition-all duration-300 hover:scale-105 active:scale-100"
            >
              Start Free Today
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="group flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-neutral-300 hover:text-white rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/[0.04] backdrop-blur-sm transition-all duration-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                <Play className="h-3 w-3 fill-current ml-0.5" />
              </div>
              Watch Demo
            </button>
          </div>

          {/* Social proof chips */}
          <div className="hero-fade-in-delay-3 flex flex-wrap items-center justify-center gap-3 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="flex -space-x-2">
                {["V","S","A","M"].map((l, i) => (
                  <span key={i} className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[9px] font-black text-white border border-[#080810]">
                    {l}
                  </span>
                ))}
              </span>
              <span>1,200+ students already using Neuron</span>
            </span>
            <span className="text-neutral-700">·</span>
            <span className="flex items-center gap-1.5">
              <span className="text-amber-400">★★★★★</span>
              <span>4.9/5 rating</span>
            </span>
          </div>

          {/* Dashboard Mockup */}
          <div className="hero-fade-in-delay-4 w-full max-w-5xl mt-4 relative">
            {/* Glow behind mockup */}
            <div className="absolute -inset-4 bg-gradient-to-b from-violet-600/10 via-indigo-600/5 to-transparent rounded-3xl blur-xl" />

            {/* Mockup Frame */}
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0e0e1a] shadow-2xl shadow-black/60">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0a14] border-b border-white/[0.05]">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500/70" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
                </div>
                <div className="flex-1 mx-4 px-3 py-1 bg-white/[0.04] rounded-md text-[11px] text-neutral-500 text-center">
                  app.neuronos.ai/dashboard
                </div>
              </div>

              {/* Fake Dashboard UI */}
              <div className="p-6 min-h-[320px] sm:min-h-[420px] grid grid-cols-12 gap-4">
                {/* Sidebar mockup */}
                <div className="col-span-2 hidden sm:flex flex-col gap-3">
                  <div className="h-8 rounded-lg bg-violet-600/20 flex items-center px-2 gap-2">
                    <Brain className="h-3.5 w-3.5 text-violet-400" />
                    <div className="h-2 w-12 rounded bg-violet-400/40" />
                  </div>
                  {["Dashboard","Subjects","Uploads","Summaries","Quizzes","Reminders"].map((item, i) => (
                    <div key={item} className={`h-7 rounded-lg flex items-center px-2 gap-2 ${i === 0 ? "bg-white/[0.06]" : ""}`}>
                      <div className="h-2 w-2 rounded bg-white/20" />
                      <div className="h-1.5 rounded bg-white/10" style={{ width: `${40 + i * 8}px` }} />
                    </div>
                  ))}
                </div>

                {/* Main content mockup */}
                <div className="col-span-12 sm:col-span-10 space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Subjects", val: "8", color: "violet" },
                      { label: "Summaries", val: "34", color: "indigo" },
                      { label: "Quizzes", val: "12", color: "cyan" },
                      { label: "XP Points", val: "2,840", color: "emerald" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 space-y-1">
                        <div className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</div>
                        <div className={`text-xl font-black text-${color}-400`}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Summary card */}
                  <div className="rounded-xl bg-gradient-to-br from-violet-600/10 to-indigo-600/5 border border-violet-500/10 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-violet-400" />
                      <span className="text-xs font-bold text-violet-300">AI Summary — Operating Systems Lecture 7</span>
                    </div>
                    <div className="space-y-1.5">
                      {[100, 85, 92, 60].map((w, i) => (
                        <div key={i} className="h-2 rounded-full bg-white/[0.05]">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500/40 to-indigo-500/40" style={{ width: `${w}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-xs font-bold text-neutral-300">Recent Uploads</span>
                      </div>
                      {["Lecture_7.pdf","DB_Notes.docx","OS_Slides.pptx"].map((f) => (
                        <div key={f} className="h-6 rounded-lg bg-white/[0.03] flex items-center px-2 gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] text-neutral-500">{f}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 space-y-2">
                      <div className="text-xs font-bold text-neutral-300">Upcoming Deadlines</div>
                      {[
                        { task: "OS Assignment", days: "2 days", col: "red" },
                        { task: "DB Lab Report", days: "5 days", col: "amber" },
                        { task: "Final Exam", days: "12 days", col: "emerald" },
                      ].map(({ task, days, col }) => (
                        <div key={task} className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-400">{task}</span>
                          <span className={`text-[10px] font-bold text-${col}-400`}>{days}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating AI badge */}
            <div className="absolute -top-4 -right-4 sm:right-8 flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600 shadow-lg shadow-violet-600/40 animate-bounce-slow">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span className="text-xs font-bold text-white whitespace-nowrap">AI Active</span>
            </div>

            {/* Floating summary badge */}
            <div className="absolute -bottom-4 -left-4 sm:left-8 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0e0e1a] border border-white/10 shadow-xl backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-neutral-300 whitespace-nowrap">Summary generated in 2.1s</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hero-fade-in { animation: heroFadeUp 0.8s ease-out both; }
        .hero-fade-in-delay-1 { animation: heroFadeUp 0.8s 0.15s ease-out both; }
        .hero-fade-in-delay-2 { animation: heroFadeUp 0.8s 0.3s ease-out both; }
        .hero-fade-in-delay-3 { animation: heroFadeUp 0.8s 0.45s ease-out both; }
        .hero-fade-in-delay-4 { animation: heroFadeUp 1s 0.6s ease-out both; }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-bounce-slow { animation: bounceSlow 3s ease-in-out infinite; }
        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </section>
  );
}
