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
      className="relative py-20 lg:py-28 bg-[#f8fafc] border-b border-[#e1dfdd]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          ref={titleRef}
          className="text-center mb-14 space-y-3"
          style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-white border border-[#d0d4db] shadow-xs">
            <Zap className="h-3.5 w-3.5 text-[#0078d4]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#201f1e] tracking-tight">
            Simple, <span className="text-[#0078d4]">Transparent</span> Pricing
          </h2>
          <p className="text-sm sm:text-base text-[#475569] max-w-xl mx-auto">
            Start free. Upgrade when you need more AI power.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map(({ name, price, priceNote, description, badge, features, cta, popular }, i) => (
            <div
              key={name}
              className={`relative p-6 rounded-[4px] flex flex-col justify-between transition-all duration-150 ${
                popular
                  ? "bg-[#f0f6ff] border-2 border-[#0078d4] shadow-sm"
                  : "bg-white border border-[#d0d4db] hover:border-[#0078d4] hover:shadow-sm"
              }`}
              style={{
                opacity: 0,
                transform: "translateY(16px)",
                animation: `fadeUpCard 0.5s ease ${i * 0.1 + 0.15}s forwards`,
              }}
            >
              {/* Popular badge */}
              {badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-0.5 rounded-[2px] bg-[#0078d4] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                  <Sparkles className="h-2.5 w-2.5" />
                  {badge}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#605e5c] mb-1.5">
                    {name}
                  </div>
                  <div className="text-3xl font-bold text-[#201f1e] tracking-tight">{price}</div>
                  <div className="text-xs text-[#605e5c] mt-0.5">{priceNote}</div>
                  <p className="text-xs text-[#475569] mt-2.5 leading-relaxed">{description}</p>
                </div>

                <Link
                  href="/login"
                  className={`block w-full text-center px-4 py-2 rounded-[3px] text-xs font-semibold transition-colors ${
                    popular
                      ? "bg-[#0078d4] hover:bg-[#106ebe] text-white shadow-xs"
                      : "bg-white border border-[#d0d4db] hover:bg-[#f3f2f1] text-[#201f1e]"
                  }`}
                >
                  {cta}
                </Link>

                <div className="space-y-2.5 pt-2 border-t border-[#e1dfdd]">
                  {features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <Check className="h-3.5 w-3.5 text-[#107c41] flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-[#323130]">{f}</span>
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
