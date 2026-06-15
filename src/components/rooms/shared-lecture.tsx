"use client";

import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  RotateCw,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { updateLectureSyncAction } from "@/actions/study-rooms";

interface LectureDoc {
  id: string;
  title: string;
  subject_id: string;
  upload_date: string;
}

interface SharedLectureProps {
  lectures: LectureDoc[];
  roomId: string;
  initialLectureId: string;
  initialPageIndex: number;
  onSync: (lectureId: string, pageIndex: number) => void;
}

export function SharedLecture({
  lectures,
  roomId,
  initialLectureId,
  initialPageIndex,
  onSync
}: SharedLectureProps) {
  const [selectedLectureId, setSelectedLectureId] = useState<string>(initialLectureId);
  const [pageIndex, setPageIndex] = useState<number>(initialPageIndex);
  const totalPages = 10;
  const [slideContent, setSlideContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [prevInitialLectureId, setPrevInitialLectureId] = useState<string>(initialLectureId);
  const [prevInitialPageIndex, setPrevInitialPageIndex] = useState<number>(initialPageIndex);

  if (initialLectureId !== prevInitialLectureId) {
    setPrevInitialLectureId(initialLectureId);
    setSelectedLectureId(initialLectureId);
  }
  if (initialPageIndex !== prevInitialPageIndex) {
    setPrevInitialPageIndex(initialPageIndex);
    setPageIndex(initialPageIndex);
  }

  // Load simulated slide bullet content when page index or doc shifts
  useEffect(() => {
    if (!selectedLectureId) return;

    const activeDoc = lectures.find(l => l.id === selectedLectureId);
    
    // Set loading state asynchronously to avoid synchronous effect renders
    const loadTimer = setTimeout(() => {
      setIsLoading(true);
    }, 0);

    // Simulate reading text from lecture notes summary
    const timer = setTimeout(() => {
      setSlideContent(`
### 📖 Slide ${pageIndex}: ${activeDoc?.title || "Core Mechanics"} Analysis
- **Key Threading Mechanism**: Establishes critical regions to regulate process overlaps and resource allocation.
- **Resource Constraints**: CPU scheduling delays increase memory occupancy by 15-20% under burst load transactions.
- **Strategic Recommendation**: Implement Mutex signaling blocks to isolate simultaneous database operations.
      `);
      setIsLoading(false);
    }, 400);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(timer);
    };
  }, [selectedLectureId, pageIndex, lectures]);

  const handleLectureChange = async (lecId: string) => {
    setSelectedLectureId(lecId);
    setPageIndex(1);

    // Call server action to sync
    await updateLectureSyncAction(roomId, lecId, 1);
    onSync(lecId, 1);
  };

  const handlePageChange = async (newIdx: number) => {
    if (newIdx < 1 || newIdx > totalPages) return;
    setPageIndex(newIdx);

    // Call server action to sync page turn
    await updateLectureSyncAction(roomId, selectedLectureId, newIdx);
    onSync(selectedLectureId, newIdx);
  };

  const activeDoc = lectures.find(l => l.id === selectedLectureId);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 justify-between">
      
      {/* Selector and Slide Info */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* Lecture Document Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select Shared Document</label>
            <div className="relative">
              <select
                value={selectedLectureId}
                onChange={(e) => handleLectureChange(e.target.value)}
                className="w-full h-9 px-3 pr-8 rounded-xl border border-border bg-background text-xs font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">-- Choose Lecture Notes --</option>
                {lectures.map(lec => (
                  <option key={lec.id} value={lec.id}>{lec.title}</option>
                ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
            </div>
          </div>

          {/* Page Slide Nav tools */}
          {selectedLectureId && (
            <div className="flex flex-col gap-1 justify-end">
              <div className="flex items-center gap-2 justify-between h-9 bg-card px-3 rounded-xl border border-border/30">
                <span className="text-[11px] font-bold text-muted-foreground">Slide page controls</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => handlePageChange(pageIndex - 1)}
                    disabled={pageIndex <= 1 || isLoading}
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-lg hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-xs font-black text-foreground min-w-[50px] text-center select-none">
                    {pageIndex} / {totalPages}
                  </span>

                  <Button
                    onClick={() => handlePageChange(pageIndex + 1)}
                    disabled={pageIndex >= totalPages || isLoading}
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-lg hover:bg-muted"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Dynamic slide preview canvas */}
        {!selectedLectureId ? (
          <div className="h-[280px] bg-muted/20 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-6 gap-2">
            <BookOpen className="h-8 w-8 text-muted-foreground animate-pulse" />
            <h4 className="text-xs font-bold text-foreground">No lecture note active</h4>
            <p className="text-[10px] text-muted-foreground max-w-[260px] leading-relaxed">
              Select an uploaded course document from the dropdown above to load notes in the collaborative room.
            </p>
          </div>
        ) : isLoading ? (
          <div className="h-[280px] bg-card border border-border/30 rounded-2xl flex flex-col items-center justify-center gap-2">
            <RotateCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-[10px] text-muted-foreground font-semibold">Tuning slides...</span>
          </div>
        ) : (
          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 overflow-hidden h-[300px] overflow-y-auto">
            <CardHeader className="bg-muted/30 border-b border-border/20 py-2.5 px-4 flex flex-row items-center justify-between">
              <span className="text-[10px] font-black uppercase text-primary tracking-wider flex gap-1 items-center">
                <FileText className="h-3.5 w-3.5" />
                Lecture: {activeDoc?.title}
              </span>
              
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full flex gap-1 items-center">
                <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                Synced slide page turn active
              </span>
            </CardHeader>
            <CardContent className="p-5 font-semibold text-xs leading-relaxed text-foreground/90 space-y-4">
              {slideContent.split("\n").map((line, idx) => {
                if (line.startsWith("###")) {
                  return (
                    <h4 key={idx} className="text-xs font-black uppercase text-primary border-b border-border/30 pb-0.5 mt-2 tracking-wider">
                      {line.replace("###", "").trim()}
                    </h4>
                  );
                } else if (line.startsWith("- **")) {
                  const match = line.match(/^-\s*\*\*([^*]+)\*\*:(.+)$/);
                  if (match) {
                    return (
                      <div key={idx} className="flex gap-2 items-start text-[11px] leading-relaxed pl-2">
                        <span className="text-primary font-black">•</span>
                        <span>
                          <strong className="text-foreground font-bold">{match[1]}</strong>: {match[2]}
                        </span>
                      </div>
                    );
                  }
                }
                return line.trim() ? <p key={idx} className="text-muted-foreground pl-2">{line.trim()}</p> : null;
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {selectedLectureId && (
        <div className="text-[9px] text-muted-foreground leading-relaxed italic bg-muted/20 p-2.5 rounded-xl border border-border/20">
          ✓ Slide indexing is synchronized. When you navigate pages, slides automatically shift on all active group screens.
        </div>
      )}

    </div>
  );
}
