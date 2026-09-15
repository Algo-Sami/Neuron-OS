"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";

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
    const handler = () => setScrolled(window.scrollY > 15);
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
            ? "bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
            : "bg-white/70 backdrop-blur-sm border-b border-slate-200/50"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
                N
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  NEURON OS
                </span>
                <span className="text-[9.5px] font-semibold uppercase tracking-wider text-blue-600 leading-none mt-0.5">
                  Academic AI
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100/60 p-1 rounded-full border border-slate-200/60">
              {NAV_LINKS.map((link) => {
                const isActive = link.type === "route" && pathname === link.href;
                if (link.type === "route") {
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                        isActive
                          ? "text-blue-600 bg-white shadow-xs font-semibold"
                          : "text-slate-600 hover:text-blue-600 hover:bg-white/60"
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
                    className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 rounded-full hover:bg-white/60 transition-all duration-200"
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center gap-2.5">
              <Link
                href="/login"
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-100/80 rounded-full transition-all duration-200"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="px-5 py-2 text-xs font-semibold text-white rounded-full bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/25 hover:shadow-md hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden px-4 ${
            mobileOpen ? "max-h-[520px] opacity-100 pb-4" : "max-h-0 opacity-0 pb-0"
          }`}
        >
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 p-4 rounded-2xl shadow-xl space-y-1">
            {NAV_LINKS.map((link) => {
              if (link.type === "route") {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                      pathname === link.href
                        ? "text-blue-600 bg-blue-50 font-semibold"
                        : "text-slate-700 hover:text-blue-600 hover:bg-slate-50"
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
                  className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              );
            })}
            <div className="pt-3 mt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-center text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-full transition-colors"
              >
                Login
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold text-center text-white rounded-full bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
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
