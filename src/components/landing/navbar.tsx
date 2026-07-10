"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrainCircuit, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", href: "#home", type: "hash" },
  { label: "Features", href: "#features", type: "hash" },
  { label: "AI Assistant", href: "#ai-showcase", type: "hash" },
  { label: "About", href: "#about", type: "hash" },
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
      return; // Let Next Link handle it
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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#080810]/85 backdrop-blur-2xl border-b border-white/[0.06] shadow-xl shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/45 transition-all duration-300 group-hover:scale-105">
                <BrainCircuit className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-black tracking-tighter text-white">NEURON OS</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400 leading-none">
                  Academic AI
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map((link) => {
                const isActive =
                  link.type === "route" && pathname === link.href;
                if (link.type === "route") {
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group ${
                        isActive
                          ? "text-violet-400 bg-violet-500/10"
                          : "text-neutral-300 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      {link.label}
                      {isActive && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400" />
                      )}
                    </Link>
                  );
                }
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link)}
                    className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all duration-200"
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
                className="px-4 py-2 text-sm font-semibold text-neutral-300 hover:text-white transition-colors duration-200"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/25 hover:shadow-violet-500/40 transition-all duration-300 hover:scale-105 active:scale-100"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-300 overflow-hidden ${
            mobileOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-[#080810]/97 backdrop-blur-2xl border-t border-white/[0.06] px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => {
              if (link.type === "route") {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      pathname === link.href
                        ? "text-violet-400 bg-violet-500/10"
                        : "text-neutral-300 hover:text-white hover:bg-white/[0.06]"
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
                  className="block px-4 py-3 text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all duration-200"
                >
                  {link.label}
                </a>
              );
            })}
            <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-center text-neutral-300 hover:text-white border border-white/10 rounded-xl transition-colors"
              >
                Login
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-sm font-bold text-center text-white rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all"
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
