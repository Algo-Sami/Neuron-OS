"use client";

import Link from "next/link";
import { ArrowRight, Play, Sparkles, Zap, Brain, BookOpen, ShieldCheck, Cpu } from "lucide-react";
import { HeroCanvas } from "./three/hero-canvas";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-[96vh] flex flex-col justify-center overflow-hidden bg-[#07090e] pt-28 sm:pt-36 pb-20"
    >
      {/* Cinematic Ambient Glow and Grid Lines */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 10%, rgba(56, 189, 248, 0.22), rgba(129, 140, 248, 0.12), rgba(7, 9, 14, 0))",
        }}
      />
      <div
        className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none"
      />
      <div
        className="absolute top-1/3 -right-24 w-[450px] h-[450px] rounded-full bg-purple-600/15 blur-[140px] pointer-events-none"
      />

      {/* Cyber-academic subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.14] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black 40%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black 40%, transparent 90%)",
        }}
      />

      {/* Subtle bottom separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Main Hero Split Grid: Text Column + 3D Neural Core */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* Left Hero Content Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left gap-5 sm:gap-7">
            
            {/* Institutional Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-cyan-400/30 shadow-[0_0_20px_rgba(56,189,248,0.15)] backdrop-blur-md hover:border-cyan-400/60 transition-all duration-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-spin-slow" />
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                AI-Powered Academic Intelligence
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            </div>

            {/* Headline */}
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.12]">
                Your{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.3)]">
                  AI-Powered
                </span>
                <br />
                Academic{" "}
                <span className="text-white relative inline-block">
                  Operating System
                  <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400/80 via-blue-500/50 to-transparent" />
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed font-normal">
                Upload lectures, generate structured AI study packs, take adaptive recall quizzes, and track academic health — all inside an intelligent spatial workspace.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto pt-1">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-size-200 hover:bg-right shadow-[0_0_30px_rgba(0,120,212,0.45)] hover:shadow-[0_0_40px_rgba(56,189,248,0.6)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              >
                <span>Start Free Today</span>
                <ArrowRight className="h-4 w-4 text-cyan-100" />
              </Link>
              <a
                href="#ai-showcase"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.querySelector("#ai-showcase");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-medium text-slate-200 rounded-full bg-white/[0.04] border border-white/[0.12] hover:bg-white/[0.08] hover:border-cyan-400/40 shadow-xs hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 backdrop-blur-md"
              >
                <Play className="h-3.5 w-3.5 fill-cyan-400 text-cyan-400" />
                <span>Watch Demo</span>
              </a>
            </div>

            {/* Social Proof & Metrics Chip */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 text-xs text-slate-300 bg-white/[0.03] backdrop-blur-lg border border-white/[0.08] px-4 py-2 rounded-full shadow-lg mt-1">
              <div className="inline-flex items-center gap-2">
                <div className="flex -space-x-2">
                  {["V", "S", "A", "M"].map((l, i) => (
                    <span
                      key={i}
                      className="h-6 w-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white border border-[#07090e] shadow-xs"
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <span className="font-semibold text-slate-200">1,200+ students actively learning</span>
              </div>
              <span className="text-slate-600">·</span>
              <div className="inline-flex items-center gap-1.5">
                <span className="text-amber-400 text-xs tracking-wider">★★★★★</span>
                <span className="font-semibold text-white">4.9/5 rating</span>
              </div>
            </div>

          </div>

          {/* Right Column (5 cols): Interactive 3D Neural Knowledge Core */}
          <div className="lg:col-span-5 relative w-full flex items-center justify-center">
            
            {/* 3D Canvas Box */}
            <div className="relative w-full h-[380px] sm:h-[450px] lg:h-[490px] rounded-3xl overflow-hidden flex items-center justify-center">
              
              {/* Backlight glow behind 3D core */}
              <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-blue-500/25 via-cyan-400/20 to-indigo-600/20 blur-[80px] pointer-events-none" />

              {/* Three.js Interactive Neural Core */}
              <HeroCanvas />

              {/* Floating Spatial Micro-Badges */}
              <div className="absolute top-4 left-3 sm:left-6 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b0f19]/80 border border-cyan-500/30 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-[11px] text-cyan-300 animate-float-slow pointer-events-none">
                <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                <span className="font-mono font-medium">1536d Vector Knowledge</span>
              </div>

              <div className="absolute bottom-5 right-3 sm:right-6 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b0f19]/80 border border-emerald-500/30 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-[11px] text-emerald-300 animate-float-delayed pointer-events-none">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono font-medium">0.50 Zero-Hallucination Guard</span>
              </div>
            </div>

          </div>
        </div>

        {/* Dashboard Mockup Section (3D Perspective View with Depth) */}
        <div className="w-full max-w-5xl mx-auto mt-14 sm:mt-20 relative">
          
          {/* Subtle glow underneath the frame */}
          <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-purple-600/20 rounded-3xl blur-2xl opacity-50" />

          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/[0.12] bg-[#0b0f19]/90 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(56,189,248,0.1)] transition-all duration-500 hover:border-cyan-500/40">
            
            {/* Window title bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white/[0.03] border-b border-white/[0.08] backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <span className="text-xs font-semibold text-slate-300 ml-2 hidden sm:inline tracking-wide">
                  Neuron OS — Academic Operating System Workspace
                </span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-full text-[11px] text-cyan-400 font-mono shadow-inner">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>app.neuronos.ai/dashboard</span>
              </div>
            </div>

            {/* Window Content */}
            <div className="p-4 sm:p-7 min-h-[340px] grid grid-cols-12 gap-4 sm:gap-6 text-left bg-gradient-to-b from-[#0b0f19] to-[#07090e]">
              
              {/* Sidebar Mockup */}
              <div className="col-span-3 hidden sm:flex flex-col gap-2 border-r border-white/[0.06] pr-4">
                <div className="h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center px-3.5 gap-2.5 text-cyan-300 text-xs font-bold shadow-[0_0_15px_rgba(56,189,248,0.15)]">
                  <Brain className="h-4 w-4 text-cyan-400" />
                  <span>Dashboard</span>
                </div>
                {["Subjects", "Uploads", "Summaries", "Quizzes", "Reminders"].map((item) => (
                  <div
                    key={item}
                    className="h-8 rounded-xl flex items-center px-3 gap-2.5 text-xs font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Main Content Mockup */}
              <div className="col-span-12 sm:col-span-9 space-y-4">
                
                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                  {[
                    { label: "Subjects", val: "8", color: "text-cyan-400", bg: "bg-cyan-500/[0.06] border-cyan-500/20" },
                    { label: "Summaries", val: "34", color: "text-indigo-400", bg: "bg-indigo-500/[0.06] border-indigo-500/20" },
                    { label: "Quizzes", val: "12", color: "text-emerald-400", bg: "bg-emerald-500/[0.06] border-emerald-500/20" },
                    { label: "XP Points", val: "2,840", color: "text-amber-400", bg: "bg-amber-500/[0.06] border-amber-500/20" },
                  ].map(({ label, val, color, bg }) => (
                    <div key={label} className={`rounded-xl border p-3.5 ${bg} backdrop-blur-xs transition-transform hover:-translate-y-0.5`}>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">{label}</div>
                      <div className={`text-xl sm:text-2xl font-black ${color} mt-0.5 font-mono`}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* AI Summary Card */}
                <div className="rounded-xl bg-white/[0.03] border border-cyan-500/20 p-4 space-y-2.5 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs sm:text-sm font-semibold text-slate-100">
                        AI Summary — Operating Systems Lecture 7: Virtual Memory
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      RAG Verified
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {[95, 82, 88, 65].map((w, i) => (
                      <div key={i} className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.08] p-4 space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-200">Recent Uploads</span>
                    </div>
                    {["Lecture_7_VM.pdf", "DB_Normalization.docx", "OS_Process_Sync.pptx"].map((f) => (
                      <div key={f} className="h-8 rounded-lg bg-white/[0.02] flex items-center px-3 gap-2.5 border border-white/[0.05] hover:border-cyan-500/30 transition-colors">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                        <span className="text-xs text-slate-300 font-mono truncate">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.08] p-4 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-200">Upcoming Deadlines</div>
                    {[
                      { task: "OS Assignment 3", days: "2 days", col: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
                      { task: "DB Lab Report", days: "5 days", col: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                      { task: "Final Sessional Exam", days: "12 days", col: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                    ].map(({ task, days, col }) => (
                      <div key={task} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-slate-300">{task}</span>
                        <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] border ${col}`}>{days}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Floating AI Status Badge */}
          <div className="absolute -top-3.5 right-4 sm:right-8 flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_25px_rgba(56,189,248,0.4)] text-xs font-semibold border border-cyan-300/40">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Pipeline Active</span>
          </div>

          {/* Floating Summary Generation Speed Badge */}
          <div className="absolute -bottom-3.5 left-4 sm:left-8 flex items-center gap-2 px-4 py-2 rounded-full bg-[#0b0f19]/90 border border-white/[0.12] shadow-xl backdrop-blur-md">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-xs font-medium text-slate-300">Study pack compiled in 2.1s</span>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes floatDelayed {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        .animate-spin-slow {
          animation: spinSlow 12s linear infinite;
        }
        .animate-float-slow {
          animation: floatSlow 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: floatDelayed 6s ease-in-out 3s infinite;
        }
        .bg-size-200 {
          background-size: 200% auto;
        }
      `}</style>
    </section>
  );
}
