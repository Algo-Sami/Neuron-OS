"use client";

import Link from "next/link";
import { ArrowRight, Play, Sparkles, Zap, Brain, BookOpen } from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#f8fafc] pt-24 pb-16"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      {/* Subtle architectural dot grid */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Subtle bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#e1dfdd]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-7">

          {/* Institutional Badge */}
          <div className="hero-fade-in inline-flex items-center gap-2 px-3 py-1 rounded-[3px] bg-white border border-[#d0d4db] shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-[#0078d4]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">
              AI-Powered Academic Intelligence
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#107c41]" />
          </div>

          {/* Headline */}
          <div className="hero-fade-in-delay-1 space-y-3 max-w-4xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#201f1e] leading-[1.12]">
              Your{" "}
              <span className="text-[#0078d4]">AI-Powered</span>
              <br />
              Academic{" "}
              <span className="text-[#0f172a]">Operating System</span>
            </h1>
            <p className="text-base sm:text-lg text-[#475569] max-w-2xl mx-auto leading-relaxed font-normal">
              Upload lectures, generate AI summaries, create quizzes, track deadlines,
              and study smarter — all in one beautifully designed workspace.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="hero-fade-in-delay-2 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-[3px] bg-[#0078d4] hover:bg-[#106ebe] active:bg-[#005a9e] shadow-sm transition-colors duration-150"
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
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#201f1e] rounded-[3px] bg-white border border-[#d0d4db] hover:bg-[#f3f2f1] active:bg-[#edebe9] shadow-xs transition-colors duration-150"
            >
              <Play className="h-3.5 w-3.5 fill-[#0078d4] text-[#0078d4]" />
              Watch Demo
            </a>
          </div>

          {/* Social proof chips */}
          <div className="hero-fade-in-delay-3 flex flex-wrap items-center justify-center gap-2.5 text-xs text-[#605e5c]">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex -space-x-1.5">
                {["V", "S", "A", "M"].map((l, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full bg-[#0078d4] flex items-center justify-center text-[9px] font-bold text-white border border-white"
                  >
                    {l}
                  </span>
                ))}
              </span>
              <span className="font-medium text-[#323130]">1,200+ students already using Neuron</span>
            </span>
            <span className="text-[#a19f9d]">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[#f7630c] text-xs">★★★★★</span>
              <span className="font-medium text-[#323130]">4.9/5 rating</span>
            </span>
          </div>

          {/* Dashboard Mockup (Windows Explorer / Fluent Frame) */}
          <div className="hero-fade-in-delay-4 w-full max-w-4xl mt-3 relative">
            <div className="relative rounded-[6px] overflow-hidden border border-[#d0d4db] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              {/* Window title bar */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#f3f4f6] border-b border-[#e1dfdd]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#e81123]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffb900]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#107c41]/70" />
                  </div>
                  <span className="text-[11px] font-medium text-[#605e5c] ml-2">Neuron OS — Academic Workspace</span>
                </div>
                <div className="px-3 py-0.5 bg-white border border-[#d0d4db] rounded-[3px] text-[10.5px] text-[#605e5c]">
                  app.neuronos.ai/dashboard
                </div>
              </div>

              {/* Window Content */}
              <div className="p-5 min-h-[340px] grid grid-cols-12 gap-4 text-left">
                {/* Sidebar mockup */}
                <div className="col-span-3 hidden sm:flex flex-col gap-1.5 border-r border-[#e1dfdd] pr-3">
                  <div className="h-7 rounded-[3px] bg-[#e5f1fb] flex items-center px-2.5 gap-2 text-[#0078d4] text-xs font-semibold">
                    <Brain className="h-3.5 w-3.5" />
                    <span>Dashboard</span>
                  </div>
                  {["Subjects", "Uploads", "Summaries", "Quizzes", "Reminders"].map((item) => (
                    <div
                      key={item}
                      className="h-7 rounded-[3px] flex items-center px-2.5 gap-2 text-xs font-normal text-[#605e5c] hover:bg-[#f3f2f1]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#a19f9d]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {/* Main content mockup */}
                <div className="col-span-12 sm:col-span-9 space-y-3.5">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: "Subjects", val: "8", color: "text-[#0078d4]" },
                      { label: "Summaries", val: "34", color: "text-[#005a9e]" },
                      { label: "Quizzes", val: "12", color: "text-[#107c41]" },
                      { label: "XP Points", val: "2,840", color: "text-[#d83b01]" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="rounded-[3px] bg-[#f8fafc] border border-[#d0d4db] p-2.5">
                        <div className="text-[10px] text-[#605e5c] uppercase font-medium">{label}</div>
                        <div className={`text-lg font-bold ${color}`}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Summary card */}
                  <div className="rounded-[3px] bg-[#f0f6ff] border border-[#c7e0f4] p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-[#0078d4]" />
                      <span className="text-xs font-semibold text-[#004578]">
                        AI Summary — Operating Systems Lecture 7
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[95, 82, 88, 65].map((w, i) => (
                        <div key={i} className="h-1.5 rounded-full bg-[#d0e7f9]">
                          <div className="h-full rounded-full bg-[#0078d4]" style={{ width: `${w}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-[3px] bg-white border border-[#d0d4db] p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-[#0078d4]" />
                        <span className="text-xs font-semibold text-[#201f1e]">Recent Uploads</span>
                      </div>
                      {["Lecture_7.pdf", "DB_Notes.docx", "OS_Slides.pptx"].map((f) => (
                        <div key={f} className="h-6 rounded-[2px] bg-[#f8fafc] flex items-center px-2 gap-2 border border-[#e1dfdd]">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#107c41]" />
                          <span className="text-[10.5px] text-[#323130] font-mono">{f}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-[3px] bg-white border border-[#d0d4db] p-3 space-y-2">
                      <div className="text-xs font-semibold text-[#201f1e]">Upcoming Deadlines</div>
                      {[
                        { task: "OS Assignment", days: "2 days", col: "text-[#a4262c]" },
                        { task: "DB Lab Report", days: "5 days", col: "text-[#ca5010]" },
                        { task: "Final Exam", days: "12 days", col: "text-[#107c41]" },
                      ].map(({ task, days, col }) => (
                        <div key={task} className="flex items-center justify-between text-[11px]">
                          <span className="text-[#323130]">{task}</span>
                          <span className={`font-semibold ${col}`}>{days}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating AI badge */}
            <div className="absolute -top-3 right-2 sm:right-6 flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#0078d4] text-white shadow-md text-xs font-semibold">
              <Sparkles className="h-3 w-3" />
              <span>AI Active</span>
            </div>

            {/* Floating summary badge */}
            <div className="absolute -bottom-3 left-2 sm:left-6 flex items-center gap-2 px-3 py-1.5 rounded-[3px] bg-white border border-[#d0d4db] shadow-md">
              <div className="h-2 w-2 rounded-full bg-[#107c41]" />
              <span className="text-xs font-medium text-[#323130]">Summary generated in 2.1s</span>
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
