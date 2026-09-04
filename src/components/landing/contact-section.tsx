"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Mail, MapPin, Clock, Send, CheckCircle, Loader2 } from "lucide-react";

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
    badge: "Fastest",
    external: true,
  },
  {
    icon: Mail,
    title: "Email Support",
    value: "neuronosofficial@gmail.com",
    subtitle: "Response within 24 hours",
    href: "mailto:neuronosofficial@gmail.com",
    badge: null,
    external: false,
  },
  {
    icon: LinkedInIcon,
    title: "LinkedIn",
    value: "Sami Ullah Sardar",
    subtitle: "Connect professionally",
    href: "https://www.linkedin.com/in/sami-ullah-58808a356",
    badge: null,
    external: true,
  },
  {
    icon: MapPin,
    title: "Location",
    value: "Attock, Pakistan",
    subtitle: "PKT (UTC +5)",
    href: "https://maps.google.com/?q=Attock,Pakistan",
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
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const el = sectionRef.current;
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
    await new Promise((r) => setTimeout(r, 1400));
    setStatus("success");
    setFormState({ name: "", email: "", subject: "", message: "" });
  };

  const inputClass = (field: string) =>
    `w-full bg-white border rounded-[3px] px-3 py-2 text-xs text-[#201f1e] placeholder:text-[#8a8886] transition-colors focus:outline-none ${
      errors[field]
        ? "border-[#a4262c] focus:border-[#a4262c] focus:ring-2 focus:ring-[#fde7e9]"
        : "border-[#d0d4db] focus:border-[#005a9e] focus:ring-2 focus:ring-[rgba(0,120,212,0.15)] hover:border-[#a19f9d]"
    }`;

  return (
    <section
      id="contact"
      className="relative py-20 lg:py-28 bg-white border-b border-[#e1dfdd]"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
    >
      <div
        ref={sectionRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        style={{ transition: "opacity 0.6s ease, transform 0.6s ease" }}
      >
        {/* Header */}
        <div className="text-center mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-[#f8fafc] border border-[#d0d4db] shadow-xs">
            <MessageCircle className="h-3.5 w-3.5 text-[#0078d4]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0078d4]">
              Get In Touch
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#201f1e] tracking-tight">
            We&apos;re Here to <span className="text-[#0078d4]">Help</span>
          </h2>
          <p className="text-sm sm:text-base text-[#475569] max-w-xl mx-auto">
            Reach out through any channel — we respond fast. Real humans, real support.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Left: Contact cards + business info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Contact cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {CONTACT_CARDS.map(({ icon: Icon, title, value, subtitle, href, badge, external }) => (
                <a
                  key={title}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="group relative flex items-start gap-3.5 p-4 rounded-[4px] bg-[#f8fafc] border border-[#d0d4db] hover:bg-white hover:border-[#0078d4] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
                >
                  {badge && (
                    <span className="absolute top-3 right-3 text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#dff6dd] text-[#107c41] border border-[#b0e6b5]">
                      {badge}
                    </span>
                  )}
                  <div className="h-9 w-9 rounded-[3px] bg-white border border-[#d0d4db] flex items-center justify-center flex-shrink-0 text-[#0078d4] group-hover:bg-[#0078d4] group-hover:text-white transition-colors">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#605e5c] mb-0.5">
                      {title}
                    </div>
                    <div className="text-xs sm:text-[13px] font-semibold text-[#201f1e] truncate">
                      {value}
                    </div>
                    <div className="text-[11px] text-[#605e5c] mt-0.5">{subtitle}</div>
                  </div>
                </a>
              ))}
            </div>

            {/* Business info */}
            <div className="p-4 rounded-[4px] bg-[#f8fafc] border border-[#d0d4db] space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#605e5c]">
                Support Info
              </div>
              {BUSINESS_INFO.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-[2px] bg-white border border-[#d0d4db] flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3 w-3 text-[#0078d4]" />
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#605e5c]">{label}</span>
                    <span className="font-semibold text-[#201f1e] text-right">{value}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2.5 border-t border-[#e1dfdd] flex items-start gap-2">
                <span className="h-2 w-2 rounded-full bg-[#107c41] mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-[#605e5c] leading-relaxed">
                  AI support is available 24/7 inside your Neuron OS dashboard for instant answers.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Contact form */}
          <div className="lg:col-span-3">
            <div className="p-6 sm:p-7 rounded-[4px] bg-white border border-[#d0d4db] shadow-xs">
              <div className="mb-5 space-y-0.5">
                <h3 className="text-lg font-bold text-[#201f1e]">Send a Message</h3>
                <p className="text-xs text-[#605e5c]">
                  Fill out the form and we&apos;ll get back to you shortly.
                </p>
              </div>

              {status === "success" ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-12 w-12 rounded-full bg-[#dff6dd] border border-[#b0e6b5] flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-[#107c41]" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-base font-bold text-[#201f1e]">Message Sent!</div>
                    <div className="text-xs text-[#605e5c]">
                      We&apos;ll respond within 24 hours. Check your inbox.
                    </div>
                  </div>
                  <button
                    onClick={() => setStatus("idle")}
                    type="button"
                    className="mt-2 px-5 py-2 text-xs font-semibold text-[#201f1e] rounded-[3px] bg-white border border-[#d0d4db] hover:bg-[#f3f2f1] transition-colors"
                  >
                    Send Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#323130]">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Sami Ullah"
                        value={formState.name}
                        onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                        className={inputClass("name")}
                        disabled={status === "loading"}
                      />
                      {errors.name && <p className="text-[11px] text-[#a4262c]">{errors.name}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#323130]">Email Address</label>
                      <input
                        type="email"
                        placeholder="you@university.edu"
                        value={formState.email}
                        onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))}
                        className={inputClass("email")}
                        disabled={status === "loading"}
                      />
                      {errors.email && <p className="text-[11px] text-[#a4262c]">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#323130]">Subject</label>
                    <input
                      type="text"
                      placeholder="e.g. Question about AI summaries"
                      value={formState.subject}
                      onChange={(e) => setFormState((p) => ({ ...p, subject: e.target.value }))}
                      className={inputClass("subject")}
                      disabled={status === "loading"}
                    />
                    {errors.subject && <p className="text-[11px] text-[#a4262c]">{errors.subject}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#323130]">Message</label>
                    <textarea
                      rows={5}
                      placeholder="Tell us how we can help you..."
                      value={formState.message}
                      onChange={(e) => setFormState((p) => ({ ...p, message: e.target.value }))}
                      className={`${inputClass("message")} resize-none`}
                      disabled={status === "loading"}
                    />
                    {errors.message && <p className="text-[11px] text-[#a4262c]">{errors.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-[3px] text-xs font-semibold text-white bg-[#0078d4] hover:bg-[#106ebe] active:bg-[#005a9e] disabled:opacity-60 transition-colors shadow-xs"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Send Message
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-[#605e5c] pt-1">
                    For fastest response, message us on{" "}
                    <a
                      href="https://wa.me/923185005228"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#107c41] font-semibold hover:underline"
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
