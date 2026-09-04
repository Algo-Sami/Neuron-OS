"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Font stack ───────────────────────────────────────────────────────────────
const FONT = '"Segoe UI Variable", "Segoe UI", Inter, system-ui, sans-serif';

// ─── Password strength ────────────────────────────────────────────────────────
function getPasswordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

// ─── Google icon ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.66 1.48 14.97 1 12 1 7.24 1 3.2 3.73 1.24 7.72l3.82 2.96C6.01 7.26 8.78 5.04 12 5.04z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57v2.96h3.91c2.28-2.1 3.54-5.19 3.54-8.68z" />
      <path fill="#FBBC05" d="M5.06 10.68c-.25-.72-.39-1.49-.39-2.28s.14-1.56.39-2.28L1.24 7.16C.45 8.76 0 10.56 0 12.4s.45 3.64 1.24 5.24l3.82-2.96z" />
      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.91-2.96c-1.12.75-2.54 1.21-4.05 1.21-3.22 0-5.99-2.22-6.94-5.64L1.24 15.6C3.2 19.59 7.24 22.32 12 22.32z" />
    </svg>
  );
}

// ─── Apple icon ───────────────────────────────────────────────────────────────
function AppleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 400,
        color: "#323130",
        marginBottom: 4,
        fontFamily: FONT,
      }}
    >
      {children}
    </label>
  );
}

// ─── Text input ───────────────────────────────────────────────────────────────
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
}
function TextInput({ id, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width: "100%",
        height: 34,
        padding: "0 10px",
        fontSize: 13,
        fontFamily: FONT,
        color: "#201f1e",
        background: "#ffffff",
        border: focused ? "1px solid #005a9e" : "1px solid #d0d4db",
        borderRadius: 3,
        outline: "none",
        boxShadow: focused ? "0 0 0 2px rgba(0, 120, 212, 0.15)" : "none",
        boxSizing: "border-box",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    />
  );
}

// ─── Password input ───────────────────────────────────────────────────────────
function PasswordInput({
  id, value, onChange, placeholder,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          height: 34,
          padding: "0 32px 0 10px",
          fontSize: 13,
          fontFamily: FONT,
          color: "#201f1e",
          background: "#ffffff",
          border: focused ? "1px solid #005a9e" : "1px solid #d0d4db",
          borderRadius: 3,
          outline: "none",
          boxShadow: focused ? "0 0 0 2px rgba(0, 120, 212, 0.15)" : "none",
          boxSizing: "border-box",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#605e5c",
          padding: 0,
          display: "flex",
          alignItems: "center",
        }}
        aria-label="Toggle password visibility"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#e1dfdd" }} />
      <span style={{ fontSize: 11, color: "#8a8886", fontFamily: FONT, whiteSpace: "nowrap" }}>
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: "#e1dfdd" }} />
    </div>
  );
}

