"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { HeroCanvas } from "./three/hero-canvas";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Accessibility guard: instantly show complete content if user prefers reduced motion
      if (getPrefersReducedMotion()) {
        gsap.set(
          [
            "[data-hero='ambient']",
            "[data-hero='canvas']",
            "[data-hero='badge']",
            "[data-hero='title-line-1']",
            "[data-hero='title-line-2']",
            "[data-hero='subtitle']",
            "[data-hero='cta']",
            "[data-hero='trust']",
          ],
          { opacity: 1, y: 0, scale: 1, clearProps: "all" }
        );
        return;
      }

      // Master Hero Entrance Timeline
      const tl = gsap.timeline({
        defaults: { ease: motion.ease.standard },
        delay: 0.1,
        onComplete: () => {
          // Release GPU will-change hints after animation settles to conserve device memory
          gsap.set("[data-hero]", { clearProps: "willChange" });
        },
      });

      // 1. Atmosphere ambient glow & 3D canvas graceful fade-in
      tl.fromTo(
        "[data-hero='ambient']",
        { opacity: 0 },
        { opacity: 1, duration: motion.duration.slow, ease: motion.ease.smooth },
        0
      )
      .fromTo(
        "[data-hero='canvas']",
        { opacity: 0 },
        { opacity: 1, duration: motion.duration.slow, ease: motion.ease.smooth },
        0.05
      )

      // 2. Category badge: subtle spring pop
      .fromTo(
        "[data-hero='badge']",
        { opacity: 0, y: 16, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: motion.ease.spring },
        0.2
      )

      // 3. Signature Headline: Kinetic overflow-mask reveals (staggered lines)
      .fromTo(
        "[data-hero='title-line-1']",
        { y: "115%" },
        { y: "0%", duration: motion.duration.moderate, ease: motion.ease.bold },
        0.35
      )
      .fromTo(
        "[data-hero='title-line-2']",
        { y: "115%" },
        { y: "0%", duration: motion.duration.moderate, ease: motion.ease.bold },
        0.47
      )

      // 4. Value proposition subtitle: gentle fade and soft rise
      .fromTo(
        "[data-hero='subtitle']",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: motion.duration.normal, ease: motion.ease.smooth },
        0.62
      )

      // 5. Action CTAs: coordinated button cascade
      .fromTo(
        "[data-hero='cta']",
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: motion.stagger.normal,
          ease: motion.ease.smooth,
        },
        0.78
      )

      // 6. Social proof trust badges
      .fromTo(
        "[data-hero='trust']",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.45, ease: motion.ease.smooth },
        0.95
      );
    },
    { scope: heroRef }
  );

  return (
    <section
      ref={heroRef}
      id="home"
      className="relative min-h-[82vh] flex flex-col justify-center overflow-hidden bg-white pt-28 sm:pt-36 pb-24 sm:pb-32"
    >
      {/* Full Hero 3D Spatial Canvas Layer */}
      <div data-hero="canvas" className="absolute inset-0 pointer-events-none">
        <HeroCanvas />
      </div>

      {/* Wasmer-inspired ethereal cyan & sky blue ambient gradient */}
      <div data-hero="ambient" className="pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 75% 55% at 50% 0%, rgba(56, 189, 248, 0.16), rgba(224, 242, 254, 0.6), rgba(255, 255, 255, 0))",
          }}
        />
        <div className="absolute top-1/4 -left-20 w-[450px] h-[450px] rounded-full bg-cyan-100/40 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] rounded-full bg-indigo-100/30 blur-[120px] pointer-events-none" />
      </div>

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
          {/* Badge */}
          <div
            data-hero="badge"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] backdrop-blur-md will-change-transform"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-800">
              The AI Academic Operating System
            </span>
          </div>

          {/* Large Bold Typography with Kinetic Overflow Mask Reveals */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            <span className="inline-block overflow-hidden pb-1 align-bottom">
              <span
                data-hero="title-line-1"
                className="inline-block will-change-transform"
              >
                Powerful &amp; Intelligent{" "}
              </span>
            </span>
            <span className="inline-block overflow-hidden pb-1 align-bottom">
              <span
                data-hero="title-line-2"
                className="inline-block bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent will-change-transform"
              >
                Academic OS
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            data-hero="subtitle"
            className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed font-normal will-change-transform"
          >
            Upload course lectures, generate structured AI study packs, take adaptive recall quizzes, and master complex subjects with zero friction.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-2 w-full sm:w-auto">
            <Link
              href="/login"
              data-hero="cta"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded-full bg-slate-900 hover:bg-slate-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 will-change-transform"
            >
              <span>Start Free Today</span>
              <ArrowRight className="h-4 w-4 text-cyan-300" />
            </Link>

            <a
              href="#ai-showcase"
              data-hero="cta"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-slate-700 rounded-full bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 will-change-transform"
            >
              <Play className="h-3.5 w-3.5 fill-slate-800 text-slate-800" />
              <span>Watch Demo</span>
            </a>
          </div>

          {/* Trust badge */}
          <div
            data-hero="trust"
            className="flex items-center gap-3 text-xs text-slate-500 pt-1 will-change-transform"
          >
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
      </div>
    </section>
  );
}
