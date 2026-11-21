"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Sparkles } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", href: "#home", type: "hash" },
  { label: "Features", href: "#features", type: "hash" },
  { label: "AI Assistant", href: "#ai-showcase", type: "hash" },
  { label: "About", href: "#about", type: "hash" },
  { label: "Pricing", href: "#pricing", type: "hash" },
  { label: "FAQs", href: "#faqs", type: "hash" },
  { label: "Contact", href: "#contact", type: "hash" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === "/";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    link: (typeof NAV_LINKS)[number]
  ) => {
    if (link.type === "route") {
      setMobileOpen(false);
      return;
    }
    e.preventDefault();
    setMobileOpen(false);
    if (!isLanding) {
      router.push("/" + link.href);
      return;
    }
    const el = document.querySelector(link.href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#07090e]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            : "bg-[#07090e]/45 backdrop-blur-md border-b border-white/[0.05]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(56,189,248,0.35)] group-hover:scale-105 transition-transform duration-200">
                <span className="relative z-10 font-mono tracking-tight font-black">N</span>
                <span className="absolute inset-0 rounded-xl bg-cyan-400 opacity-0 group-hover:opacity-30 blur-sm transition-opacity" />
              </div>
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-extrabold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                    NEURON OS
                  </span>
                  <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <span className="text-[9.5px] font-semibold uppercase tracking-widest text-cyan-400/90 leading-none mt-0.5">
                  Academic AI
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1.5 rounded-full border border-white/[0.08] backdrop-blur-lg">
              {NAV_LINKS.map((link) => {
                const isActive = link.type === "route" && pathname === link.href;
                if (link.type === "route") {
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                        isActive
                          ? "text-cyan-300 bg-white/10 shadow-xs font-semibold"
                          : "text-slate-300 hover:text-white hover:bg-white/[0.07]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                }
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link)}
                    className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-cyan-300 rounded-full hover:bg-white/[0.07] transition-all duration-200"
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-full border border-transparent hover:border-white/[0.08] transition-all duration-200"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="relative group inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-[0_0_20px_rgba(0,120,212,0.35)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <span>Get Started</span>
                <Sparkles className="h-3 w-3 text-cyan-200 group-hover:rotate-12 transition-transform" />
              </Link>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden px-4 ${
            mobileOpen ? "max-h-[580px] opacity-100 pb-4" : "max-h-0 opacity-0 pb-0"
          }`}
        >
          <div className="bg-[#0b0f19]/95 backdrop-blur-2xl border border-white/[0.1] p-4 rounded-2xl shadow-2xl space-y-1">
            {NAV_LINKS.map((link) => {
              if (link.type === "route") {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                      pathname === link.href
                        ? "text-cyan-400 bg-cyan-500/10 font-semibold border border-cyan-500/20"
                        : "text-slate-300 hover:text-cyan-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              }
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link)}
                  className="block px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-cyan-300 hover:bg-white/[0.05] rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              );
            })}
            <div className="pt-3 mt-2 border-t border-white/[0.08] flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-center text-slate-200 hover:bg-white/[0.06] border border-white/[0.1] rounded-full transition-colors"
              >
                Login
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold text-center text-white rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 shadow-[0_0_20px_rgba(0,120,212,0.4)] transition-all"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
