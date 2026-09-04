import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata = {
  title: "Sign In — Neuron OS",
  description: "Sign in to your Neuron OS academic workspace.",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center select-none"
      style={{
        background: "#eef0f4",
        fontFamily: '"Segoe UI Variable", "Segoe UI", Inter, system-ui, sans-serif',
      }}
    >
      {/* ── Main card ─────────────────────────────────────────────────── */}
      <div
        className="w-full max-w-[960px] flex flex-col lg:flex-row overflow-hidden m-2 sm:m-4 lg:m-0 rounded-lg lg:min-h-[600px]"
        style={{
          boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          border: "1px solid #d0d4db",
        }}
      >
        {/* ══ LEFT PANEL — Academic AI image (Desktop only) ════════════ */}
        <div className="hidden lg:block relative lg:w-[44%] flex-shrink-0 overflow-hidden">
          <Image
            src="/ai-education.jpg"
            alt="AI-powered academic education — Neuron OS"
            fill
            sizes="(max-width: 1024px) 100vw, 44vw"
            className="object-cover"
            priority
          />

          {/* Overlay — subtle gradient for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,15,40,0.55) 0%, rgba(0,15,40,0.0) 40%, rgba(0,15,40,0.70) 100%)",
            }}
          />

          {/* Top — institutional logo */}
          <div className="absolute top-0 left-0 right-0 px-6 pt-6 z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center"
                style={{
                  width: 32, height: 32,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 4,
                }}
              >
                {/* Simple N icon */}
                <span
                  style={{
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 0,
                    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif',
                  }}
                >
                  N
                </span>
              </div>
              <div>
                <div
                  style={{
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif',
                  }}
                >
                  Neuron OS
                </div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9.5, letterSpacing: "0.03em" }}>
                  Academic Intelligence Platform
                </div>
              </div>
            </div>

            <Link
              href="/"
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: 400,
                textDecoration: "none",
                fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif',
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.22)",
                padding: "4px 12px",
                borderRadius: 4,
                letterSpacing: "0.02em",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "background 0.15s ease",
              }}
            >
              Back to website &rarr;
            </Link>
          </div>

          {/* Bottom — institutional tagline */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-7 z-10">
            <p
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.4,
                fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif',
                marginBottom: 6,
              }}
            >
              Your Academic<br />Intelligence Workspace
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 11.5,
                lineHeight: 1.5,
                fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif',
              }}
            >
              AI-powered study tools for serious students
            </p>

            {/* Slide indicator */}
            <div className="flex items-center gap-1.5 mt-4">
              <span style={{ height: 2, width: 20, background: "rgba(255,255,255,0.35)", borderRadius: 2, display: "inline-block" }} />
              <span style={{ height: 2, width: 20, background: "rgba(255,255,255,0.35)", borderRadius: 2, display: "inline-block" }} />
              <span style={{ height: 2, width: 28, background: "#fff", borderRadius: 2, display: "inline-block" }} />
            </div>
          </div>
        </div>

        {/* ══ RIGHT PANEL — Auth form ═══════════════════════════════════ */}
        <div
          className="flex-1 flex flex-col justify-center items-center px-6 py-6 sm:px-10 lg:px-12 bg-white lg:border-l lg:border-[#d0d4db]"
        >
          {/* Mobile brand header (shown only when left panel is hidden) */}
          <div className="flex items-center justify-between w-full max-w-[380px] mb-4 lg:hidden">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center rounded-[3px]"
                style={{
                  width: 26,
                  height: 26,
                  background: "#0078d4",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                N
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", color: "#201f1e" }}>
                NEURON OS
              </span>
            </div>
            <Link
              href="/"
              style={{
                fontSize: 11,
                color: "#0078d4",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Back to website &rarr;
            </Link>
          </div>

          <AuthCard />

          {/* Footer */}
          <p
            className="text-center mt-4 text-[10.5px] text-[#8a8f9a]"
            style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif' }}
          >
            By continuing, you agree to our{" "}
            <a href="#" style={{ color: "#0078d4", textDecoration: "underline" }}>Terms of Service</a>
            {" "}and{" "}
            <a href="#" style={{ color: "#0078d4", textDecoration: "underline" }}>Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
