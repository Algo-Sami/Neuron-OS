"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, Sparkles, Zap } from "lucide-react";

const PLANS = [
  {
    name: "Student",
    price: "Free",
    priceNote: "Forever",
    description: "Perfect for getting started and exploring Neuron OS.",
    features: [
      "5 file uploads per month",
      "AI summaries (5/month)",
      "Quiz generation (5/month)",
      "Basic deadline extraction",
      "AI chat (20 messages/month)",
      "1 subject workspace",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Scholar",
    price: "Coming Soon",
    priceNote: "Early access",
    description: "Full AI power for serious academic performance.",
    badge: "Most Popular",
    features: [
      "Unlimited file uploads",
      "Unlimited AI summaries",
      "Unlimited quiz generation",
      "Smart deadline scheduling",
      "Unlimited AI chat",
      "Unlimited subject workspaces",
      "Semantic search across all notes",
      "Study analytics dashboard",
      "Priority AI processing",
    ],
    cta: "Join Waitlist",
    popular: true,
  },
  {
    name: "Institution",
    price: "Custom",
    priceNote: "Contact us",
    description: "For universities and academic institutions.",
    badge: null,
    features: [
      "Everything in Scholar",
      "Multi-user management",
      "Custom branding",
      "LMS integration",
      "Dedicated support",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingSection() {
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="pricing"
      className="relative py-20 lg:py-28 bg-[#07090e] border-b border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-14 sm:mb-16 space-y-3.5"
          style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 shadow-xs">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Simple, <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">Transparent</span> Pricing
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Start free. Upgrade when you need more AI power.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch pt-4">
          {PLANS.map(({ name, price, priceNote, description, badge, features, cta, popular }, i) => (
            <div
              key={name}
              className={`relative p-7 sm:p-8 rounded-2xl sm:rounded-3xl flex flex-col justify-between transition-all duration-300 ${
                popular
                  ? "bg-gradient-to-b from-[#0d1629] to-[#0b0f19] border-2 border-cyan-500/60 shadow-[0_0_40px_rgba(56,189,248,0.18)] md:-translate-y-2"
                  : "bg-[#0b0f19]/80 border border-white/[0.08] shadow-xs hover:border-cyan-500/30 hover:bg-[#0d1424]/80 hover:shadow-lg hover:-translate-y-1"
              }`}
              style={{
                opacity: 0,
                transform: popular ? "translateY(-8px)" : "translateY(16px)",
                animation: `fadeUpCard 0.5s ease ${i * 0.1 + 0.15}s forwards`,
              }}
            >
              {/* Popular badge */}
              {badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                  <Sparkles className="h-3 w-3" />
                  {badge}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1.5">
                    {name}
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{price}</div>
                  <div className="text-xs text-slate-400 mt-1">{priceNote}</div>
                  <p className="text-xs sm:text-[13px] text-slate-300 mt-3 leading-relaxed">{description}</p>
                </div>

                <Link
                  href="/login"
                  className={`block w-full text-center px-5 py-3 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    popular
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] hover:-translate-y-0.5"
                      : "bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08] hover:-translate-y-0.5"
                  }`}
                >
                  {cta}
                </Link>

                <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                  {features.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <div className="h-5 w-5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-xs sm:text-[13px] text-slate-300">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeUpCard {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
