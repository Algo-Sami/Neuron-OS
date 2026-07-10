"use client";

import React, { useState } from "react";
import { 
  Users, 
  Plus, 
  LogIn, 
  Sparkles, 
  Search,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createStudyRoomAction, joinStudyRoomAction } from "@/actions/study-rooms";
import { useRouter } from "next/navigation";

interface StudyRoom {
  id: string;
  name: string;
  topic: string | null;
  code: string;
  privacy: string;
  max_participants?: number | null;
  scheduled_time?: string | null;
}

interface RoomsHubProps {
  initialRooms: StudyRoom[];
  myJoinedRoomIds: string[];
  subjects: { id: string; name: string; code: string; color: string }[];
}

export function RoomsHub({ initialRooms, subjects }: RoomsHubProps) {
  const router = useRouter();
  const [rooms] = useState<StudyRoom[]>(initialRooms);
  const [joinCode, setJoinCode] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Create Room modal fields
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [roomName, setRoomName] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("none");
  const [topic, setTopic] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [privacy, setPrivacy] = useState<string>("public");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState<boolean>(true);

  const handleJoinByCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!joinCode.trim()) return;

    setIsJoining(true);
    try {
      const res = await joinStudyRoomAction(joinCode.trim());
      if (res.success && res.room) {
        router.push(`/rooms/${res.room.code}`);
      } else {
        alert(res.error || "Failed to join room.");
      }
    } catch {
      alert("Error joining session. Please check your network.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      alert("Please enter a room name.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await createStudyRoomAction({
        name: roomName.trim(),
        subjectId: selectedSubjectId === "none" ? undefined : selectedSubjectId,
        topic: topic.trim(),
        description: description.trim(),
        privacy,
        scheduledTime: scheduledTime || undefined,
        aiAssistantEnabled,
      });

      if (res.success && res.room) {
        setShowCreateModal(false);
        router.push(`/rooms/${res.room.code}`);
      } else {
        alert(res.error || "Failed to create study room.");
      }
    } catch {
      alert("Error building collaborative study room.");
    } finally {
      setIsCreating(false);
    }
  };

  // Filter rooms
  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10 px-4 md:px-0 animate-in fade-in duration-300">
      
      {/* Rooms Hub Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5 select-none">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2 bg-gradient-to-r from-foreground via-foreground to-foreground/75 bg-clip-text">
            Study Rooms <Users className="h-4.5 w-4.5 text-primary animate-pulse" />
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-powered collaborative spaces. Co-study lecture notes, share whiteboards, and solve quizzes together.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="rounded-lg font-medium shadow-xs h-8 text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 transition-all"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Room
          </Button>
        </div>
      </div>

      {/* Main Grid: Join Code Form & Search Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Side Panel: Invite join box & Scheduled sessions */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Join Code Box */}
          <Card className="rounded-xl border border-border/60 bg-card/45 shadow-2xs backdrop-blur-xs">
            <CardHeader className="p-4 pb-2.5 border-b border-border/20">
              <CardTitle className="text-xs font-semibold flex gap-1.5 items-center text-foreground select-none">
                <LogIn className="h-3.5 w-3.5 text-primary/85" />
                Join Room by Invite Code
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleJoinByCode} className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  className="flex-1 h-8 px-2.5 rounded-lg border border-border/80 bg-secondary/35 text-xs font-bold text-center uppercase tracking-widest focus:border-primary/45 focus:bg-card focus:outline-none transition-all"
                />
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={isJoining || joinCode.trim().length !== 6}
                  className="rounded-lg font-medium px-3 h-8 text-xs cursor-pointer shrink-0 transition-all"
                >
                  Join
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Guidelines info card */}
          <Card className="rounded-xl border border-border/60 bg-card/45 p-4 space-y-2 text-xs leading-relaxed text-muted-foreground shadow-2xs backdrop-blur-xs">
            <h4 className="font-bold text-foreground flex gap-1 items-center uppercase tracking-widest text-[9px] select-none">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI Collaboration Guidelines
            </h4>
            <p className="text-[11px] leading-relaxed">
              Invite classmates to study. Once joined, utilize the workspace tabs to open a lecture document, draw whiteboards, or complete quiz battles together.
            </p>
            <div className="border-t border-border/20 pt-2.5 font-semibold text-primary text-[10px]">
              ⚡ Pro-tip: Type `/summarize` or `/explain` in the active room chat to summon the AI assistant.
            </div>
          </Card>
        </div>

        {/* Right Side: Active Rooms Grid */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rooms by name, topic, or invite code..."
              className="w-full h-8 pl-8 pr-4 rounded-lg border border-border/80 bg-secondary/35 text-xs font-semibold focus:border-primary/45 focus:bg-card focus:outline-none transition-all"
            />
          </div>

          {/* Rooms grid */}
          {filteredRooms.length === 0 ? (
            <div className="text-center py-16 bg-card/30 border border-border/80 border-dashed rounded-xl space-y-2 backdrop-blur-xs">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <h3 className="text-xs font-semibold text-foreground select-none">No active rooms found</h3>
              <p className="text-[10px] text-muted-foreground px-4 leading-normal">
                No rooms match your search query, or there are no active rooms in this system. Create one above to get started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredRooms.map((room) => {
                return (
                  <Card 
                    key={room.id}
                    onClick={() => router.push(`/rooms/${room.code}`)}
                    className="rounded-xl border border-border/60 bg-card/45 hover:bg-card/90 hover:border-primary/20 hover:shadow-2xs transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden shadow-2xs backdrop-blur-xs h-full"
                  >
                    <div className="p-4 pb-0">
                      <div className="flex items-center justify-between gap-2 select-none">
                        <span className="text-[8px] font-bold uppercase text-muted-foreground tracking-wider bg-secondary/80 border border-border/40 px-1.5 py-0.5 rounded-md">
                          {room.privacy} Room
                        </span>
                        
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest bg-secondary/80 border border-border/40 px-1.5 py-0.5 rounded-md">
                          CODE: {room.code}
                        </span>
                      </div>
                      
                      <CardTitle className="text-xs font-semibold tracking-tight text-foreground mt-3 truncate select-none">
                        {room.name}
                      </CardTitle>
                      <p className="text-[10px] text-muted-foreground mt-0.5 select-none font-medium">
                        Topic: <span className="text-foreground/90 font-semibold">{room.topic || "General Study"}</span>
                      </p>
                    </div>

                    <div className="px-4 py-2.5 flex items-center justify-between border-t border-border/20 mt-4 text-[9px] text-muted-foreground bg-secondary/20">
                      <div className="flex items-center gap-1 font-medium">
                        <Users className="h-3 w-3 text-primary/75" />
                        <span>max {room.max_participants || 10} participants</span>
                      </div>
                      
                      {room.scheduled_time && (
                        <div className="flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(room.scheduled_time).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* CREATE ROOM FULL DIALOG MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-xl border border-border/60 shadow-2xl p-5 space-y-4 animate-in zoom-in duration-200">
            <div className="border-b border-border/20 pb-2.5 flex justify-between items-center">
              <h3 className="text-xs font-semibold tracking-tight flex gap-1.5 items-center text-foreground uppercase tracking-wider">
                <Users className="h-4.5 w-4.5 text-primary animate-pulse" />
                Create Collaborative Room
              </h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer border border-transparent hover:bg-secondary p-1 rounded transition-all"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3.5 text-left">
              {/* Room Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Operating Systems Revision"
                  className="w-full h-8 px-2.5 rounded-lg border border-border/80 bg-secondary/35 text-xs font-semibold focus:border-primary/45 focus:bg-card focus:outline-none transition-all"
                />
              </div>

              {/* Subject Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Course Subject</label>
                <div className="relative">
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full h-8 px-2.5 pr-8 rounded-lg border border-border/80 bg-secondary/35 text-xs font-semibold focus:border-primary/45 focus:bg-card focus:outline-none appearance-none cursor-pointer transition-all"
                  >
                    <option value="none">-- Optional Subject --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3 pointer-events-none w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[3.5px] border-t-muted-foreground" />
                </div>
              </div>

              {/* Topic & Privacy */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Process Scheduling"
                    className="w-full h-8 px-2.5 rounded-lg border border-border/80 bg-secondary/35 text-xs font-semibold focus:border-primary/45 focus:bg-card focus:outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Privacy Setting</label>
                  <div className="relative">
                    <select
                      value={privacy}
                      onChange={(e) => setPrivacy(e.target.value)}
                      className="w-full h-8 px-2.5 pr-8 rounded-lg border border-border/80 bg-secondary/35 text-xs font-semibold focus:border-primary/45 focus:bg-card focus:outline-none appearance-none cursor-pointer transition-all"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[3.5px] border-t-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Study session details..."
                  className="w-full h-8 px-2.5 rounded-lg border border-border/80 bg-secondary/35 text-xs font-semibold focus:border-primary/45 focus:bg-card focus:outline-none transition-all"
                />
              </div>

              {/* Scheduled Time */}
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Scheduled Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-border/80 bg-secondary/35 text-xs font-semibold focus:border-primary/45 focus:bg-card focus:outline-none text-muted-foreground transition-all"
                />
              </div>

              {/* AI toggle */}
              <div className="flex items-center justify-between border-t border-border/20 pt-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-foreground">AI Meeting Assistant</span>
                  <span className="text-[10px] text-muted-foreground leading-normal">Enable automatic slash summaries and quiz generation.</span>
                </div>
                <input
                  type="checkbox"
                  checked={aiAssistantEnabled}
                  onChange={(e) => setAiAssistantEnabled(e.target.checked)}
                  className="h-4.5 w-4.5 accent-primary cursor-pointer shrink-0 border-border rounded"
                />
              </div>
            </div>

            <Button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="w-full font-medium h-9 rounded-lg shadow-xs mt-4 cursor-pointer text-xs bg-primary text-primary-foreground hover:bg-primary/95 transition-all"
            >
              {isCreating ? "Formulating room..." : "Generate Collaboration Session"}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