// ─── Primary button ───────────────────────────────────────────────────────────
function PrimaryButton({
  children, disabled, type = "submit",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        height: 32,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: FONT,
        color: "#ffffff",
        background: disabled ? "#a0aec0" : hovered ? "#106ebe" : "#0078d4",
        border: "none",
        borderRadius: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.1s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

// ─── Secondary (social) button ────────────────────────────────────────────────
function SocialButton({
  onClick, disabled, children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        width: "100%",
        height: 40,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: FONT,
        color: "#201f1e",
        background: hovered ? "#f3f2f1" : "#ffffff",
        border: "1px solid #8a8886",
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.1s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {children}
    </button>
  );
}



// ─── Main component ───────────────────────────────────────────────────────────
export function AuthCard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-reset loading state if user presses browser back button or switches tabs
  useEffect(() => {
    const handleReset = () => {
      setLoading(false);
      setSocialLoading(null);
    };

    window.addEventListener("pageshow", handleReset);
    window.addEventListener("focus", handleReset);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleReset();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handleReset);
      window.removeEventListener("focus", handleReset);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Sign In
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const signUpStrength = getPasswordStrength(signUpPassword);

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setSocialLoading("google");
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "OAuth failed.");
      setSocialLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setErrorMsg("");
    setSocialLoading("apple");
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Apple OAuth failed.");
      setSocialLoading(null);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) { setErrorMsg("Please fill in all fields."); return; }
    setErrorMsg(""); setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: signInPassword });
      if (error) { setErrorMsg(error.message); setLoading(false); }
      else { router.push("/dashboard"); router.refresh(); }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !signUpEmail || !signUpPassword) { setErrorMsg("Please fill in all required fields."); return; }
    if (signUpPassword.length < 8) { setErrorMsg("Password must be at least 8 characters."); return; }
    if (!agreedToTerms) { setErrorMsg("Please agree to the Terms & Conditions."); return; }
    setErrorMsg(""); setLoading(true);
    try {
      const { quickSignUp } = await import("@/actions/auth");
      const result = await quickSignUp(signUpEmail, signUpPassword, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });
      if (!result.success) { setErrorMsg(result.error ?? "Sign up failed."); setLoading(false); return; }
      if (result.requiresConfirmation) { setConfirmationSent(true); setLoading(false); }
      else { router.push("/dashboard"); router.refresh(); }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred.");
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 380, fontFamily: FONT }}>

      {/* Page heading */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#201f1e", margin: 0, fontFamily: FONT }}>
          {activeTab === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p style={{ fontSize: 13, color: "#605e5c", marginTop: 4, fontFamily: FONT }}>
          {activeTab === "signin"
            ? "Sign in to your Neuron OS workspace"
            : "Register for a new student workspace"}
        </p>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 6,
            background: "#fde7e9", border: "1px solid #f1707b",
            borderRadius: 2, padding: "7px 10px",
            fontSize: 12, color: "#a4262c", marginBottom: 14,
            fontFamily: FONT,
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ══ SIGN IN ══════════════════════════════════════════════════════ */}
      {activeTab === "signin" && (
        <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Google + Apple side by side */}
          <div style={{ display: "flex", gap: 8 }}>
            <SocialButton onClick={handleGoogleLogin} disabled={loading || !!socialLoading}>
              {socialLoading === "google" ? <Loader2 size={14} className="animate-spin" /> : <GoogleIcon />} Google
            </SocialButton>
            <SocialButton onClick={handleAppleLogin} disabled={loading || !!socialLoading}>
              {socialLoading === "apple" ? <Loader2 size={14} className="animate-spin" /> : <AppleIcon />} Apple
            </SocialButton>
          </div>

          <Divider text="Or sign in with email" />

          <div>
            <FieldLabel htmlFor="si-email">Email address</FieldLabel>
            <TextInput
              id="si-email" type="email" required
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              placeholder="name@university.edu"
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <FieldLabel htmlFor="si-password">Password</FieldLabel>
              <a href="#" style={{ fontSize: 11, color: "#0078d4", textDecoration: "none", fontFamily: FONT }}>
                Forgot password?
              </a>
            </div>
            <PasswordInput id="si-password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="si-remember" defaultChecked style={{ accentColor: "#0078d4", cursor: "pointer" }} />
            <label htmlFor="si-remember" style={{ fontSize: 12, color: "#323130", cursor: "pointer", fontFamily: FONT }}>
              Keep me signed in
            </label>
          </div>

          <PrimaryButton disabled={loading || !!socialLoading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Sign in"}
          </PrimaryButton>

          <p style={{ textAlign: "center", fontSize: 12, color: "#605e5c", margin: 0, fontFamily: FONT }}>
            Don&apos;t have an account?{" "}
            <button type="button" onClick={() => { setActiveTab("signup"); setErrorMsg(""); }}
              style={{ color: "#0078d4", background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: FONT }}>
              Create one
            </button>
          </p>
        </form>
      )}

      {/* ══ SIGN UP ══════════════════════════════════════════════════════ */}
      {activeTab === "signup" && (
        <div>
          {confirmationSent ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📧</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#201f1e", marginBottom: 6, fontFamily: FONT }}>
                Check your email
              </p>
              <p style={{ fontSize: 12, color: "#605e5c", lineHeight: 1.6, fontFamily: FONT }}>
                A confirmation link was sent to <strong>{signUpEmail}</strong>.
                Click it to activate your workspace.
              </p>
              <button
                type="button"
                onClick={() => { setConfirmationSent(false); setSignUpEmail(""); setSignUpPassword(""); setErrorMsg(""); }}
                style={{ marginTop: 14, fontSize: 12, color: "#0078d4", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}
              >
                ← Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Google + Apple side by side */}
              <div style={{ display: "flex", gap: 8 }}>
                <SocialButton onClick={handleGoogleLogin} disabled={loading || !!socialLoading}>
                  {socialLoading === "google" ? <Loader2 size={14} className="animate-spin" /> : <GoogleIcon />} Google
                </SocialButton>
                <SocialButton onClick={handleAppleLogin} disabled={loading || !!socialLoading}>
                  {socialLoading === "apple" ? <Loader2 size={14} className="animate-spin" /> : <AppleIcon />} Apple
                </SocialButton>
              </div>

              <Divider text="Or register with email" />

              {/* First + Last name */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel htmlFor="su-fname">First name <span style={{ color: "#a4262c" }}>*</span></FieldLabel>
                  <TextInput id="su-fname" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel htmlFor="su-lname">Last name</FieldLabel>
                  <TextInput id="su-lname" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="su-email">Email address <span style={{ color: "#a4262c" }}>*</span></FieldLabel>
                <TextInput id="su-email" type="email" required value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} placeholder="name@university.edu" />
              </div>

              <div>
                <FieldLabel htmlFor="su-password">Password <span style={{ color: "#a4262c" }}>*</span></FieldLabel>
                <PasswordInput id="su-password" value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} placeholder="Minimum 8 characters" />
                {/* Strength bar */}
                {signUpPassword.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
                    {[1, 2, 3, 4].map((bar) => (
                      <div key={bar} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: signUpStrength >= bar
                          ? signUpStrength === 4 ? "#107c10"
                          : signUpStrength >= 2 ? "#d97706"
                          : "#c50f1f"
                          : "#e1dfdd",
                        transition: "background 0.2s",
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Terms checkbox */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <input
                  type="checkbox" id="su-terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  style={{ accentColor: "#0078d4", marginTop: 2, cursor: "pointer", flexShrink: 0 }}
                />
                <label htmlFor="su-terms" style={{ fontSize: 12, color: "#323130", lineHeight: 1.5, cursor: "pointer", fontFamily: FONT }}>
                  I agree to the{" "}
                  <a href="#" style={{ color: "#0078d4", textDecoration: "underline" }}>Terms &amp; Conditions</a>
                  {" "}and{" "}
                  <a href="#" style={{ color: "#0078d4", textDecoration: "underline" }}>Privacy Policy</a>
                </label>
              </div>

              <PrimaryButton disabled={loading || !!socialLoading || signUpPassword.length < 8 || !agreedToTerms}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Create account"}
              </PrimaryButton>

              <p style={{ textAlign: "center", fontSize: 12, color: "#605e5c", margin: 0, fontFamily: FONT }}>
                Already have an account?{" "}
                <button type="button" onClick={() => { setActiveTab("signin"); setErrorMsg(""); }}
                  style={{ color: "#0078d4", background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: FONT }}>
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
