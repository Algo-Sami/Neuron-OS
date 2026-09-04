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
            ? "bg-white/95 backdrop-blur-md border-b border-[#d0d4db] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            : "bg-white/90 backdrop-blur-md border-b border-[#e1dfdd]"
        }`}
        style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#0078d4] text-white font-bold text-xs shadow-sm">
                N
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold tracking-wide text-[#201f1e]">
                  NEURON OS
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-[#0078d4] leading-none mt-0.5">
                  Academic AI
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = link.type === "route" && pathname === link.href;
                if (link.type === "route") {
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative px-3 py-1.5 text-[13px] font-normal rounded-[3px] transition-colors duration-150 ${
                        isActive
                          ? "text-[#0078d4] bg-[#e5f1fb] font-medium"
                          : "text-[#323130] hover:text-[#0078d4] hover:bg-[#f3f2f1]"
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
                    className="px-3 py-1.5 text-[13px] font-normal text-[#323130] hover:text-[#0078d4] rounded-[3px] hover:bg-[#f3f2f1] transition-colors duration-150"
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
                className="px-3.5 py-1.5 text-[13px] font-medium text-[#201f1e] hover:text-[#0078d4] hover:bg-[#f3f2f1] rounded-[3px] border border-[#d0d4db] transition-colors duration-150"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="px-4 py-1.5 text-[13px] font-semibold text-white rounded-[3px] bg-[#0078d4] hover:bg-[#106ebe] shadow-sm transition-colors duration-150"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 rounded-[3px] text-[#323130] hover:text-[#0078d4] hover:bg-[#f3f2f1] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-200 overflow-hidden ${
            mobileOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-white border-t border-[#e1dfdd] px-4 py-3 space-y-1 shadow-lg">
            {NAV_LINKS.map((link) => {
              if (link.type === "route") {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2 text-[13px] font-normal rounded-[3px] transition-colors ${
                      pathname === link.href
                        ? "text-[#0078d4] bg-[#e5f1fb] font-medium"
                        : "text-[#323130] hover:text-[#0078d4] hover:bg-[#f3f2f1]"
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
                  className="block px-3 py-2 text-[13px] font-normal text-[#323130] hover:text-[#0078d4] hover:bg-[#f3f2f1] rounded-[3px] transition-colors"
                >
                  {link.label}
                </a>
              );
            })}
            <div className="pt-2 border-t border-[#e1dfdd] flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-[13px] font-medium text-center text-[#201f1e] hover:bg-[#f3f2f1] border border-[#d0d4db] rounded-[3px] transition-colors"
              >
                Login
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-[13px] font-semibold text-center text-white rounded-[3px] bg-[#0078d4] hover:bg-[#106ebe] transition-colors"
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
