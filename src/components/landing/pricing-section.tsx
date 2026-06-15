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
    color: "border-white/[0.08]",
    badge: null,
    features: [
      "5 file uploads per month",
      "AI summaries (5/month)",
      "Quiz generation (5/month)",
      "Basic deadline extraction",
      "AI chat (20 messages/month)",
      "1 subject workspace",
    ],
    cta: "Get Started Free",
    ctaStyle: "border border-white/10 hover:bg-white/[0.04] text-neutral-300 hover:text-white",
    popular: false,
  },
  {
    name: "Scholar",
    price: "Coming Soon",
    priceNote: "Early access",
    description: "Full AI power for serious academic performance.",
    color: "border-violet-500/40",
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
    ctaStyle: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/25",
    popular: true,
  },
  {
    name: "Institution",
    price: "Custom",
    priceNote: "Contact us",
    description: "For universities and academic institutions.",
    color: "border-white/[0.08]",
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
    ctaStyle: "border border-white/10 hover:bg-white/[0.04] text-neutral-300 hover:text-white",
    popular: false,
  },
];

export function PricingSection() {
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
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
    <section id="pricing" className="relative py-24 lg:py-32 bg-[#080810]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.05) 0%, transparent 70%)" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-16 space-y-4"
          style={{ transition: "opacity 0.7s ease, transform 0.7s ease" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/20 mb-2">
            <Zap className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Pricing</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
            Simple,{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Transparent
            </span>{" "}
            Pricing
          </h2>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            Start free. Upgrade when you need more AI power.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map(({ name, price, priceNote, description, color, badge, features, cta, ctaStyle, popular }, i) => (
            <div
              key={name}
              className={`relative p-8 rounded-2xl border ${color} ${popular ? "bg-gradient-to-b from-violet-500/[0.08] to-indigo-500/[0.04]" : "bg-white/[0.02]"} 
                transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/30`}
              style={{
                opacity: 0,
                transform: "translateY(24px)",
                animation: `fadeUpCard 0.7s ease ${i * 0.15 + 0.2}s forwards`,
              }}
            >
              {/* Popular badge */}
              {badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-violet-600 text-white text-xs font-black uppercase tracking-wide shadow-lg shadow-violet-600/30">
                  <Sparkles className="h-3 w-3" />
                  {badge}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">{name}</div>
                  <div className="text-3xl font-black text-white">{price}</div>
                  <div className="text-sm text-neutral-500 mt-1">{priceNote}</div>
                  <p className="text-sm text-neutral-400 mt-3 leading-relaxed">{description}</p>
                </div>

                <Link
                  href="/login"
                  className={`block w-full text-center px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${ctaStyle}`}
                >
                  {cta}
                </Link>

                <div className="space-y-3">
                  {features.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-neutral-400">{f}</span>
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
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
