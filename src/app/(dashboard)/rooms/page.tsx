import { RoomsHub } from "@/components/rooms/rooms-hub";
import { getActiveRoomsAction } from "@/actions/study-rooms";
import { getStudyCoachHubDataAction } from "@/actions/study-coach";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Neuron Study Rooms | AI Collaboration Workspace",
  description: "Join or schedule real-time study rooms to video call, screen share, draw, and solve multiplayer active quizzes.",
};

export default async function RoomsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const roomsRes = await getActiveRoomsAction();
  const coachRes = await getStudyCoachHubDataAction();

  if (!roomsRes.success || !coachRes.success || !roomsRes.rooms || !coachRes.data) {
    const errorMsg = roomsRes.error || coachRes.error || "Missing tables";
    if (errorMsg.includes("public.study_rooms") || errorMsg.includes("relation \"study_rooms\" does not exist")) {
      redirect("/dashboard?error=study_rooms_migration_missing");
    }
    redirect(`/dashboard?error=${encodeURIComponent(errorMsg)}`);
  }

  return (
    <RoomsHub 
      initialRooms={roomsRes.rooms} 
      myJoinedRoomIds={roomsRes.myJoinedRoomIds || []} 
      subjects={coachRes.data.subjects} 
    />
  );
}
