"use client";

import Link from "next/link";
import { ArrowRight, Play, Zap, Brain, BookOpen } from "lucide-react";
import { HeroCanvas } from "./three/hero-canvas";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden bg-white pt-36 sm:pt-40 pb-20"
    >
      {/* Wasmer-inspired ethereal cyan & sky blue ambient gradient */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 50% 0%, rgba(56, 189, 248, 0.16), rgba(224, 242, 254, 0.6), rgba(255, 255, 255, 0))",
        }}
      />
      <div className="absolute top-1/4 -left-20 w-[450px] h-[450px] rounded-full bg-cyan-100/40 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] rounded-full bg-indigo-100/30 blur-[120px] pointer-events-none" />

      {/* Subtle fine dot matrix grid */}
      <div
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 90%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Main Hero Header (Centered & Wasmer-inspired) */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6">
          {/* 3D Knowledge Core Orb directly above title */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 -mb-6 relative flex items-center justify-center">
            <HeroCanvas />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-800">
              The AI Academic Operating System
            </span>
          </div>

          {/* Large Bold Typography */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Powerful &amp; Intelligent{" "}
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Academic OS
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed font-normal">
            Upload course lectures, generate structured AI study packs, take adaptive recall quizzes, and master complex subjects with zero friction.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-2 w-full sm:w-auto">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded-full bg-slate-900 hover:bg-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <span>Start Free Today</span>
              <ArrowRight className="h-4 w-4 text-cyan-300" />
            </Link>

            <a
              href="#ai-showcase"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-slate-700 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <Play className="h-3.5 w-3.5 fill-slate-800 text-slate-800" />
              <span>Watch Demo</span>
            </a>
          </div>

          {/* Trust badge */}
          <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
            <div className="flex -space-x-1.5">
              <span className="h-5 w-5 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-white">S</span>
              <span className="h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-white">A</span>
              <span className="h-5 w-5 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-white">H</span>
            </div>
            <span>Used by 1,200+ students across top universities</span>
            <span>·</span>
            <span className="text-amber-500 font-bold">★ 4.9/5</span>
          </div>
        </div>

        {/* Elevated Workspace Preview Card (Wasmer inspired) */}
        <div className="w-full max-w-5xl mx-auto mt-14 sm:mt-18 relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-100 via-sky-100 to-indigo-100 rounded-[2.5rem] blur-xl opacity-60 pointer-events-none" />

          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.08),0_1px_3px_rgba(0,0,0,0.04)]">
            {/* Window bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/70">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-semibold text-slate-600 ml-2 hidden sm:inline">
                  Neuron OS — Academic Workspace
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200/80 rounded-full text-[11px] text-slate-600 font-mono shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>app.neuronos.ai/dashboard</span>
              </div>
            </div>

            {/* Inset Dashboard Body */}
            <div className="p-4 sm:p-7 min-h-[300px] grid grid-cols-12 gap-4 sm:gap-6 text-left bg-white">
              {/* Left sidebar nav */}
              <div className="col-span-3 hidden sm:flex flex-col gap-1.5 border-r border-slate-100 pr-4">
                <div className="h-8.5 rounded-xl bg-slate-900 text-white flex items-center px-3 gap-2.5 text-xs font-semibold shadow-xs">
                  <Brain className="h-4 w-4 text-cyan-400" />
                  <span>Dashboard</span>
                </div>
                <div className="h-8 rounded-xl flex items-center px-3 gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  <span>Subjects</span>
                </div>
                <div className="h-8 rounded-xl flex items-center px-3 gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  <span>Uploads</span>
                </div>
                <div className="h-8 rounded-xl flex items-center px-3 gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  <span>Summaries</span>
                </div>
                <div className="h-8 rounded-xl flex items-center px-3 gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  <span>Quizzes</span>
                </div>
                <div className="h-8 rounded-xl flex items-center px-3 gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  <span>Reminders</span>
                </div>
              </div>

              {/* Right main panel */}
              <div className="col-span-12 sm:col-span-9 space-y-4">
                {/* 4 Stat chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="rounded-xl border border-slate-200/70 p-3 bg-slate-50/60">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Subjects</div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">8</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 p-3 bg-slate-50/60">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Summaries</div>
                    <div className="text-xl font-bold text-cyan-600 mt-0.5">34</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 p-3 bg-slate-50/60">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Quizzes</div>
                    <div className="text-xl font-bold text-emerald-600 mt-0.5">12</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 p-3 bg-slate-50/60">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">XP Points</div>
                    <div className="text-xl font-bold text-amber-600 mt-0.5">2,840</div>
                  </div>
                </div>

                {/* AI Summary card */}
                <div className="rounded-xl bg-cyan-50/40 border border-cyan-100 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-cyan-600" />
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Operating Systems Lecture 7: Virtual Memory
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-cyan-700 bg-cyan-100/80 px-2.5 py-0.5 rounded-full">
                      AI Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Paging, page tables, segmentation, and translation lookaside buffer (TLB) mechanisms extracted into key recall cards.
                  </p>
                </div>

                {/* Split recent uploads & deadlines */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200/70 p-3.5 space-y-2 bg-white">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <BookOpen className="h-3.5 w-3.5 text-cyan-600" />
                      <span>Recent Course Materials</span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="font-medium truncate">OS_Lecture_7.pdf</span>
                        <span className="text-[10px] text-slate-400">2.4 MB</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="font-medium truncate">DB_Normalization.docx</span>
                        <span className="text-[10px] text-slate-400">1.1 MB</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/70 p-3.5 space-y-2 bg-white">
                    <div className="text-xs font-bold text-slate-800">Smart Deadlines</div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">OS Assignment 3</span>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">2 days</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-600">DB Lab Report</span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">5 days</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
