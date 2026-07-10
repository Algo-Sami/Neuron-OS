"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Mail, MapPin, Clock, Send, CheckCircle, Loader2 } from "lucide-react";

// Inline LinkedIn SVG — lucide-react v1.16 doesn't export Linkedin
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const CONTACT_CARDS = [
  {
    icon: MessageCircle,
    title: "WhatsApp Support",
    value: "+92 318 500 5228",
    subtitle: "Typically replies within 1 hour",
    href: "https://wa.me/923185005228",
    color: "emerald",
    gradient: "from-emerald-500/10 to-teal-500/5",
    border: "border-emerald-500/20",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    badge: "Fastest",
    external: true,
  },
  {
    icon: Mail,
    title: "Email Support",
    value: "neuronosofficial@gmail.com",
    subtitle: "Response within 24 hours",
    href: "mailto:neuronosofficial@gmail.com",
    color: "violet",
    gradient: "from-violet-500/10 to-indigo-500/5",
    border: "border-violet-500/20",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    badge: null,
    external: false,
  },
  {
    icon: LinkedInIcon,
    title: "LinkedIn",
    value: "Sami Ullah Sardar",
    subtitle: "Connect professionally",
    href: "https://www.linkedin.com/in/sami-ullah-58808a356",
    color: "sky",
    gradient: "from-sky-500/10 to-blue-500/5",
    border: "border-sky-500/20",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
    badge: null,
    external: true,
  },
  {
    icon: MapPin,
    title: "Location",
    value: "Attock, Pakistan",
    subtitle: "PKT (UTC +5)",
    href: "https://maps.google.com/?q=Attock,Pakistan",
    color: "rose",
    gradient: "from-rose-500/10 to-pink-500/5",
    border: "border-rose-500/20",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-400",
    badge: null,
    external: true,
  },
];

const BUSINESS_INFO = [
  { icon: Clock, label: "Response Time", value: "< 1 hour via WhatsApp" },
  { icon: MessageCircle, label: "Availability", value: "Mon–Sat, 9 AM–10 PM PKT" },
  { icon: Mail, label: "Support Channel", value: "WhatsApp, Email, LinkedIn" },
];

export function ContactSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [formState, setFormState] = useState({
    name: "", email: "", subject: "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(32px)";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formState.name.trim()) e.name = "Name is required";
    if (!formState.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formState.email)) e.email = "Invalid email address";
    if (!formState.subject.trim()) e.subject = "Subject is required";
    if (!formState.message.trim()) e.message = "Message is required";
    else if (formState.message.trim().length < 20) e.message = "Message must be at least 20 characters";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setStatus("loading");
    // Simulate send — in production wire up to email API
    await new Promise((r) => setTimeout(r, 1800));
    setStatus("success");
    setFormState({ name: "", email: "", subject: "", message: "" });
  };

  const inputClass = (field: string) =>
    `w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 transition-all duration-200 ${
      errors[field]
        ? "border-red-500/50 focus:ring-red-500/20"
        : "border-white/[0.08] focus:border-violet-500/50 focus:ring-violet-500/10 hover:border-white/[0.14]"
    }`;

  return (
    <section id="contact" className="relative py-24 lg:py-32 bg-[#06060e]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(139,92,246,0.05) 0%, transparent 70%)" }}
      />

      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.8s ease, transform 0.8s ease" }}
      >
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-violet-500/20">
            <MessageCircle className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Get In Touch</span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight">
            We&apos;re Here to{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Help
            </span>
          </h2>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            Reach out through any channel — we respond fast. Real humans, real support.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left: Contact cards + business info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {CONTACT_CARDS.map(({ icon: Icon, title, value, subtitle, href, gradient, border, iconBg, iconColor, badge, external }) => (
                <a
                  key={title}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className={`group relative flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br ${gradient} border ${border} hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all duration-300`}
                >
                  {badge && (
                    <span className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                      {badge}
                    </span>
                  )}
                  <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{title}</div>
                    <div className="text-sm font-semibold text-white truncate">{value}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{subtitle}</div>
                  </div>
                </a>
              ))}
            </div>

            {/* Business info */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
              <div className="text-xs font-black uppercase tracking-widest text-neutral-500">Support Info</div>
              {BUSINESS_INFO.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-500">{label}</span>
                    <span className="text-xs font-semibold text-neutral-300 text-right">{value}</span>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-white/[0.05] flex items-start gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 mt-1 animate-pulse flex-shrink-0" />
                <p className="text-xs text-neutral-500 leading-relaxed">
                  AI support is available 24/7 inside your Neuron OS dashboard for instant answers.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Contact form */}
          <div className="lg:col-span-3">
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-sm">
              <div className="mb-6 space-y-1">
                <h3 className="text-xl font-black text-white">Send a Message</h3>
                <p className="text-sm text-neutral-500">Fill out the form and we&apos;ll get back to you shortly.</p>
              </div>

              {status === "success" ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-lg font-bold text-white">Message Sent!</div>
                    <div className="text-sm text-neutral-400">We&apos;ll respond within 24 hours. Check your inbox.</div>
                  </div>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl bg-violet-600/20 border border-violet-500/20 hover:bg-violet-600/30 transition-colors"
                  >
                    Send Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sami Ullah"
                        value={formState.name}
                        onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                        className={inputClass("name")}
                        disabled={status === "loading"}
                      />
                      {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="you@university.edu"
                        value={formState.email}
                        onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))}
                        className={inputClass("email")}
                        disabled={status === "loading"}
                      />
                      {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Subject
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Question about AI summaries"
                      value={formState.subject}
                      onChange={(e) => setFormState((p) => ({ ...p, subject: e.target.value }))}
                      className={inputClass("subject")}
                      disabled={status === "loading"}
                    />
                    {errors.subject && <p className="text-xs text-red-400">{errors.subject}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Message
                    </label>
                    <textarea
                      rows={6}
                      placeholder="Tell us how we can help you..."
                      value={formState.message}
                      onChange={(e) => setFormState((p) => ({ ...p, message: e.target.value }))}
                      className={`${inputClass("message")} resize-none`}
                      disabled={status === "loading"}
                    />
                    {errors.message && <p className="text-xs text-red-400">{errors.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-600/20 hover:shadow-violet-500/35 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-100"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-neutral-600">
                    For fastest response, message us on{" "}
                    <a
                      href="https://wa.me/923185005228"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2"
                    >
                      WhatsApp
                    </a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
