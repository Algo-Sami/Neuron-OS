"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  School, 
  GraduationCap, 
  Calendar, 
  Globe, 
  Upload, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Eye, 
  EyeOff, 
  Sparkles,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateUsername, signUpAndOnboard } from "@/actions/auth";
import { uploadAvatar } from "@/actions/storage";
import { createClient } from "@/lib/supabase/client";

// Core Preset Interests & Goals
const INTERESTS_PRESETS = [
  "Computer Science", "Mathematics", "Physics", "Chemistry", 
  "Biology", "Literature", "History", "Business", "Psychology", "Engineering"
];

const GOALS_PRESETS = [
  "Ace My Exams 🎯", "Build a RAG Second Brain 🧠", "Improve Focus Habits ⚡", 
  "Collaborate with Classmates 🤝", "Organize Study Materials 📂"
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", 
  "France", "Pakistan", "India", "Saudi Arabia", "United Arab Emirates", "Other"
];

export function AuthCard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // PASSWORD EYE TOGGLE
  const [showPassword, setShowPassword] = useState(false);

  // SIGN IN STATES
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // SIGN UP MULTI-STEP STATES
  const [step, setStep] = useState(1);
  
  // Step 1 states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 states
  const [bio, setBio] = useState("");
  const [university, setUniversity] = useState("");
  const [degreeProgram, setDegreeProgram] = useState("");
  const [semester, setSemester] = useState("Semester 1");

  // Step 3 states
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [country, setCountry] = useState("United States");
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  })();

  // PASSWORD STRENGTH CHECKER (derived state)
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };
  const passwordStrength = getPasswordStrength(password);

  // LIVE USERNAME CHECKER
  useEffect(() => {
    if (username.length < 3) {
      const t = setTimeout(() => setUsernameStatus("idle"), 0);
      return () => clearTimeout(t);
    }

    const delayDebounceFn = setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const res = await validateUsername(username);
        if (res.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("taken");
        }
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [username]);

  // GOOGLE OAUTH
  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "OAuth redirection failed.";
      setErrorMsg(errMsg);
      setLoading(false);
    }
  };

  // SIGN IN SUBMIT
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
      const errMsg = err instanceof Error ? err.message : "Failed to sign in.";
      setErrorMsg(errMsg);
      setLoading(false);
    }
  };

  // REGISTRATION & ONBOARDING SUBMIT
  const handleOnboardingSubmit = async () => {
    setErrorMsg("");
    setLoading(true);

    try {
      // 1. Sign up the user & create their profile row
      const result = await signUpAndOnboard({
        fullName,
        username,
        email,
        password,
        bio: bio || "Academic explorer learning with Neuron OS.",
        university: university || "Neuron Academy",
        degreeProgram: degreeProgram || "Computer Science",
        semester,
        profileImage: null, // we will upload next
        interests: selectedInterests,
        studyGoals: selectedGoals,
        country,
        timezone,
      });

      if (!result.success) {
        setErrorMsg(result.error || "Onboarding failed.");
        setLoading(false);
        return;
      }

      // 2. If there's a profile picture to upload, log the user in or upload it
      if (avatarBase64) {
        // Wait briefly for trigger/session to sync, then upload avatar
        try {
          const uploadRes = await uploadAvatar(avatarBase64, `avatar_${username}.png`);
          if (!uploadRes.success) {
            console.warn("Avatar upload encountered an error but registration finished:", uploadRes.error);
          }
        } catch (uploadErr) {
          console.error("Avatar upload exception:", uploadErr);
        }
      }

      // 3. Finalize and redirect to Dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "An error occurred during onboarding.";
      setErrorMsg(errMsg);
      setLoading(false);
    }
  };

  // IMAGE FILE TO BASE64
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Profile photo must be less than 5MB.");
      return;
    }

    setErrorMsg("");
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // MULTI-STEP NAVIGATION VALIDATORS
  const canGoToStep2 = () => {
    return (
      fullName.trim().length > 0 &&
      username.trim().length >= 3 &&
      usernameStatus === "available" &&
      email.includes("@") &&
      password.length >= 8 &&
      password === confirmPassword
    );
  };

  const canGoToStep3 = () => {
    return university.trim().length > 0 && degreeProgram.trim().length > 0;
  };

  // HELPER INTERACTIVE TOGGLES
  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter(g => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-card border border-border/80 shadow-2xl rounded-xl relative select-none">
      
      {/* TABS SELECTOR */}
      <div className="flex bg-[#0A0F1C] p-1 rounded-lg mb-6 border border-border/60">
        <button
          onClick={() => {
            setActiveTab("signin");
            setErrorMsg("");
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
            activeTab === "signin" 
              ? "bg-[#131C31] text-foreground border border-border/40 shadow-3xs" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setActiveTab("signup");
            setErrorMsg("");
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
            activeTab === "signup" 
              ? "bg-[#131C31] text-foreground border border-border/40 shadow-3xs" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Create Account
        </button>
      </div>

      {/* ERROR MSG BANNER */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-2.5 bg-destructive/5 border border-destructive/10 text-destructive text-xs rounded-lg mb-4 animate-in fade-in duration-150">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ==================== SIGN IN FLOW ==================== */}
      {activeTab === "signin" && (
        <form onSubmit={handleSignInSubmit} className="space-y-4">
          <div className="text-center space-y-1 mb-6">
            <h2 className="text-sm font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-xs text-muted-foreground">Sign in to your academic workspace</p>
          </div>

          <div className="space-y-1 text-left">
            <Label htmlFor="signin-email" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="signin-email"
                type="email"
                placeholder="name@university.edu"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
                className="h-9 text-xs pl-9 rounded-lg bg-background border-border/80 placeholder:text-muted-foreground/30 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-1 text-left">
            <div className="flex justify-between items-center">
              <Label htmlFor="signin-password" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Password</Label>
              <a href="#" className="text-[9px] font-bold text-[#3b82f6] hover:underline">Forgot password?</a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
                className="h-9 text-xs pl-9 pr-9 rounded-lg bg-background border-border/80 focus-visible:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground/50 hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              className="h-3.5 w-3.5 rounded border-border bg-background accent-primary cursor-pointer"
            />
            <label htmlFor="remember-me" className="text-[11px] font-semibold text-muted-foreground cursor-pointer">
              Remember me
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-9 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground mt-2 gap-1.5 shadow-2xs cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>

          {/* DIVIDER */}
          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <span className="relative bg-card px-3 text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
              Or continue with
            </span>
          </div>

          {/* GOOGLE LOGIN */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-9 text-xs font-semibold rounded-lg border-border/80 bg-background hover:bg-muted/40 gap-2 shadow-3xs cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.66 1.48 14.97 1 12 1 7.24 1 3.2 3.73 1.24 7.72l3.82 2.96C6.01 7.26 8.78 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57v2.96h3.91c2.28-2.1 3.54-5.19 3.54-8.68z"
              />
              <path
                fill="#FBBC05"
                d="M5.06 10.68c-.25-.72-.39-1.49-.39-2.28s.14-1.56.39-2.28L1.24 7.16C.45 8.76 0 10.56 0 12.4s.45 3.64 1.24 5.24l3.82-2.96z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.91-2.96c-1.12.75-2.54 1.21-4.05 1.21-3.22 0-5.99-2.22-6.94-5.64L1.24 15.6C3.2 19.59 7.24 22.32 12 22.32z"
              />
            </svg>
            Google
          </Button>
        </form>
      )}

      {/* ==================== SIGN UP FLOW ==================== */}
      {activeTab === "signup" && (
        <div className="space-y-4">
          
          {/* Header Indicators */}
          <div className="flex justify-between items-center mb-4 select-none">
            <span className="text-[9px] font-bold uppercase text-[#38bdf8] tracking-widest">
              Step {step} of 3
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s} 
                  className={`h-1 rounded-full transition-all duration-300 ${
                    s === step ? "w-5 bg-primary" : "w-1.5 bg-border"
                  }`} 
                />
              ))}
            </div>
          </div>

          {/* ==================== SIGN UP STEP 1: Account credentials ==================== */}
          {step === 1 && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="text-center space-y-1 mb-3">
                <h3 className="text-xs font-bold tracking-tight text-foreground">Create Academic Profile</h3>
                <p className="text-[11px] text-muted-foreground">Setup your credentials and unique identity</p>
              </div>

              {/* Full Name */}
              <div className="space-y-1 text-left">
                <Label htmlFor="fullname" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="Marie Curie"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 rounded-lg bg-background border-border/80"
                  />
                </div>
              </div>

              {/* Username (live validation) */}
              <div className="space-y-1 text-left">
                <div className="flex justify-between items-center">
                  <Label htmlFor="username" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Username</Label>
                  {usernameStatus === "checking" && <span className="text-[8px] text-muted-foreground flex items-center gap-0.5"><Loader2 className="h-2 w-2 animate-spin" /> Verifying</span>}
                  {usernameStatus === "available" && <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5"><Check className="h-2 w-2" /> Available</span>}
                  {usernameStatus === "taken" && <span className="text-[8px] text-destructive font-bold">Taken</span>}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground/50 select-none">@</span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="marie_curie"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    required
                    className="h-9 text-xs pl-7 rounded-lg bg-background border-border/80"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1 text-left">
                <Label htmlFor="email" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="marie@stanford.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 rounded-lg bg-background border-border/80"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1 text-left">
                <Label htmlFor="password" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Password (min. 8 chars)</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 pr-9 rounded-lg bg-background border-border/80"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground/50 hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password strength meter */}
                {password.length > 0 && (
                  <div className="space-y-1 mt-1">
                    <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase">
                      <span>Strength</span>
                      <span className={passwordStrength === 4 ? "text-emerald-500 font-bold" : passwordStrength >= 2 ? "text-yellow-500 font-bold" : "text-destructive font-bold"}>
                        {passwordStrength === 4 ? "Strong 🔥" : passwordStrength >= 2 ? "Medium ⚡" : "Weak ⚠️"}
                      </span>
                    </div>
                    <div className="flex gap-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                      {[1, 2, 3, 4].map((bar) => (
                        <div 
                          key={bar} 
                          className={`flex-1 h-full rounded-full transition-all duration-300 ${
                            passwordStrength >= bar 
                              ? passwordStrength === 4 ? "bg-emerald-500" : passwordStrength >= 2 ? "bg-yellow-500" : "bg-destructive" 
                              : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1 text-left">
                <div className="flex justify-between items-center">
                  <Label htmlFor="confirmPassword" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                  {confirmPassword.length > 0 && password === confirmPassword && <span className="text-[8px] text-emerald-500 font-bold">Passwords Match</span>}
                  {confirmPassword.length > 0 && password !== confirmPassword && <span className="text-[8px] text-destructive font-bold">Mismatch</span>}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 rounded-lg bg-background border-border/80"
                  />
                </div>
              </div>

              {/* Next button */}
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canGoToStep2()}
                className="w-full h-9 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground mt-4 gap-1.5 shadow-2xs cursor-pointer"
              >
                Onboarding Details <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* ==================== SIGN UP STEP 2: Scholarly details ==================== */}
          {step === 2 && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="text-center space-y-1 mb-3">
                <h3 className="text-xs font-bold tracking-tight text-foreground">Academic Identity</h3>
                <p className="text-[11px] text-muted-foreground">Tell us about your studies and interests</p>
              </div>

              {/* University */}
              <div className="space-y-1 text-left">
                <Label htmlFor="university" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">University / Institution</Label>
                <div className="relative">
                  <School className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="university"
                    type="text"
                    placeholder="Stanford University"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 rounded-lg bg-background border-border/80"
                  />
                </div>
              </div>

              {/* Degree Program */}
              <div className="space-y-1 text-left">
                <Label htmlFor="degree" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Degree Program / Major</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="degree"
                    type="text"
                    placeholder="B.Sc. Computer Science"
                    value={degreeProgram}
                    onChange={(e) => setDegreeProgram(e.target.value)}
                    required
                    className="h-9 text-xs pl-9 rounded-lg bg-background border-border/80"
                  />
                </div>
              </div>

              {/* Semester Select */}
              <div className="space-y-1 text-left">
                <Label htmlFor="semester" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Current Semester</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <select
                    id="semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-border/80 bg-background px-3 py-1 text-xs outline-none pl-9 cursor-pointer"
                  >
                    {[1,2,3,4,5,6,7,8].map((s) => (
                      <option key={s} value={`Semester ${s}`} className="bg-card text-foreground">Semester {s}</option>
                    ))}
                    <option value="Graduate / Finished" className="bg-card text-foreground">Graduate / Finished</option>
                  </select>
                </div>
              </div>

              {/* Bio/About */}
              <div className="space-y-1 text-left">
                <Label htmlFor="bio" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Bio / About Yourself (Optional)</Label>
                <textarea
                  id="bio"
                  placeholder="I am passionate about learning..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs outline-none resize-none focus:border-primary"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 h-9 text-xs font-semibold rounded-lg border-border/85 bg-background hover:bg-muted/40 gap-1.5 cursor-pointer text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canGoToStep3()}
                  className="flex-1 h-9 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground gap-1.5 cursor-pointer shadow-2xs"
                >
                  Personalize <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ==================== SIGN UP STEP 3: Personalization & image upload ==================== */}
          {step === 3 && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="text-center space-y-1 mb-2">
                <h3 className="text-xs font-bold tracking-tight text-foreground">Personalize Neuron</h3>
                <p className="text-[11px] text-muted-foreground">Upload profile photo and select study priorities</p>
              </div>

              {/* Profile image upload with base64 preview */}
              <div className="flex items-center gap-3.5 p-3 bg-muted/20 border border-border/60 rounded-xl">
                <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-border/80 bg-background shrink-0 flex items-center justify-center">
                  {avatarBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarBase64} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="h-5 w-5 text-muted-foreground/60" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <Label htmlFor="avatar-file" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Profile Picture</Label>
                  <label 
                    htmlFor="avatar-file" 
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3b82f6] hover:underline cursor-pointer"
                  >
                    <Upload className="h-3 w-3" /> Choose Image file
                  </label>
                  <input
                    id="avatar-file"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <span className="text-[8px] text-muted-foreground block">JPEG, PNG up to 5MB</span>
                </div>
              </div>

              {/* Country select */}
              <div className="space-y-1 text-left">
                <Label htmlFor="country" className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Country</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-border/80 bg-background px-3 py-1 text-xs outline-none pl-9 cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} className="bg-card text-foreground">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interests multi-selection */}
              <div className="space-y-1.5 text-left">
                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Core Academic Interests</Label>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                  {INTERESTS_PRESETS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-primary/10 border-primary/45 text-foreground"
                            : "bg-muted/30 border-border/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Study Goals multi-selection */}
              <div className="space-y-1.5 text-left">
                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Key Study Goals</Label>
                <div className="flex flex-wrap gap-1">
                  {GOALS_PRESETS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => toggleGoal(goal)}
                        className={`text-[9px] font-bold px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-primary/10 border-primary/45 text-foreground animate-pulse"
                            : "bg-muted/30 border-border/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {goal}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="flex-1 h-9 text-xs font-semibold rounded-lg border-border/85 bg-background hover:bg-muted/45 gap-1.5 cursor-pointer text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={handleOnboardingSubmit}
                  disabled={loading}
                  className="flex-1 h-9 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground gap-1.5 shadow-2xs cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      Complete Setup <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
