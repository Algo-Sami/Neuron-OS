import { redirect } from "next/navigation";
import { BrainCircuit, Sparkles, BookOpen, Clock, Zap, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata = {
  title: "Authenticate Workspace - Neuron OS",
  description: "Sign in or create a custom student account to access your AI academic second brain and track study streaking progress.",
};

export default async function LoginPage() {

  // 1. Safe Redirect: If the user is already authenticated, send them straight to the dashboard!
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-[#020817] select-none">

      {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white overflow-hidden border-r border-[#334155]/60 bg-[#0F172A]">

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.05) 0%, transparent 55%)" }} />

        {/* Top brand logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md"
            style={{ background: "linear-gradient(135deg, #3b82f6, #38bdf8)", boxShadow: "0 4px 12px rgba(56,189,248,0.30)" }}
          >
            <BrainCircuit className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-black tracking-widest uppercase text-[#F8FAFC]">NEURON OS</span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#38BDF8] leading-none mt-0.5">
              Academic AI
            </span>
          </div>
        </div>

        {/* Dynamic features layout */}
        <div className="my-auto space-y-8 relative z-10 max-w-md">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-[#38BDF8] uppercase bg-[#38BDF8]/8 border border-[#38BDF8]/15 px-2.5 py-1 rounded-full">
              <Sparkles className="h-3 w-3" /> System Activation
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-[#F8FAFC] leading-tight">
              An intelligent operating system for your academic brain.
            </h2>
            <p className="text-sm text-[#CBD5E1] leading-relaxed">
              Upload your documents and lectures to generate structured flashcards, quizzes, and instant semantic summaries with a production-grade RAG engine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Card 1 */}
            <div className="p-4 rounded-xl border border-[rgba(148,163,184,0.15)] bg-[rgba(15,23,42,0.60)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(148,163,184,0.25)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <BookOpen className="h-5 w-5 text-[#38BDF8] mb-2.5" />
              <h4 className="text-sm font-semibold text-[#F1F5F9]">Syllabus Portals</h4>
              <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">Automatic classification of topics, files, and lectures.</p>
            </div>
            {/* Card 2 */}
            <div className="p-4 rounded-xl border border-[rgba(148,163,184,0.15)] bg-[rgba(15,23,42,0.60)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(148,163,184,0.25)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <Clock className="h-5 w-5 text-[#38BDF8] mb-2.5" />
              <h4 className="text-sm font-semibold text-[#F1F5F9]">Reminders &amp; Alerts</h4>
              <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">Smart calendar generation to track assignments and quizzes.</p>
            </div>
            {/* Card 3 */}
            <div className="p-4 rounded-xl border border-[rgba(148,163,184,0.15)] bg-[rgba(15,23,42,0.60)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(148,163,184,0.25)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <Zap className="h-5 w-5 text-[#38BDF8] mb-2.5" />
              <h4 className="text-sm font-semibold text-[#F1F5F9]">Active Recalls</h4>
              <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">Adaptive revision feedback cycles to pinpoint weak topics.</p>
            </div>
            {/* Card 4 */}
            <div className="p-4 rounded-xl border border-[rgba(148,163,184,0.15)] bg-[rgba(15,23,42,0.60)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(148,163,184,0.25)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <Target className="h-5 w-5 text-[#38BDF8] mb-2.5" />
              <h4 className="text-sm font-semibold text-[#F1F5F9]">Leaderboards</h4>
              <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">Earn study streak points and progress to rank tiers.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-[#64748B] relative z-10 select-none">
          © {new Date().getFullYear()} Neuron OS Inc. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 relative bg-[#020817]">

        {/* Ambient glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.04) 0%, transparent 70%)" }}
        />

        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md"
            style={{ background: "linear-gradient(135deg, #3b82f6, #38bdf8)", boxShadow: "0 4px 12px rgba(56,189,248,0.30)" }}
          >
            <BrainCircuit className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-black tracking-widest text-white">NEURON OS</span>
            <span className="text-[8px] font-bold uppercase tracking-widest leading-none mt-0.5 text-[#38BDF8]">
              Academic AI
            </span>
          </div>
        </div>

        {/* Auth card */}
        <AuthCard />

        {/* Terms footer */}
        <p className="text-center text-[9px] mt-8 max-w-[280px] leading-relaxed text-[#64748B]">
          By signing up, you agree to our{" "}
          <a href="#" className="underline transition-colors hover:text-[#CBD5E1] text-[#94A3B8]">
            Terms of Service
          </a>
          {" "}and{" "}
          <a href="#" className="underline transition-colors hover:text-[#CBD5E1] text-[#94A3B8]">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
