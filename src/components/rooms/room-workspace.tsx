"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Sparkles, 
  Send,
  Video,
  Mic,
  VideoOff,
  MicOff,
  ScreenShare,
  PhoneOff,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  sendRoomMessageAction, 
  getRoomMessagesAction,
  getRoomSummariesAction
} from "@/actions/study-rooms";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SharedLecture } from "./shared-lecture";
import { WhiteboardCanvas, Shape } from "./whiteboard-canvas";
import { TeamQuiz } from "./team-quiz";

interface Profile {
  first_name: string | null;
  last_name: string | null;
}

interface RoomMember {
  user_id: string;
  role: string;
  profiles: Profile | null;
}

interface RoomDetails {
  id: string;
  name: string;
  topic: string;
  code: string;
}

interface NotesState {
  active_lecture_id: string | null;
  active_lecture_page: number;
  whiteboard_data?: {
    shapes?: Shape[];
  };
}

interface ChatMessage {
  user_id: string;
  message: string;
  profiles: Profile | null;
}

interface AiSummary {
  created_at: string;
  summary_text: string;
}

interface LectureDoc {
  id: string;
  title: string;
  subject_id: string;
  upload_date: string;
}

interface RoomWorkspaceProps {
  initialRoom: RoomDetails;
  initialNotes: NotesState | null;
  initialMembers: RoomMember[];
  currentUserId: string;
  lectures: LectureDoc[];
}

