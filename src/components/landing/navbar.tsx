"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Menu, X } from "lucide-react";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Initial smooth appearance
  useGSAP(
    () => {
      if (getPrefersReducedMotion()) {
        gsap.set(headerRef.current, { opacity: 1, y: 0, clearProps: "all" });
        return;
      }

      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: -16 },
        { opacity: 1, y: 0, duration: 0.6, ease: motion.ease.smooth }
      );
    },
    { scope: headerRef }
  );

  // Scroll state listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard accessibility: Escape closes mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#") && href.length > 1) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <>
      {/* Floating Pill Navbar */}
      <header
        ref={headerRef}
        className="fixed top-4 sm:top-5 left-0 right-0 z-40 px-4 sm:px-6 lg:px-8 transition-all duration-300"
      >
        <div className="max-w-6xl mx-auto">
          <nav
            className={`flex items-center justify-between rounded-full px-5 sm:px-6 py-2.5 transition-all duration-300 ${
              scrolled
                ? "bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.1)]"
                : "bg-white/80 backdrop-blur-md border border-slate-200/70 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)]"
            }`}
          >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="relative flex h-8 w-8 sm:h-8.5 sm:w-8.5 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform duration-200">
                <span className="relative z-10 font-mono tracking-tight font-black text-cyan-400">N</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 group-hover:text-cyan-600 transition-colors">
                  NEURON OS
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 leading-none mt-0.5">
                  Academic AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100/70 p-1 rounded-full border border-slate-200/50">
              {[
                { label: "Home", href: "#home" },
                { label: "Features", href: "#features" },
                { label: "AI Assistant", href: "#ai-showcase" },
                { label: "About", href: "#about" },
                { label: "Pricing", href: "#pricing" },
                { label: "FAQs", href: "#faqs" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  className="px-3.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-full hover:bg-white transition-all duration-200"
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Right Action Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white rounded-full bg-slate-900 hover:bg-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <span>Start Free</span>
                <Sparkles className="h-3 w-3 text-cyan-300" />
              </Link>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </nav>

          {/* Mobile Menu Dropdown */}
          <div
            className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden mt-2 ${
              mobileMenuOpen ? "max-h-96 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/80 p-4 rounded-2xl shadow-xl space-y-1">
              {[
                { label: "Home", href: "#home" },
                { label: "Features", href: "#features" },
                { label: "AI Assistant", href: "#ai-showcase" },
                { label: "About", href: "#about" },
                { label: "Pricing", href: "#pricing" },
                { label: "FAQs", href: "#faqs" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleLinkClick(e, item.href)}
                  className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-cyan-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-3 mt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/login"
                  className="block px-4 py-2 text-sm font-medium text-center text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-full transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/login"
                  className="block px-4 py-2 text-sm font-semibold text-center text-white rounded-full bg-slate-900 hover:bg-slate-800 shadow-md transition-all"
                >
                  Start Free Today
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
