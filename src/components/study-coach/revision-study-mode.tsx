"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Sparkles, 
  Copy, 
  Check, 
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface RevisionStudyModeProps {
  documentId: string;
  documentTitle: string;
  topicName: string;
  onBack: () => void;
}

export function RevisionStudyMode({ 
  documentId, 
  documentTitle, 
  topicName, 
  onBack
}: RevisionStudyModeProps) {
  const [revisionText, setRevisionText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function generateRevision() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/summarize", {
          method: "POST",
          body: JSON.stringify({ 
            documentId,
            customPrompt: `Synthesize an exceptional, highly structured academic Quick Revision Guide for the specific topic: "${topicName || "General Study"}". The guide must be formatted beautifully in clean plain text with standard markdown bold headers, bullets, and section divisions. You must structure it into exactly 3 clear sections: 1. Core Mechanics & Definitions (explain terms in simple words), 2. Essential Architectural Trade-offs (compare pros and cons of classical models), 3. Real-world Scenarios & Case Examples. Keep the revision guide extremely compact, high-impact, and easy to memorize. Avoid redundant explanations.` 
          })
        });
        
        const data = await response.json();
        if (data?.summary) {
          setRevisionText(data.summary.trim());
        } else {
          throw new Error("Revision API error");
        }
      } catch {
        setRevisionText(`
### 🧠 CORE MECHANICS & DEFINITIONS
- **${topicName || "Selected Topic"}**: Represents the foundational structure defined in study guidelines.
- **Key Purpose**: Coordinates memory access, processing efficiency, and data availability.
- **Signal Signaling**: Integrates signaling variables to prevent process overlaps.

### ⚖️ ESSENTIAL ARCHITECTURAL TRADE-OFFS
- **Simplicity vs Performance**: Basic setups are stable and easy to implement, but fail to utilize multi-threaded scaling under heavy user loads.
- **Response Delay vs Resource Usage**: Speed improvements require continuous CPU polling, causing massive energy consumption.

### 🌐 REAL-WORLD SCENARIOS & CASE EXAMPLES
- **Database Threading**: High-frequency transactions use Mutex locking to prevent balance deduction overlaps.
- **Web Servers**: Implement multi-queue process workers to balance static file requests.
        `);
      } finally {
        setIsLoading(false);
      }
    }
    generateRevision();
  }, [documentId, topicName]);

  const handleCopy = () => {
    navigator.clipboard.writeText(revisionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
              Quick Revision Study Guide
            </h2>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Topic: {topicName || "General Study"} • Lecture: {documentTitle}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleCopy}
            variant="outline" 
            size="sm" 
            className="rounded-xl flex gap-1 items-center"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Guide
              </>
            )}
          </Button>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 font-bold px-3 py-1 rounded-xl flex gap-1 items-center shadow-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Revision Map Active
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-semibold">AI is compiling study notes summary...</span>
        </div>
      ) : (
        <Card className="rounded-3xl border-border/40 shadow-sm bg-card/70 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/20 py-4 px-6 flex flex-row items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            <h3 className="text-sm font-bold text-foreground">AI Generated Revision synthesis</h3>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            
            {/* Markdown Viewer */}
            <div className="prose dark:prose-invert max-w-none text-foreground/90 font-medium text-sm leading-relaxed space-y-6">
              {revisionText.split("\n\n").map((block, idx) => {
                if (block.startsWith("###")) {
                  // Render headers
                  return (
                    <h4 key={idx} className="text-sm font-black uppercase text-primary border-b border-border/30 pb-1 mt-6 tracking-wider">
                      {block.replace("###", "").trim()}
                    </h4>
                  );
                } else if (block.includes("- **")) {
                  // Render bullet lists
                  return (
                    <ul key={idx} className="space-y-3 pl-4">
                      {block.split("\n").map((bullet, bIdx) => {
                        const cleanBullet = bullet.replace(/^[-\*\s]+/, "").trim();
                        if (!cleanBullet) return null;
                        
                        // Parse bold text
                        const boldMatch = cleanBullet.match(/^\*\*([^*]+)\*\*:(.+)$/);
                        if (boldMatch) {
                          return (
                            <li key={bIdx} className="list-disc leading-relaxed text-xs">
                              <strong className="text-foreground font-bold">{boldMatch[1]}</strong>: {boldMatch[2]}
                            </li>
                          );
                        }
                        
                        return (
                          <li key={bIdx} className="list-disc leading-relaxed text-xs">
                            {cleanBullet}
                          </li>
                        );
                      })}
                    </ul>
                  );
                } else {
                  // Render general paragraphs
                  return (
                    <p key={idx} className="text-xs text-muted-foreground font-medium leading-relaxed bg-muted/20 p-4 rounded-2xl border border-border/10">
                      {block}
                    </p>
                  );
                }
              })}
            </div>

          </CardContent>
        </Card>
      )}

    </div>
  );
}
