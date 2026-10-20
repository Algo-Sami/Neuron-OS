"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardXP } from "@/services/gamification/rewards";
import { incrementWeeklyScore } from "@/services/gamification/weekly-scores";
import { logger } from "@/lib/logger";
import { routeAIRequest } from "@/services/ai/router";
import { buildQuizGenerationPrompt, QUIZ_AGENT_SYSTEM_INSTRUCTION, QUIZ_RESPONSE_SCHEMA } from "@/services/ai/agents/quiz";
import { summarizeRoomDiscussion, explainRoomTopic } from "@/services/ai/study-rooms-ai";

// Alphanumeric code generator (6 characters, uppercase for clean URLs)
function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to authenticate user
async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized user access.");
  }
  return user.id;
}

// 1. CREATE ROOM
export async function createStudyRoomAction(data: {
  name: string;
  subjectId?: string;
  topic?: string;
  maxParticipants?: number;
  description?: string;
  privacy?: string;
  scheduledTime?: string;
  aiAssistantEnabled?: boolean;
}) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);
    const code = generateInviteCode();

    // Insert room
    const { data: room, error: roomError } = await supabase
      .from("study_rooms")
      .insert({
        user_id: userId,
        name: data.name,
        subject_id: data.subjectId || null,
        topic: data.topic || "General Study",
        max_participants: data.maxParticipants || 10,
        description: data.description || "",
        privacy: data.privacy || "public",
        scheduled_time: data.scheduledTime || null,
        ai_assistant_enabled: data.aiAssistantEnabled !== undefined ? data.aiAssistantEnabled : true,
        code,
      })
      .select()
      .single();

    if (roomError) {
      logger.error("Failed to insert study room", roomError);
      throw roomError;
    }

    // Insert host in room_members
    await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
      role: "host",
    });

    // Initialize collaborative notes & whiteboard
    await supabase.from("collaborative_notes").insert({
      room_id: room.id,
      content: `# ${room.name} Study Room Notes\nWelcome to the collaborative workspace! Take dynamic notes here with your group.`,
      whiteboard_data: { shapes: [] } as unknown as Record<string, unknown>,
    });

    // Sync with host's global reminders if scheduled
    if (data.scheduledTime) {
      await supabase.from("reminders").insert({
        user_id: userId,
        subject_id: data.subjectId || null,
        title: `[Study Room] Session: ${data.name}`,
        description: `Scheduled collaborative study room session. Invite link code: ${code}.`,
        reminder_type: "generic",
        due_date: data.scheduledTime,
        extracted_from_ai: false,
        completed_status: false,
      });
    }

    return { success: true, room };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed in createStudyRoomAction", err);
    return { success: false, error: err.message };
  }
}

// 2. JOIN ROOM
export async function joinStudyRoomAction(code: string) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Find room by code
    const { data: room, error: roomError } = await supabase
      .from("study_rooms")
      .select("*, subjects(name)")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (roomError || !room) {
      throw new Error("Study Room not found. Double check invite code.");
    }

    // Add to room_members if not already there
    const { data: existingMember } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingMember) {
      // Add as standard member
      // For private rooms, the invite code was verified above on the server, so insert via admin client
      // to bypass the RLS policy that forbids raw unauthenticated/direct UUID self-joins to private rooms.
      const clientForJoin = room.privacy === "private" ? createAdminClient() : supabase;
      const { error: joinError } = await clientForJoin.from("room_members").insert({
        room_id: room.id,
        user_id: userId,
        role: "member",
      });
      if (joinError) throw joinError;

      // Sync with member's global reminders if scheduled
      if (room.scheduled_time) {
        await supabase.from("reminders").insert({
          user_id: userId,
          subject_id: room.subject_id || null,
          title: `[Study Room] Session: ${room.name}`,
          description: `Scheduled collaborative study room session. Invite link code: ${code}.`,
          reminder_type: "generic",
          due_date: room.scheduled_time,
          extracted_from_ai: false,
          completed_status: false,
        });
      }
    }

    return { success: true, room };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed in joinStudyRoomAction", err);
    return { success: false, error: err.message };
  }
}

