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
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-[#0A0F1C] select-none">

      {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white overflow-hidden border-r border-border/40 bg-[#0B1020]">

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 10% 20%, rgba(59,130,246,0.04) 0%, transparent 50%)" }} />

        {/* Top brand logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md"
            style={{ background: "linear-gradient(135deg, #3b82f6, #38bdf8)", boxShadow: "0 4px 12px rgba(56,189,248,0.25)" }}
          >
            <BrainCircuit className="h-4.5 w-4.5 text-white animate-pulse" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-black tracking-widest uppercase">NEURON OS</span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#38bdf8] leading-none mt-0.5">
              Academic AI
            </span>
          </div>
        </div>

        {/* Dynamic features layout */}
        <div className="my-auto space-y-8 relative z-10 max-w-md">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest text-[#38bdf8] uppercase bg-[#38bdf8]/5 border border-[#38bdf8]/10 px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3" /> System Activation
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
              An intelligent operating system for your academic brain.
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload your documents and lectures to generate structured flashcards, quizzes, and instant semantic summaries with a production-grade RAG engine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border/40 bg-[#131C31]/50 backdrop-blur-xs">
              <BookOpen className="h-5 w-5 text-[#3b82f6] mb-2" />
              <h4 className="text-xs font-bold text-foreground">Syllabus Portals</h4>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">Automatic classification of topics, files, and lectures.</p>
            </div>
            <div className="p-4 rounded-xl border border-border/40 bg-[#131C31]/50 backdrop-blur-xs">
              <Clock className="h-5 w-5 text-[#3b82f6] mb-2" />
              <h4 className="text-xs font-bold text-foreground">Reminders & Alerts</h4>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">Smart calendar generation to track assignments and quizzes.</p>
            </div>
            <div className="p-4 rounded-xl border border-border/40 bg-[#131C31]/50 backdrop-blur-xs">
              <Zap className="h-5 w-5 text-[#38bdf8] mb-2" />
              <h4 className="text-xs font-bold text-foreground">Active Recalls</h4>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">Adaptive revision feedback cycles to pinpoint weak topics.</p>
            </div>
            <div className="p-4 rounded-xl border border-border/40 bg-[#131C31]/50 backdrop-blur-xs">
              <Target className="h-5 w-5 text-[#38bdf8] mb-2" />
              <h4 className="text-xs font-bold text-foreground">Leaderboards</h4>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">Earn study streak points and progress to rank tiers.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-muted-foreground relative z-10 select-none">
          © {new Date().getFullYear()} Neuron OS Inc. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 relative bg-[#0A0F1C]">

        {/* Ambient glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)" }}
        />

        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md"
            style={{ background: "linear-gradient(135deg, #3b82f6, #38bdf8)", boxShadow: "0 4px 12px rgba(56,189,248,0.25)" }}
          >
            <BrainCircuit className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xs font-black tracking-widest text-white">NEURON OS</span>
            <span className="text-[8px] font-bold uppercase tracking-widest leading-none mt-0.5 text-[#38bdf8]">
              Academic AI
            </span>
          </div>
        </div>

        {/* Auth card */}
        <AuthCard />

        {/* Terms footer */}
        <p className="text-center text-[9px] mt-8 max-w-[280px] leading-relaxed text-muted-foreground">
          By signing up, you agree to our{" "}
          <a href="#" className="underline transition-colors hover:text-foreground text-[#3b82f6]">
            Terms of Service
          </a>
          {" "}and{" "}
          <a href="#" className="underline transition-colors hover:text-foreground text-[#3b82f6]">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
