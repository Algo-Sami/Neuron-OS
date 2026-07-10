import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata = {
  title: "Neuron OS — AI-Powered Academic Operating System",
  description:
    "Upload lectures, generate AI summaries, create quizzes, track deadlines, and study smarter. Neuron OS is your AI-powered academic second brain.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated users go straight to their dashboard
  if (user) {
    redirect("/dashboard");
  }

  // Unauthenticated users see the full public landing page
  return <LandingPage />;
}
