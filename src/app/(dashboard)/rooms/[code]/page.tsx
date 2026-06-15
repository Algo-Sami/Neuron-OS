import { RoomWorkspace } from "@/components/rooms/room-workspace";
import { getRoomDetailsAction } from "@/actions/study-rooms";
import { getStudyCoachHubDataAction } from "@/actions/study-coach";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { code } = await params;
  return {
    title: `Room ${code.toUpperCase()} | Neuron Collaborative Workspace`,
    description: `Collaborative study session for invite code ${code.toUpperCase()}.`,
  };
}

export default async function RoomWorkspacePage({ params }: PageProps) {
  const { code } = await params;
  
  // Fetch details
  const res = await getRoomDetailsAction(code);
  const coachRes = await getStudyCoachHubDataAction();

  if (!res.success || !res.room || !coachRes.success || !coachRes.data) {
    redirect("/rooms?error=not_found");
  }

  return (
    <RoomWorkspace 
      initialRoom={res.room} 
      initialNotes={res.notes} 
      initialMembers={res.members || []} 
      currentUserId={res.currentUserId || ""}
      lectures={coachRes.data.lectures || []}
    />
  );
}
