"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

// ─── Password strength helper ────────────────────────────────────────────────
function getPasswordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

// ─── Google SVG logo ─────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.66 1.48 14.97 1 12 1 7.24 1 3.2 3.73 1.24 7.72l3.82 2.96C6.01 7.26 8.78 5.04 12 5.04z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57v2.96h3.91c2.28-2.1 3.54-5.19 3.54-8.68z" />
      <path fill="#FBBC05" d="M5.06 10.68c-.25-.72-.39-1.49-.39-2.28s.14-1.56.39-2.28L1.24 7.16C.45 8.76 0 10.56 0 12.4s.45 3.64 1.24 5.24l3.82-2.96z" />
      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.91-2.96c-1.12.75-2.54 1.21-4.05 1.21-3.22 0-5.99-2.22-6.94-5.64L1.24 15.6C3.2 19.59 7.24 22.32 12 22.32z" />
    </svg>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div className="relative flex items-center justify-center my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-slate-200" />
      </div>
      <span className="relative bg-white px-3 text-[9px] font-bold uppercase text-slate-400 tracking-widest">
        Or continue with
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AuthCard() {
  const router = useRouter();

  // ── Shared state ──
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Sign In state ──
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // ── Sign Up state ──
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const signUpStrength = getPasswordStrength(signUpPassword);

  // ── Google OAuth (shared between sign-in and sign-up tabs) ──
  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "OAuth redirection failed.");
      setLoading(false);
    }
  };

  // ── Sign In submit ──
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to sign in.");
      setLoading(false);
    }
  };

  // ── Quick Sign Up submit ──
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpEmail || !signUpPassword) {
      setErrorMsg("Please enter your email and a password.");
      return;
    }
    if (signUpPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      // Dynamically import to avoid bundling server-only imports on the client
      const { quickSignUp } = await import("@/actions/auth");
      const result = await quickSignUp(signUpEmail, signUpPassword);

      if (!result.success) {
        setErrorMsg(result.error ?? "Sign up failed. Please try again.");
        setLoading(false);
        return;
      }

      if (result.requiresConfirmation) {
        // Email confirmation is enabled in Supabase.
        // The user has no active session yet — do NOT redirect to /dashboard.
        setConfirmationSent(true);
        setLoading(false);
      } else {
        // No confirmation required — active session exists, go straight to dashboard.
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white border border-slate-200 shadow-[0_20px_60px_rgba(0,0,0,0.15)] rounded-3xl relative select-none">

      {/* ── Tab Switcher ── */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
        {(["signin", "signup"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setErrorMsg("");
              if (tab === "signup") setConfirmationSent(false);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === tab
                ? "bg-[#0F172A] text-white shadow-sm"
                : "text-[#64748B] hover:text-slate-700"
            }`}
          >
            {tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      {/* ── Error Banner ── */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl mb-4 animate-in fade-in duration-150">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SIGN IN TAB — untouched from original
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "signin" && (
        <form onSubmit={handleSignInSubmit} className="space-y-4">
          <div className="text-center space-y-1 mb-6">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="text-xs text-slate-500">Sign in to your academic workspace</p>
          </div>

          {/* Email */}
          <div className="space-y-1 text-left">
            <Label htmlFor="signin-email" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="signin-email"
                type="email"
                placeholder="name@university.edu"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
                className="h-9 text-xs pl-9 rounded-lg bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#38BDF8]/30"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1 text-left">
            <div className="flex justify-between items-center">
              <Label htmlFor="signin-password" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Password
              </Label>
              <a href="#" className="text-[9px] font-bold text-[#0EA5E9] hover:underline">Forgot password?</a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="signin-password"
                type={showSignInPassword ? "text" : "password"}
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
                className="h-9 text-xs pl-9 pr-9 rounded-lg bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-[#38BDF8]/30"
              />
              <button
                type="button"
                onClick={() => setShowSignInPassword(!showSignInPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2 pt-1 select-none">
            <input
              type="checkbox"
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 bg-white accent-[#0F172A] cursor-pointer"
            />
            <label htmlFor="remember-me" className="text-[11px] font-semibold text-slate-500 cursor-pointer">
              Remember me
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-9 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white mt-2 gap-1.5 shadow-sm cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>

          <OrDivider />

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-9 text-xs font-semibold rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 gap-2 shadow-sm cursor-pointer"
          >
            <GoogleIcon /> Google
          </Button>
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SIGN UP TAB — simplified: email + password only
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "signup" && (
        <div className="animate-in fade-in duration-150">

          {/* ── Email confirmation sent state ── */}
          {confirmationSent ? (
            <div className="text-center space-y-5 py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-[#38BDF8]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900">Check your inbox</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                  We sent a confirmation link to{" "}
                  <span className="font-semibold text-slate-700">{signUpEmail}</span>.
                  {" "}Click it to activate your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmationSent(false);
                  setSignUpEmail("");
                  setSignUpPassword("");
                  setErrorMsg("");
                }}
                className="text-[11px] font-bold text-[#0EA5E9] hover:underline cursor-pointer"
              >
                ← Use a different email
              </button>
            </div>
          ) : (
            /* ── Normal quick-signup form ── */
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <div className="text-center space-y-1 mb-4">
                <h3 className="text-sm font-bold tracking-tight text-slate-900">Create your account</h3>
                <p className="text-[11px] text-slate-500">
                  Just your email and a password —{" "}
                  <span className="text-[#0EA5E9] font-semibold">complete your profile later</span>
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1 text-left">
                <Label htmlFor="signup-email" className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="name@university.edu"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 rounded-lg bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#38BDF8]/30"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1 text-left">
                <Label htmlFor="signup-password" className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  Password (min. 8 characters)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="signup-password"
                    type={showSignUpPassword ? "text" : "password"}
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 pr-9 rounded-lg bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-[#38BDF8]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password strength meter */}
                {signUpPassword.length > 0 && (
                  <div className="space-y-1 mt-1.5">
                    <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase">
                      <span>Strength</span>
                      <span className={
                        signUpStrength === 4 ? "text-emerald-600"
                        : signUpStrength >= 2 ? "text-amber-500"
                        : "text-red-500"
                      }>
                        {signUpStrength === 4 ? "Strong 🔥" : signUpStrength >= 2 ? "Medium ⚡" : "Weak ⚠️"}
                      </span>
                    </div>
                    <div className="flex gap-1 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={`flex-1 h-full rounded-full transition-all duration-300 ${
                            signUpStrength >= bar
                              ? signUpStrength === 4 ? "bg-emerald-500"
                                : signUpStrength >= 2 ? "bg-amber-500"
                                : "bg-red-500"
                              : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                id="signup-submit-btn"
                disabled={loading || signUpPassword.length < 8}
                className="w-full h-9 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white mt-2 gap-1.5 shadow-sm cursor-pointer disabled:opacity-40"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Sparkles className="h-3.5 w-3.5" /> Create Account</>
                }
              </Button>

              <OrDivider />

              {/* Google Sign Up */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-9 text-xs font-semibold rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 gap-2 shadow-sm cursor-pointer"
              >
                <GoogleIcon /> Continue with Google
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