// 3. FETCH ROOMS HUB DATA
export async function getActiveRoomsAction() {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Fetch active rooms
    const { data: rooms, error } = await supabase
      .from("study_rooms")
      .select("*, subjects(name, code, color)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Lookup host profiles from public_profiles view (safe peer visibility)
    const hostIds = Array.from(new Set(rooms?.map((r) => r.host_id))).filter(Boolean);
    const hostMap = new Map<string, { first_name?: string | null; last_name?: string | null }>();
    if (hostIds.length > 0) {
      const { data: hostProfiles } = await supabase
        .from("public_profiles")
        .select("id, first_name, last_name")
        .in("id", hostIds);
      if (hostProfiles) {
        hostProfiles.forEach((h) => hostMap.set(h.id, h));
      }
    }

    const populatedRooms = (rooms || []).map((r) => ({
      ...r,
      profiles: hostMap.get(r.host_id) || { first_name: "Host", last_name: "" },
    }));

    // Fetch rooms where current user is a member
    const { data: memberRows } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", userId);
    
    const myJoinedIds = new Set(memberRows?.map(r => r.room_id) || []);

    return { success: true, rooms: populatedRooms, myJoinedRoomIds: Array.from(myJoinedIds) };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 4. GET ROOM ACTIVE DETAILS
export async function getRoomDetailsAction(code: string) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    const { data: room, error: roomError } = await supabase
      .from("study_rooms")
      .select("*, subjects(name)")
      .eq("code", code.toUpperCase())
      .single();

    if (roomError || !room) {
      throw new Error("Room not found.");
    }

    // Load collaborative notes
    const { data: notes } = await supabase
      .from("collaborative_notes")
      .select("*")
      .eq("room_id", room.id)
      .single();

    // Fetch room active members
    const { data: members } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", room.id);

    // Lookup member profiles via public_profiles view (safe room peers)
    const memberUserIds = Array.from(new Set(members?.map((m) => m.user_id))).filter(Boolean);
    const memberProfileMap = new Map<string, { first_name?: string | null; last_name?: string | null; avatar_url?: string | null }>();
    if (memberUserIds.length > 0) {
      const { data: memberProfiles } = await supabase
        .from("public_profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", memberUserIds);
      if (memberProfiles) {
        memberProfiles.forEach((p) => memberProfileMap.set(p.id, p));
      }
    }

    const populatedMembers = (members || []).map((m) => ({
      ...m,
      profiles: memberProfileMap.get(m.user_id) || null,
    }));

    return { 
      success: true, 
      room, 
      notes: notes || null, 
      members: populatedMembers,
      currentUserId: userId 
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 5. CHAT MESSAGES LOADING & TRANSMISSION
export async function getRoomMessagesAction(roomId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    // Lookup message sender profiles via public_profiles view
    const msgUserIds = Array.from(new Set(data?.map((m) => m.user_id))).filter(Boolean);
    const msgProfileMap = new Map<string, { first_name?: string | null; last_name?: string | null; avatar_url?: string | null }>();
    if (msgUserIds.length > 0) {
      const { data: msgProfiles } = await supabase
        .from("public_profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", msgUserIds);
      if (msgProfiles) {
        msgProfiles.forEach((p) => msgProfileMap.set(p.id, p));
      }
    }

    const populatedMessages = (data || []).map((m) => ({
      ...m,
      profiles: msgProfileMap.get(m.user_id) || null,
    }));

    return { success: true, messages: populatedMessages };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

export async function sendRoomMessageAction(roomId: string, text: string) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Save message
    const { data: msg, error } = await supabase
      .from("room_messages")
      .insert({
        room_id: roomId,
        user_id: userId,
        message: text,
      })
      .select("*, profiles(first_name, last_name)")
      .single();

    if (error) throw error;

    // Parse commands: e.g. /explain deadlock or /summarize
    const isCommand = text.startsWith("/");
    if (isCommand) {
      // Execute command async
      executeRoomSlashCommand(roomId, text, userId);
    }

    return { success: true, message: msg };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to transmit room message", err);
    return { success: false, error: err.message };
  }
}

// Slash command processor (inserts a system/bot message when triggered)
async function executeRoomSlashCommand(roomId: string, text: string, senderId: string) {
  try {
    const supabase = await createClient();
    const command = text.split(" ")[0]?.toLowerCase();
    const query = text.substring(command.length).trim();

    // Attributing the requested AI command response to the invoking user (senderId)
    // without querying arbitrary third-party user profiles from the database
    const botUserId = senderId;

    if (command === "/explain") {
      if (!query) return;
      
      // Load context from collaborative notes active document
      const { data: colNotes } = await supabase
        .from("collaborative_notes")
        .select("active_lecture_id")
        .eq("room_id", roomId)
        .maybeSingle();

      let contextText = "";
      if (colNotes?.active_lecture_id) {
        const { data: sums } = await supabase
          .from("ai_summaries")
          .select("summary_text")
          .eq("document_id", colNotes.active_lecture_id)
          .maybeSingle();
        if (sums) contextText = sums.summary_text;
      }

      // Generate explain response — charge quota to the user who invoked /explain
      const explanation = await explainRoomTopic(query, contextText, senderId);

      // Insert message as AI Bot
      await supabase.from("room_messages").insert({
        room_id: roomId,
        user_id: botUserId,
        message: `🤖 [AI Concept Explainer]\nTopic: "${query}"\n\n${explanation}`,
      });
    }

    if (command === "/summarize") {
      const { data: chatHistory } = await supabase
        .from("room_messages")
        .select("message, user_id, profiles(first_name)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(20);

      const transcript = chatHistory?.map(c => {
        const profile = c.profiles as unknown as { first_name?: string } | { first_name?: string }[] | null;
        const name = Array.isArray(profile) ? profile[0]?.first_name : profile?.first_name;
        return `${name || "Member"}: ${c.message}`;
      }).join("\n") || "";

      // Generate summary — charge quota to the user who invoked /summarize
      const summaryText = await summarizeRoomDiscussion(
        transcript ? [transcript] : ["No discussion logs yet."],
        senderId
      );

      // Save summary in db
      await supabase.from("ai_meeting_summaries").insert({
        room_id: roomId,
        summary_text: summaryText,
        key_points: ["Collaborative review", "Topic debate"] as unknown as string[],
        action_items: ["Complete study quiz"] as unknown as string[],
      });

      // Insert bot message
      await supabase.from("room_messages").insert({
        room_id: roomId,
        user_id: botUserId,
        message: `🤖 [AI Meeting Summary]\n\n${summaryText}\n\n*Saved successfully under AI Assistant panel.*`,
      });
    }

    if (command === "/quiz") {
      // Trigger a room hosted quiz
      const { data: colNotes } = await supabase
        .from("collaborative_notes")
        .select("active_lecture_id")
        .eq("room_id", roomId)
        .maybeSingle();

      if (!colNotes?.active_lecture_id) {
        await supabase.from("room_messages").insert({
          room_id: roomId,
          user_id: botUserId,
          message: `🤖 [AI Quiz Master] Error: Please select an active uploaded lecture document in the workspace first!`,
        });
        return;
      }

      await hostRoomQuizAction(roomId, colNotes.active_lecture_id);
    }

  } catch (err) {
    logger.error("Failed to run room slash command", err);
  }
}

// 6. COLLABORATIVE LECTURE AND NOTES STATE BROADCASTERS
export async function saveWhiteboardDataAction(roomId: string, shapes: unknown) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("collaborative_notes")
      .update({
        whiteboard_data: { shapes } as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId);

    if (error) throw error;
    return { success: true };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

export async function saveCollaborativeNotesAction(roomId: string, content: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("collaborative_notes")
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId);

    if (error) throw error;
    return { success: true };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

export async function updateLectureSyncAction(roomId: string, lectureId: string, pageIndex: number) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("collaborative_notes")
      .update({
        active_lecture_id: lectureId || null,
        active_lecture_page: pageIndex,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId);

    if (error) throw error;
    return { success: true };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 7. COLLABORATIVE MULTIPLAYER TEAM QUIZZES
export async function hostRoomQuizAction(roomId: string, docId: string) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // 1. Fetch doc details
    const { data: doc } = await supabase
      .from("documents")
      .select("title")
      .eq("id", docId)
      .single();

    if (!doc) throw new Error("lecture file not found.");

    // Fetch summary context
    let context = doc.title;
    const { data: sums } = await supabase
      .from("ai_summaries")
      .select("summary_text")
      .eq("document_id", docId)
      .maybeSingle();
    if (sums) context += "\n" + sums.summary_text;

    // 2. Generate 5 MCQ questions via Centralized AI Request Router
    const prompt = buildQuizGenerationPrompt(context, doc.title, "medium", undefined, 5);
    const routerRes = await routeAIRequest({
      userId, // The room host starting the quiz battle bears the quota cost
      taskType: "quiz-generation",
      prompt,
      systemInstruction: QUIZ_AGENT_SYSTEM_INSTRUCTION,
      responseSchema: QUIZ_RESPONSE_SCHEMA,
      responseMimeType: "application/json",
      skipCache: true // Quiz questions should vary per battle; avoid serving cached identical questions
    });

    if (!routerRes.success) {
      throw new Error(`Failed to generate room quiz battle: ${routerRes.content}`);
    }

    let parsedQuestions: Array<{ type?: string }> = [];
    try {
      parsedQuestions = JSON.parse(routerRes.content);
    } catch {
      let cleaned = routerRes.content.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
      }
      parsedQuestions = JSON.parse(cleaned);
    }

    // Slice only the first 5 MCQ questions for fast team battles
    const battleQuestions = (Array.isArray(parsedQuestions) ? parsedQuestions : [])
      .filter((q) => q.type === "mcq")
      .slice(0, 5);

    const questionsToUse = battleQuestions.length > 0 ? battleQuestions : parsedQuestions.slice(0, 5);

    // 3. Save inside room_quizzes table
    const { data: roomQuiz, error: insertError } = await supabase
      .from("room_quizzes")
      .insert({
        room_id: roomId,
        title: `🏆 Group Battle: ${doc.title}`,
        questions: questionsToUse as unknown as Record<string, unknown>[],
        status: "in_progress",
        active_question_index: 0,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Send Alert in chat
    await supabase.from("room_messages").insert({
      room_id: roomId,
      user_id: userId,
      message: `🏆 [AI Quiz Battle Started!]\n\n"${roomQuiz.title}" has been launched! Head over to the "Quiz Battle" tab in the left panel to submit your answers and earn maximum XP points!`,
    });

    return { success: true, roomQuiz };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to host room quiz", err);
    return { success: false, error: err.message };
  }
}

export async function submitRoomQuizAnswersAction(
  roomQuizId: string,
  answers: Record<string, string>, // { qId: optionIdx }
  score: number,
  totalQuestions: number
) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Save attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("room_quiz_attempts")
      .upsert({
        room_quiz_id: roomQuizId,
        user_id: userId,
        answers: answers as unknown as Record<string, string>,
        score,
        completed_at: new Date().toISOString(),
      }, { onConflict: "room_quiz_id,user_id" })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // Award XP
    await awardXP(userId, "complete_quiz", { score, totalQuestions });

    // Phase 3: increment weekly competition score (quiz_completed)
    await incrementWeeklyScore(userId, "quiz_completed");

    return { success: true, attempt };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to submit room quiz answers", err);
    return { success: false, error: err.message };
  }
}

export async function getRoomQuizScoreboardAction(roomQuizId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("room_quiz_attempts")
      .select("*, profiles(first_name, last_name, avatar_url)")
      .eq("room_quiz_id", roomQuizId)
      .order("score", { ascending: false });

    if (error) throw error;
    return { success: true, scoreboard: data };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 8. FETCH ROOM MEETING SUMMARIES
export async function getRoomSummariesAction(roomId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_meeting_summaries")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, summaries: data };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}
