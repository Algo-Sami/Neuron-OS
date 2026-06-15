import { StudyCoachHub } from "@/components/study-coach/study-coach-hub";
import { getStudyCoachHubDataAction } from "@/actions/study-coach";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Neuron Study Coach | AI Self-Study Ecosystem",
  description: "Evaluate your learning performance, adaptive quiz results, concept clarity, and exam readiness with your personal AI Coach.",
};

export default async function StudyCoachPage() {
  const result = await getStudyCoachHubDataAction();
  
  if (!result.success || !result.data) {
    redirect("/login");
  }

  return <StudyCoachHub initialData={result.data} />;
}