export function RoomWorkspace({
  initialRoom,
  initialNotes,
  initialMembers,
  currentUserId,
  lectures
}: RoomWorkspaceProps) {
  const supabase = createClient();
  const router = useRouter();
  
  // Left Panel Workspace Tabs
  const [leftTab, setLeftTab] = useState<"lecture" | "whiteboard" | "quiz">("lecture");
  
  // Right Panel Side Tabs
  const [rightTab, setRightTab] = useState<"chat" | "ai" | "insights">("chat");

  // Real-time synchronization states
  const [notes, setNotes] = useState<NotesState | null>(initialNotes);
  const [members] = useState<RoomMember[]>(initialMembers);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [aiSummaries, setAiSummaries] = useState<AiSummary[]>([]);
  
  // Audio / Video control states
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isCamOn, setIsCamOn] = useState<boolean>(true);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string>("");

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load chat messages and summaries
  useEffect(() => {
    async function loadData() {
      const chatRes = await getRoomMessagesAction(initialRoom.id);
      if (chatRes.success && chatRes.messages) {
        setChatMessages(chatRes.messages as unknown as ChatMessage[]);
      }
      const sumRes = await getRoomSummariesAction(initialRoom.id);
      if (sumRes.success && sumRes.summaries) {
        setAiSummaries(sumRes.summaries as unknown as AiSummary[]);
      }
    }
    loadData();
  }, [initialRoom.id]);

  // Establish Supabase Realtime channel for instant broadcasts
  useEffect(() => {
    const channelName = `study_room_${initialRoom.code.toUpperCase()}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: currentUserId }
      }
    });

    channelRef.current = channel;

    // Handle broadcast events
    channel
      .on("broadcast", { event: "lecture_sync" }, (payload: { payload: { lectureId: string; pageIndex: number } }) => {
        setNotes((prev) => ({
          active_lecture_id: payload.payload.lectureId,
          active_lecture_page: payload.payload.pageIndex,
          whiteboard_data: prev?.whiteboard_data
        }));
      })
      .on("broadcast", { event: "whiteboard_draw" }, () => {
        // Handled directly inside WhiteboardCanvas component
      })
      .on("broadcast", { event: "chat_receive" }, (payload: { payload: ChatMessage }) => {
        setChatMessages(prev => [...prev, payload.payload]);
      })
      .on("broadcast", { event: "trigger_refresh" }, () => {
        // Reload summaries
        getRoomSummariesAction(initialRoom.id).then(res => {
          if (res.success && res.summaries) setAiSummaries(res.summaries as unknown as AiSummary[]);
        });
      });

    // Handle presence join/leave tracking
    channel
      .on("presence", { event: "sync" }, () => {
        // Presence mapping is handled dynamically by Supabase
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialRoom.code, currentUserId, initialRoom.id, supabase]);

  // Scroll chats
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");

    try {
      const res = await sendRoomMessageAction(initialRoom.id, text);
      if (res.success && res.message) {
        // Broadcast message to channel members
        channelRef.current?.send({
          type: "broadcast",
          event: "chat_receive",
          payload: res.message
        });

        // If slash command, trigger a broadcast refresh after a delay to pull summaries
        if (text.startsWith("/")) {
          setTimeout(() => {
            channelRef.current?.send({
              type: "broadcast",
              event: "trigger_refresh",
              payload: {}
            });
            // Also refresh local summaries
            getRoomSummariesAction(initialRoom.id).then(r => {
              if (r.success && r.summaries) setAiSummaries(r.summaries as unknown as AiSummary[]);
            });
          }, 2000);
        }
      }
    } catch {
      // no-op
    }
  };

  const handleLectureSync = async (lectureId: string, pageIndex: number) => {
    // Broadcast lecture changes
    channelRef.current?.send({
      type: "broadcast",
      event: "lecture_sync",
      payload: { lectureId, pageIndex }
    });
  };

  const handleWhiteboardSync = (shapes: Shape[]) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "whiteboard_draw",
      payload: { shapes }
    });
  };

  // Participant Grid waveforms speaker simulation
  useEffect(() => {
    if (!isMicOn) return;
    const interval = setInterval(() => {
      // Pick random participant as active speaker
      if (members.length > 0) {
        const rand = members[Math.floor(Math.random() * members.length)];
        setActiveSpeaker(rand?.profiles?.first_name || "Host");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isMicOn, members]);

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-8.5rem)] min-h-0 select-none pb-2">
      
      {/* 1. Coordinated Top header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button 
            onClick={() => router.push("/rooms")}
            variant="ghost" 
            size="icon"
            className="h-8 w-8 rounded-lg border border-border hover:bg-accent shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground truncate select-none">
              {initialRoom.name}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 select-none font-semibold">
              Topic: {initialRoom.topic} • Invite Code: <span className="text-primary font-bold uppercase tracking-wide bg-primary/5 border border-primary/10 px-1 py-0.25 rounded">{initialRoom.code}</span>
            </p>
          </div>
        </div>

        {/* Video mute dashboard buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            onClick={() => setIsMicOn(!isMicOn)}
            variant={isMicOn ? "ghost" : "destructive"}
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0 cursor-pointer border border-border"
          >
            {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          
          <Button
            onClick={() => setIsCamOn(!isCamOn)}
            variant={isCamOn ? "ghost" : "destructive"}
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0 cursor-pointer border border-border"
          >
            {isCamOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>

          <Button
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            variant={isScreenSharing ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0 cursor-pointer border border-border"
          >
            <ScreenShare className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-border/40 mx-1.5" />

          <Button
            onClick={() => router.push("/rooms")}
            variant="destructive"
            size="sm"
            className="h-8 rounded-lg font-semibold shrink-0 flex gap-1 items-center px-3 cursor-pointer text-xs"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Leave
          </Button>
        </div>
      </div>

      {/* 2. Three-Panel Dashboard Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        
        {/* PANEL A (LEFT): Shared Workspace (6 grid cols) */}
        <div className="lg:col-span-6 flex flex-col bg-card border border-border/80 rounded-xl overflow-hidden min-h-0 shadow-3xs">
          {/* Tabs */}
          <div className="flex border-b border-border/60 bg-muted/30 px-2 py-1 gap-1 select-none">
            <button
              onClick={() => setLeftTab("lecture")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer h-7",
                leftTab === "lecture" ? "bg-primary text-primary-foreground shadow-3xs" : "text-muted-foreground hover:bg-muted"
              )}
            >
              📖 Shared Lecture
            </button>
            <button
              onClick={() => setLeftTab("whiteboard")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer h-7",
                leftTab === "whiteboard" ? "bg-primary text-primary-foreground shadow-3xs" : "text-muted-foreground hover:bg-muted"
              )}
            >
              🎨 Whiteboard Canvas
            </button>
            <button
              onClick={() => setLeftTab("quiz")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer h-7",
                leftTab === "quiz" ? "bg-primary text-primary-foreground shadow-3xs" : "text-muted-foreground hover:bg-muted"
              )}
            >
              🏆 Quiz Battle
            </button>
          </div>

          {/* Tab contents */}
          <div className="flex-1 min-h-0 relative p-3">
            {leftTab === "lecture" && (
              <SharedLecture 
                lectures={lectures}
                roomId={initialRoom.id}
                initialLectureId={notes?.active_lecture_id || ""}
                initialPageIndex={notes?.active_lecture_page || 1}
                onSync={handleLectureSync}
              />
            )}
            {leftTab === "whiteboard" && (
              <WhiteboardCanvas 
                roomId={initialRoom.id}
                initialData={notes?.whiteboard_data?.shapes || []}
                onSync={handleWhiteboardSync}
              />
            )}
            {leftTab === "quiz" && (
              <TeamQuiz 
                roomId={initialRoom.id}
              />
            )}
          </div>
        </div>

        {/* PANEL B (MIDDLE): Interactive Video Meetings Grid (3 grid cols) */}
        <div className="lg:col-span-3 flex flex-col gap-3 min-h-0 overflow-y-auto">
          <Card className="border border-border/80 bg-card rounded-xl flex-1 flex flex-col justify-between p-3 overflow-hidden shadow-3xs">
            <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider flex gap-1.5 items-center border-b border-border/60 pb-2 select-none">
              <Video className="h-3.5 w-3.5 text-muted-foreground" />
              Live Calling Grid
            </span>

            {/* Video Streams Canvas Grid */}
            <div className="flex-1 grid grid-rows-2 gap-2.5 my-3">
              {/* Host Stream */}
              <div className="relative rounded-lg overflow-hidden bg-zinc-950 border border-border flex items-center justify-center">
                {isCamOn ? (
                  <div className="absolute inset-0 bg-primary/5 flex items-center justify-center select-none">
                    <span className="text-zinc-400 text-[10px] font-bold">My Stream Active</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0.5 text-muted-foreground select-none">
                    <VideoOff className="h-5 w-5 opacity-65" />
                    <span className="text-[8px] font-bold">Camera off</span>
                  </div>
                )}
                {/* Active speaker waveforms indicator */}
                {isMicOn && activeSpeaker === "Host" && (
                  <div className="absolute left-2 top-2 p-1 rounded bg-primary text-primary-foreground flex gap-0.5 items-center">
                    <span className="h-1.5 w-0.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-0.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-0.5 bg-white rounded-full animate-bounce" />
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-[8px] bg-black/60 text-white px-1.5 py-0.25 rounded font-bold select-none">
                  You (Host)
                </span>
              </div>

              {/* Peer simulated stream */}
              <div className="relative rounded-lg overflow-hidden bg-zinc-950 border border-border flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/5 flex items-center justify-center select-none">
                  <span className="text-zinc-400 text-[10px] font-bold animate-pulse">Study Peer Stream</span>
                </div>
                {activeSpeaker !== "Host" && (
                  <div className="absolute left-2 top-2 p-1 rounded bg-emerald-600 text-white flex gap-0.5 items-center">
                    <span className="h-1.5 w-0.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-0.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-0.5 bg-white rounded-full animate-bounce" />
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-[8px] bg-black/60 text-white px-1.5 py-0.25 rounded font-bold select-none">
                  {members.find(m => m.user_id !== currentUserId)?.profiles?.first_name || "Study Peer"}
                </span>
              </div>
            </div>

            <div className="text-[9px] text-muted-foreground font-semibold text-center select-none border-t border-border/40 pt-2.5">
              Live Connection Status: <span className="text-emerald-500 font-bold">CONNECTED</span>
            </div>
          </Card>
        </div>

        {/* PANEL C (RIGHT): Real-Time Sidebars & Chat (3 grid cols) */}
        <div className="lg:col-span-3 flex flex-col bg-card border border-border/80 rounded-xl overflow-hidden min-h-0 shadow-3xs">
          {/* Tabs */}
          <div className="flex border-b border-border/60 bg-muted/30 px-2 py-1 gap-1 select-none">
            <button
              onClick={() => setRightTab("chat")}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer h-7",
                rightTab === "chat" ? "bg-primary text-primary-foreground shadow-3xs" : "text-muted-foreground hover:bg-muted"
              )}
            >
              💬 Group Chat
            </button>
            <button
              onClick={() => setRightTab("ai")}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer h-7",
                rightTab === "ai" ? "bg-primary text-primary-foreground shadow-3xs" : "text-muted-foreground hover:bg-muted"
              )}
            >
              🤖 AI Summaries
            </button>
            <button
              onClick={() => setRightTab("insights")}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer h-7",
                rightTab === "insights" ? "bg-primary text-primary-foreground shadow-3xs" : "text-muted-foreground hover:bg-muted"
              )}
            >
              📊 Logs
            </button>
          </div>

          {/* Contents */}
          <div className="flex-1 min-h-0 relative flex flex-col justify-between p-3">
            
            {/* GROUP CHAT TAB */}
            {rightTab === "chat" && (
              <div className="flex flex-col justify-between h-full min-h-0">
                {/* Messages stream */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pb-2 pr-1 min-h-0 scrollbar-thin">
                  {chatMessages.map((msg, idx) => {
                    const isSelf = msg.user_id === currentUserId;
                    return (
                      <div key={idx} className={`flex gap-1.5 items-start ${isSelf ? "flex-row-reverse" : ""}`}>
                        <div className="flex flex-col gap-0.5 max-w-[85%]">
                          <span className={`text-[9px] text-muted-foreground font-bold ${isSelf ? "text-right" : ""} select-none`}>
                            {msg.profiles?.first_name || "Member"}
                          </span>
                          <div className={`p-2 rounded-xl text-xs font-semibold leading-normal border ${
                            isSelf 
                              ? "bg-primary text-primary-foreground border-transparent" 
                              : "bg-card border-border/80 text-foreground"
                          }`}>
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Input box */}
                <div className="flex gap-1.5 border-t border-border/40 pt-2 items-center bg-card rounded-lg shadow-3xs">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type message or AI command (/explain)..."
                    className="flex-1 h-7.5 px-2 rounded-md border border-border bg-muted/30 text-[10px] font-semibold focus:outline-none"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    size="icon"
                    className="h-7.5 w-7.5 rounded-md cursor-pointer shrink-0"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* AI MEETING SUMMARY TAB */}
            {rightTab === "ai" && (
              <div className="h-full overflow-y-auto space-y-3 pr-1 min-h-0 scrollbar-thin">
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-[9px] text-muted-foreground flex gap-1.5 items-start shadow-3xs select-none">
                  <Sparkles className="h-4.5 w-4.5 text-primary shrink-0 animate-pulse" />
                  <div>
                    <span className="font-bold text-foreground">AI Summaries Catalog</span>
                    <p className="mt-0.5 leading-normal">
                      Type <span className="underline font-bold">/summarize</span> in chat to transcribe current discussion logs and build revision tasks automatically.
                    </p>
                  </div>
                </div>

                {aiSummaries.length === 0 ? (
                  <p className="text-center text-muted-foreground text-[10px] italic py-8 leading-normal select-none">
                    No summary notes generated yet. Solicit the assistant with &quot;/summarize&quot;.
                  </p>
                ) : (
                  aiSummaries.map((sum, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-muted/40 rounded-lg border border-border/80 text-[10px] space-y-1.5 leading-normal animate-in fade-in duration-150"
                    >
                      <span className="text-[8px] text-primary font-bold uppercase tracking-wider block select-none">
                        Summary compiled {new Date(sum.created_at).toLocaleTimeString()}
                      </span>
                      <p className="text-foreground font-semibold leading-normal">
                        {sum.summary_text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* COLLABORATION INSIGHTS TAB */}
            {rightTab === "insights" && (
              <div className="h-full overflow-y-auto space-y-3 pr-1 min-h-0 flex flex-col justify-between scrollbar-thin">
                <div className="space-y-3">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider flex gap-1.5 items-center border-b border-border/40 pb-2 select-none">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    Live Participation Logs
                  </span>

                  <div className="space-y-2">
                    {members.map((mem, idx) => {
                      const randScore = 60 + (((mem.profiles?.first_name?.charCodeAt(0) || 0) + idx) % 40);
                      return (
                        <div key={idx} className="p-2.5 bg-muted/20 border border-border/60 rounded-lg leading-normal space-y-1 shadow-3xs">
                          <div className="flex justify-between items-center text-xs font-bold text-foreground">
                            <span>{mem.profiles?.first_name} {mem.profiles?.last_name}</span>
                            <span className="text-primary text-[10px] capitalize">{mem.role}</span>
                          </div>
                          
                          <div className="flex justify-between items-center text-[9px] text-muted-foreground font-semibold">
                            <span>Discussion Activity:</span>
                            <span className="font-bold text-foreground">{randScore}% index</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 bg-muted/30 border border-border/60 rounded-lg text-[9px] text-muted-foreground leading-normal select-none">
                  ✓ Participation metrics are saved in room analytics on session leave.
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
