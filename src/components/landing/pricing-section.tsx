"use client";

import { useRef } from "react";
import Link from "next/link";
import { Check, Sparkles, Zap } from "lucide-react";
import { gsap, useGSAP, motion, getPrefersReducedMotion } from "@/lib/motion";

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
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Accessibility guard: immediately resolve static layout for reduced motion preference
      if (getPrefersReducedMotion()) {
        gsap.set(
          [
            "[data-pricing-badge]",
            "[data-pricing-title]",
            "[data-pricing-desc]",
            "[data-pricing-card]",
            "[data-popular-badge]",
          ],
          { opacity: 1, x: 0, y: 0, scale: 1, clearProps: "all" }
        );
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          once: true,
        },
        defaults: { ease: motion.ease.standard },
        onComplete: () => {
          gsap.set("[data-pricing-card]", { clearProps: "willChange" });
        },
      });

      // 1. Header sequence
      tl.fromTo(
        "[data-pricing-badge]",
        { opacity: 0, y: 12, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: motion.ease.spring },
        0
      )
        .fromTo(
          "[data-pricing-title]",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: motion.duration.normal, ease: motion.ease.smooth },
          0.1
        )
        .fromTo(
          "[data-pricing-desc]",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.55, ease: motion.ease.smooth },
          0.2
        )

        // 2. Pricing cards staggered cascade with confident presence
        .fromTo(
          "[data-pricing-card]",
          { opacity: 0, y: 30, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.65,
            stagger: 0.1,
            ease: motion.ease.standard,
          },
          0.25
        )

        // 3. Highlighted popular badge subtle pop
        .fromTo(
          "[data-popular-badge]",
          { opacity: 0, scale: 0.8, y: -8 },
          { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: motion.ease.spring },
          0.55
        );
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative py-20 lg:py-28 bg-white border-b border-slate-200/70"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14 sm:mb-16 space-y-3.5">
          <div
            data-pricing-badge
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 shadow-xs"
          >
            <Zap className="h-3.5 w-3.5 text-cyan-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Pricing
            </span>
          </div>
          <h2
            data-pricing-title
            className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight"
          >
            Simple, <span className="text-cyan-600">Transparent</span> Pricing
          </h2>
          <p
            data-pricing-desc
            className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto"
          >
            Start free. Upgrade when you need more AI power.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch pt-4">
          {PLANS.map(({ name, price, priceNote, description, badge, features, cta, popular }) => (
            <div
              key={name}
              data-pricing-card
              className={`relative p-7 sm:p-8 rounded-3xl flex flex-col justify-between transition-all duration-300 will-change-transform ${
                popular
                  ? "bg-white border-2 border-slate-900 shadow-xl shadow-slate-900/10 md:-translate-y-2 hover:shadow-2xl"
                  : "bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-lg hover:-translate-y-1"
              }`}
            >
              {/* Popular badge */}
              {badge && (
                <div
                  data-popular-badge
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-4 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider shadow-md"
                >
                  <Sparkles className="h-3 w-3 text-cyan-400" />
                  {badge}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {name}
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    {price}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{priceNote}</div>
                  <p className="text-xs sm:text-[13px] text-slate-600 mt-3 leading-relaxed">
                    {description}
                  </p>
                </div>

                <Link
                  href="/login"
                  className={`block w-full text-center px-5 py-3 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    popular
                      ? "bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800 hover:-translate-y-0.5 active:translate-y-0"
                  }`}
                >
                  {cta}
                </Link>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  {features.map((f) => (
                    <div key={f} className="flex items-start gap-3 group">
                      <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-xs sm:text-[13px] text-slate-700">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
