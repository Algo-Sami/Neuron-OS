"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  RotateCw, 
  Check, 
  HelpCircle,
  Bookmark
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FlashcardStudyModeProps {
  documentId: string;
  documentTitle: string;
  topicName: string;
  onBack: () => void;
  onReward: (xp: number) => void;
}

interface Flashcard {
  front: string;
  back: string;
}

export function FlashcardStudyMode({ 
  documentId, 
  documentTitle, 
  topicName, 
  onBack,
  onReward
}: FlashcardStudyModeProps) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [sessionRatings, setSessionRatings] = useState<{ easy: number; medium: number; hard: number }>({
    easy: 0, medium: 0, hard: 0
  });
  
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Generate flashcards on mount
  useEffect(() => {
    async function loadFlashcards() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/summarize", {
          method: "POST",
          body: JSON.stringify({ 
            documentId,
            customPrompt: `Generate exactly 8 high-yield conceptual flashcards for the topic: "${topicName || "General Study"}". The output must be a strict JSON array of objects, where each object has "front" (a conceptual term, question, or key process) and "back" (a short, clear, 1-2 sentence definition/explanation). Example format: [{"front": "Mutex", "back": "A mutual exclusion lock used to prevent multiple threads from accessing a shared resource simultaneously."}]. Return ONLY raw JSON.` 
          })
        });
        
        const data = await response.json();
        if (data?.summary) {
          let cleaned = data.summary.trim();
          if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
          } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
          }
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCards(parsed);
          } else {
            throw new Error("Invalid format");
          }
        } else {
          throw new Error("API failed");
        }
      } catch {
        // Fallback robust deck
        setCards([
          { front: `Core definition of ${topicName || "this subject"}`, back: `Referenced core definitions in study guidelines.` },
          { front: `Main trade-offs of ${topicName || "this design"}`, back: `Trade-offs are typically structural reliability vs speed.` },
          { front: `Process Scheduling goals`, back: `To maximize CPU utilization and minimize response delays for users.` },
          { front: `Mutual Exclusion`, back: `A requirement that only one process can enter a critical section at any given time.` },
          { front: `Semaphores`, back: `An integer variable used for signaling and controlling process synchronization.` },
          { front: `Deadlock`, back: `A state where two or more processes are blocked forever, each waiting for a resource held by another.` },
          { front: `Context Switching`, back: `The process of storing the state of a CPU process so that it can be restored and resumed later.` },
          { front: `Paging`, back: `A memory management scheme that eliminates the need for contiguous physical allocation.` }
        ]);
      } finally {
        setIsLoading(false);
      }
    }
    loadFlashcards();
  }, [documentId, topicName]);

  const handleRate = (rating: "easy" | "medium" | "hard") => {
    setSessionRatings(prev => ({
      ...prev,
      [rating]: prev[rating] + 1
    }));

    setIsFlipped(false);
    
    // Smooth delay before shifting index
    setTimeout(() => {
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsCompleted(true);
        onReward(100); // Complete deck XP reward
      }
    }, 150);
  };

  const activeCard = cards[currentIndex];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button 
            onClick={onBack}
            variant="ghost" 
            size="icon-sm"
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground flex gap-2 items-center">
              Smart Flashcards Deck
            </h2>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Topic: {topicName || "General Study"} • Lecture: {documentTitle}
            </p>
          </div>
        </div>
        <span className="text-xs bg-pink-500/10 text-pink-400 font-bold px-3 py-1 rounded-xl flex gap-1 items-center shadow-sm">
          <Bookmark className="h-3.5 w-3.5 fill-pink-500/10" />
          Active Recall Active
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-semibold">AI is compiling cards for this topic...</span>
        </div>
      ) : isCompleted ? (
        /* Completion Screen */
        <div className="max-w-md mx-auto w-full text-center py-10 space-y-6 animate-in zoom-in duration-300">
          <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-md border border-emerald-500/20">
            <Check className="h-8 w-8 stroke-[3]" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight">Active Deck Complete!</h3>
            <p className="text-muted-foreground text-xs font-semibold">
              You revised all 8 conceptual cards and successfully earned 100 XP points!
            </p>
          </div>

          {/* Rating Breakdown */}
          <div className="p-4 bg-muted/40 rounded-2xl border border-border/20 grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground font-semibold">Easy cards</span>
              <span className="text-base font-black text-emerald-500">{sessionRatings.easy}</span>
            </div>
            <div className="flex flex-col items-center border-x border-border/40">
              <span className="text-xs text-muted-foreground font-semibold">Medium cards</span>
              <span className="text-base font-black text-orange-500">{sessionRatings.medium}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground font-semibold">Hard cards</span>
              <span className="text-base font-black text-red-500">{sessionRatings.hard}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => {
                setCurrentIndex(0);
                setIsCompleted(false);
                setSessionRatings({ easy: 0, medium: 0, hard: 0 });
              }}
              className="w-full font-bold rounded-xl shadow-md cursor-pointer"
            >
              Study Deck Again
            </Button>
            <Button 
              onClick={onBack}
              variant="outline"
              className="w-full font-bold rounded-xl cursor-pointer"
            >
              Return to Self-Study
            </Button>
          </div>
        </div>
      ) : (
        /* Flashcard Screen */
        <div className="max-w-xl mx-auto w-full flex flex-col gap-8">
          
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="font-semibold">Revision Progress</span>
              <span className="font-bold">{currentIndex + 1} / {cards.length} cards</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/20 shadow-inner">
              <div 
                className="h-full bg-pink-500 rounded-full transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Flashcard container (Animated Flip) */}
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="group relative h-[300px] w-full cursor-pointer perspective-1000"
          >
            <div className={`relative h-full w-full rounded-3xl border border-border/40 bg-card shadow-md transition-transform duration-500 transform-style-3d ${
              isFlipped ? "rotate-y-180" : ""
            }`}>
              
              {/* FRONT OF THE CARD */}
              <div className="absolute inset-0 backface-hidden flex flex-col justify-between p-6 bg-gradient-to-br from-card to-pink-500/[0.01]">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex gap-1 items-center">
                  <HelpCircle className="h-3.5 w-3.5 text-pink-500" />
                  Concept Prompt
                </span>
                
                <h3 className="text-xl font-bold tracking-tight text-center text-foreground px-4 py-8 select-none">
                  {activeCard?.front}
                </h3>
                
                <div className="text-[10px] text-muted-foreground font-semibold text-center select-none animate-pulse">
                  Click/Tap card to flip over and see explanation
                </div>
              </div>

              {/* BACK OF THE CARD */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col justify-between p-6 bg-gradient-to-br from-indigo-500/[0.02] via-card to-transparent">
                <span className="text-[10px] font-black text-primary uppercase tracking-wider flex gap-1 items-center">
                  <RotateCw className="h-3.5 w-3.5 text-primary" />
                  AI Explanation
                </span>
                
                <p className="text-sm font-semibold leading-relaxed text-center text-foreground/90 px-4 py-6 select-none">
                  {activeCard?.back}
                </p>
                
                <div className="text-[10px] text-muted-foreground font-semibold text-center select-none">
                  Click/Tap to flip back to question
                </div>
              </div>

            </div>
          </div>

          {/* Grading difficulty controls */}
          <div className="flex flex-col gap-4 border-t border-border/40 pt-6">
            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider text-center">
              How well did you explain this concept?
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() => handleRate("hard")}
                variant="outline"
                className="h-12 border-red-500/20 text-red-500 bg-red-500/[0.02] hover:bg-red-500/10 font-bold rounded-xl cursor-pointer hover:border-red-500/30"
              >
                Hard (Review again)
              </Button>
              <Button
                onClick={() => handleRate("medium")}
                variant="outline"
                className="h-12 border-orange-500/20 text-orange-500 bg-orange-500/[0.02] hover:bg-orange-500/10 font-bold rounded-xl cursor-pointer hover:border-orange-500/30"
              >
                Medium
              </Button>
              <Button
                onClick={() => handleRate("easy")}
                variant="outline"
                className="h-12 border-emerald-500/20 text-emerald-500 bg-emerald-500/[0.02] hover:bg-emerald-500/10 font-bold rounded-xl cursor-pointer hover:border-emerald-500/30"
              >
                Easy
              </Button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
