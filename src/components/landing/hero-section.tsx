"use client";

import Link from "next/link";
import { ArrowRight, Play, Sparkles, Zap, Brain, BookOpen } from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#fafbfc] pt-28 sm:pt-32 pb-16 sm:pb-20"
    >
      {/* Ambient background glow — Google Workspace style */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none opacity-60"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0, 120, 212, 0.12), rgba(255, 255, 255, 0))",
        }}
      />

      {/* Subtle architectural dot grid */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Subtle bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-200/70" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col items-center text-center gap-6 sm:gap-8">

          {/* Institutional Badge */}
          <div className="hero-fade-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-blue-200/80 shadow-xs hover:border-blue-300 transition-colors">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              AI-Powered Academic Intelligence
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Headline */}
          <div className="hero-fade-in-delay-1 space-y-3.5 max-w-4xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Your{" "}
              <span className="text-blue-600 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                AI-Powered
              </span>
              <br />
              Academic{" "}
              <span className="text-slate-900">Operating System</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
              Upload lectures, generate AI summaries, create quizzes, track deadlines,
              and study smarter — all in one beautifully designed workspace.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="hero-fade-in-delay-2 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto px-4 sm:px-0">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-semibold text-white rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Start Free Today
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#ai-showcase"
              onClick={(e) => {
                e.preventDefault();
                const el = document.querySelector("#ai-showcase");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-slate-700 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <Play className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
              Watch Demo
            </a>
          </div>

          {/* Social proof chips */}
          <div className="hero-fade-in-delay-3 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 bg-white/70 backdrop-blur-sm border border-slate-200/60 px-4 py-2 rounded-full shadow-xs">
            <span className="inline-flex items-center gap-2">
              <span className="flex -space-x-2">
                {["V", "S", "A", "M"].map((l, i) => (
                  <span
                    key={i}
                    className="h-6 w-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-xs"
                  >
                    {l}
                  </span>
                ))}
              </span>
              <span className="font-semibold text-slate-700">1,200+ students already using Neuron</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-amber-500 text-xs tracking-wider">★★★★★</span>
              <span className="font-semibold text-slate-800">4.9/5 rating</span>
            </span>
          </div>

          {/* Dashboard Mockup (Elevated Floating Frame) */}
          <div className="hero-fade-in-delay-4 w-full max-w-4xl mt-4 sm:mt-6 relative">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/80 bg-white shadow-[0_20px_50px_-15px_rgba(15,23,42,0.12),0_0_1px_1px_rgba(15,23,42,0.05)] transition-all duration-300 hover:shadow-[0_25px_60px_-15px_rgba(0,120,212,0.18)]">
              {/* Window title bar */}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-slate-600 ml-2 hidden sm:inline">Neuron OS — Academic Workspace</span>
                </div>
                <div className="px-3.5 py-1 bg-white border border-slate-200/70 rounded-full text-[11px] text-slate-500 font-mono shadow-xs">
                  app.neuronos.ai/dashboard
                </div>
              </div>

              {/* Window Content */}
              <div className="p-4 sm:p-6 min-h-[340px] grid grid-cols-12 gap-4 sm:gap-5 text-left bg-gradient-to-b from-white to-slate-50/40">
                {/* Sidebar mockup */}
                <div className="col-span-3 hidden sm:flex flex-col gap-1.5 border-r border-slate-100 pr-4">
                  <div className="h-8 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center px-3 gap-2.5 text-blue-600 text-xs font-semibold">
                    <Brain className="h-4 w-4 text-blue-600" />
                    <span>Dashboard</span>
                  </div>
                  {["Subjects", "Uploads", "Summaries", "Quizzes", "Reminders"].map((item) => (
                    <div
                      key={item}
                      className="h-8 rounded-xl flex items-center px-3 gap-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100/70 hover:text-slate-800 transition-colors"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {/* Main content mockup */}
                <div className="col-span-12 sm:col-span-9 space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    {[
                      { label: "Subjects", val: "8", color: "text-blue-600", bg: "bg-blue-50/50 border-blue-100/80" },
                      { label: "Summaries", val: "34", color: "text-indigo-600", bg: "bg-indigo-50/50 border-indigo-100/80" },
                      { label: "Quizzes", val: "12", color: "text-emerald-600", bg: "bg-emerald-50/50 border-emerald-100/80" },
                      { label: "XP Points", val: "2,840", color: "text-amber-600", bg: "bg-amber-50/50 border-amber-100/80" },
                    ].map(({ label, val, color, bg }) => (
                      <div key={label} className={`rounded-xl border p-3 ${bg} shadow-xs`}>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">{label}</div>
                        <div className={`text-xl font-bold ${color} mt-0.5`}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Summary card */}
                  <div className="rounded-xl bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border border-blue-100 p-3.5 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-semibold text-slate-800">
                        AI Summary — Operating Systems Lecture 7
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[95, 82, 88, 65].map((w, i) => (
                        <div key={i} className="h-2 rounded-full bg-blue-100/80 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white border border-slate-200/80 p-3.5 space-y-2.5 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-semibold text-slate-800">Recent Uploads</span>
                      </div>
                      {["Lecture_7.pdf", "DB_Notes.docx", "OS_Slides.pptx"].map((f) => (
                        <div key={f} className="h-7 rounded-lg bg-slate-50/80 flex items-center px-2.5 gap-2 border border-slate-100">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-xs text-slate-700 font-mono truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200/80 p-3.5 space-y-2.5 shadow-xs">
                      <div className="text-xs font-semibold text-slate-800">Upcoming Deadlines</div>
                      {[
                        { task: "OS Assignment", days: "2 days", col: "text-rose-600 bg-rose-50" },
                        { task: "DB Lab Report", days: "5 days", col: "text-amber-600 bg-amber-50" },
                        { task: "Final Exam", days: "12 days", col: "text-emerald-600 bg-emerald-50" },
                      ].map(({ task, days, col }) => (
                        <div key={task} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">{task}</span>
                          <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${col}`}>{days}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating AI badge */}
            <div className="absolute -top-3.5 right-4 sm:right-8 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 text-xs font-semibold border border-blue-400/40">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Active</span>
            </div>

            {/* Floating summary badge */}
            <div className="absolute -bottom-3.5 left-4 sm:left-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200/80 shadow-lg shadow-slate-900/5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-700">Summary generated in 2.1s</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hero-fade-in { animation: heroFadeUp 0.6s ease-out both; }
        .hero-fade-in-delay-1 { animation: heroFadeUp 0.6s 0.1s ease-out both; }
        .hero-fade-in-delay-2 { animation: heroFadeUp 0.6s 0.2s ease-out both; }
        .hero-fade-in-delay-3 { animation: heroFadeUp 0.6s 0.3s ease-out both; }
        .hero-fade-in-delay-4 { animation: heroFadeUp 0.7s 0.4s ease-out both; }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
