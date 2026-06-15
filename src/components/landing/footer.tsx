"use client";

import Link from "next/link";
import { BrainCircuit, Mail, Globe, ArrowRight, MapPin, MessageCircle } from "lucide-react";

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "#features", hash: true },
    { label: "AI Showcase", href: "#ai-showcase", hash: true },
    { label: "Pricing", href: "#pricing", hash: true },
    { label: "Changelog", href: "#", hash: false },
    { label: "Roadmap", href: "#", hash: false },
  ],
  Resources: [
    { label: "FAQs", href: "/faqs", hash: false },
    { label: "Documentation", href: "#", hash: false },
    { label: "Blog", href: "#", hash: false },
    { label: "Tutorials", href: "#", hash: false },
    { label: "Support", href: "#contact", hash: true },
  ],
  Company: [
    { label: "About", href: "#about", hash: true },
    { label: "Contact", href: "#contact", hash: true },
    { label: "Privacy Policy", href: "#", hash: false },
    { label: "Terms of Service", href: "#", hash: false },
    { label: "Cookie Policy", href: "#", hash: false },
  ],
};

const SOCIAL_LINKS = [
  {
    label: "WhatsApp",
    href: "https://wa.me/923185005228",
    external: true,
    icon: (
      <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    color: "hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/sami-ullah-58808a356",
    external: true,
    icon: (
      <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    color: "hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/5",
  },
  {
    label: "Email",
    href: "mailto:neuronosofficial@gmail.com",
    external: false,
    icon: <Mail className="h-4 w-4" />,
    color: "hover:text-violet-400 hover:border-violet-500/30 hover:bg-violet-500/5",
  },
  {
    label: "Location",
    href: "https://maps.google.com/?q=Attock,Pakistan",
    external: true,
    icon: <MapPin className="h-4 w-4" />,
    color: "hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/5",
  },
];

export function LandingFooter() {
  const handleHashClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#") && href.length > 1) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <footer className="relative bg-[#04040c] border-t border-white/[0.06]">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {/* CTA Banner */}
      <div className="relative border-b border-white/[0.06] py-16">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(139,92,246,0.07) 0%, transparent 70%)" }}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Ready to Study{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Smarter?
            </span>
          </h2>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Join thousands of students who are already using Neuron OS to ace their academics with the power of AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-2xl shadow-violet-600/30 hover:shadow-violet-500/50 transition-all duration-300 hover:scale-105"
            >
              Start Free Today
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://wa.me/923185005228"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 text-base font-semibold text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5 rounded-2xl transition-all duration-300"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Us
            </a>
          </div>
        </div>
      </div>

      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Brand column */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/20">
                <BrainCircuit className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-black tracking-tighter text-white">NEURON OS</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400 leading-none mt-0.5">
                  Academic AI
                </span>
              </div>
            </Link>

            <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">
              The AI-powered academic operating system that helps students organize, summarize, and master their coursework.
            </p>

            {/* Contact quick-info */}
            <div className="space-y-2">
              <a
                href="mailto:neuronosofficial@gmail.com"
                className="flex items-center gap-2 text-xs text-neutral-500 hover:text-violet-400 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                neuronosofficial@gmail.com
              </a>
              <a
                href="https://wa.me/923185005228"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-neutral-500 hover:text-emerald-400 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                +92 318 500 5228
              </a>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Globe className="h-3.5 w-3.5" />
                Attock, Pakistan
              </div>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-2.5">
              {SOCIAL_LINKS.map(({ label, href, external, icon, color }) => (
                <a
                  key={label}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  aria-label={label}
                  className={`h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-neutral-500 transition-all duration-200 ${color}`}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title} className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500">{title}</h4>
              <ul className="space-y-3">
                {links.map(({ label, href, hash }) => {
                  if (!hash && !href.startsWith("#")) {
                    return (
                      <li key={label}>
                        <Link
                          href={href}
                          className="text-sm text-neutral-500 hover:text-white transition-colors duration-200"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={label}>
                      <a
                        href={href}
                        onClick={(e) => handleHashClick(e, href)}
                        className="text-sm text-neutral-500 hover:text-white transition-colors duration-200"
                      >
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-600">
            © {new Date().getFullYear()} Neuron OS. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span>Built with</span>
            <span className="text-rose-500">♥</span>
            <span>for students everywhere</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
