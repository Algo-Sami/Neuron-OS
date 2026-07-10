"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, Download, Copy, RefreshCw, Check, 
  BookOpen, Brain, ListCheck, HelpCircle, History, Calendar, List, Lightbulb
} from "lucide-react";

interface HistoryItem {
  id: string;
  mode: string;
  createdAt: string;
}

interface SummaryViewerProps {
  document: {
    id: string;
    title: string;
    file_type: string;
    file_url: string;
    created_at: string;
    summary_status: string;
    subjects?: { name: string } | null;
  };
  initialHistory: HistoryItem[];
}

type SummaryMode = 'beginner' | 'concise' | 'detailed' | 'exam-focused' | 'bullet' | 'key-concepts';

export default function SummaryViewer({ document, initialHistory }: SummaryViewerProps) {
  const [activeMode, setActiveMode] = useState<SummaryMode>('detailed');
  const [summaryText, setSummaryText] = useState<string>("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(
    document.summary_status === "pending" || document.summary_status === "processing"
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Fetch summary for the active mode
  const fetchSummary = async (mode: SummaryMode, force = false) => {
    // Only show the skeleton loader if we aren't in the custom reading/polling state
    if (!isProcessing) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          mode: mode,
          forceRegenerate: force
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load summary");
      }

      setSummaryText(data.summary);
      setKeyPoints(data.keyPoints || []);
      setIsProcessing(false); // Successfully generated, stop polling
      setLoading(false);

      // If a new summary was generated (not from cache), update local history list
      if (!data.cached && !force) {
        const alreadyExists = history.some(h => h.mode === mode);
        if (!alreadyExists) {
          setHistory(prev => [
            { id: Math.random().toString(), mode, createdAt: data.createdAt },
            ...prev
          ]);
        }
      } else if (force) {
        // Update the timestamp of the regenerated mode item in history
        setHistory(prev => 
          prev.map(h => h.mode === mode ? { ...h, createdAt: data.createdAt } : h)
        );
      }
    } catch (err: unknown) {
      const errMsg = (err as Error).message || "";
      if (errMsg.includes("still processing")) {
        // The background extraction is still working. Stay in the polling state without showing an error.
        setIsProcessing(true);
      } else {
        console.error(err);
        setError(errMsg || "Failed to retrieve summary from server.");
        setIsProcessing(false);
      }
    } finally {
      if (!isProcessing) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary(activeMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode]);

  // Polling mechanism to check if background extraction completes
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchSummary(activeMode);
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, activeMode]);

  // Clipboard copy handler
  const handleCopy = async () => {
    if (!summaryText) return;
    try {
      const fullText = `# ${document.title}\nMode: ${activeMode.toUpperCase()} Summary\n\n${summaryText}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  // Plain Text / Markdown Guide exporter
  const handleExport = () => {
    if (!summaryText) return;
    setExporting(true);
    try {
      const dateStr = new Date().toLocaleDateString();
      const pointsText = keyPoints.length > 0 
        ? `## Key Takeaways\n${keyPoints.map(p => `- ${p}`).join("\n")}\n\n` 
        : "";
      
      const fileContent = `=====================================================
STUDY GUIDE: ${document.title.toUpperCase()}
Generated on: ${dateStr}
Mode: ${activeMode.toUpperCase()}
=====================================================

${pointsText}## Study Summary
${summaryText}

-----------------------------------------------------
Powered by Neuron OS AI Summary Engine
`;

      const blob = new Blob([fileContent], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      
      // Clean filename
      const cleanTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${cleanTitle}_${activeMode}_summary.md`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  };

  // Lightweight HTML renderer for Markdown synthesis
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    const parseInlineStyles = (raw: string, keyPrefix: string) => {
      // Simple bold replacing
      const parts = raw.split("**");
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          return <strong key={`${keyPrefix}-strong-${index}`} className="font-bold text-foreground">{part}</strong>;
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Heading 3
      if (trimmed.startsWith("###")) {
        elements.push(
          <h3 key={index} className="text-base font-bold text-foreground mt-6 mb-2 tracking-tight flex items-center gap-1.5 border-b border-border/50 pb-1">
            {parseInlineStyles(trimmed.replace(/^###\s*/, ""), `h3-${index}`)}
          </h3>
        );
      } 
      // Heading 2
      else if (trimmed.startsWith("##")) {
        elements.push(
          <h2 key={index} className="text-lg font-extrabold text-foreground mt-8 mb-3 tracking-tight border-b border-border pb-1.5">
            {parseInlineStyles(trimmed.replace(/^##\s*/, ""), `h2-${index}`)}
          </h2>
        );
      }
      // Heading 1
      else if (trimmed.startsWith("#")) {
        elements.push(
          <h1 key={index} className="text-xl font-black text-foreground mt-8 mb-4 tracking-tight border-b-2 border-border pb-2">
            {parseInlineStyles(trimmed.replace(/^#\s*/, ""), `h1-${index}`)}
          </h1>
        );
      }
      // Bullet Items
      else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        elements.push(
          <li key={index} className="text-sm text-muted-foreground ml-5 pl-1.5 list-disc leading-relaxed mt-2.5">
            {parseInlineStyles(trimmed.replace(/^[-\*]\s*/, ""), `bullet-${index}`)}
          </li>
        );
      }
      // Number Items
      else if (/^\d+\.\s*/.test(trimmed)) {
        const numContent = trimmed.replace(/^\d+\.\s*/, "");
        const num = trimmed.match(/^\d+/)?.[0];
        elements.push(
          <div key={index} className="text-sm text-muted-foreground ml-5 pl-1.5 leading-relaxed mt-2.5 flex items-start gap-1">
            <span className="font-semibold text-primary">{num}.</span>
            <span>{parseInlineStyles(numContent, `number-${index}`)}</span>
          </div>
        );
      }
      // Empty Lines
      else if (!trimmed) {
        elements.push(<div key={index} className="h-3" />);
      } 
      // General Paragraph
      else {
        elements.push(
          <p key={index} className="text-sm text-muted-foreground leading-relaxed mt-3.5">
            {parseInlineStyles(trimmed, `p-${index}`)}
          </p>
        );
      }
    });

    return <div className="space-y-0.5">{elements}</div>;
  };

  const getModeIcon = (mode: SummaryMode) => {
    switch (mode) {
      case 'beginner': return <HelpCircle className="h-4 w-4" />;
      case 'concise': return <Brain className="h-4 w-4" />;
      case 'detailed': return <BookOpen className="h-4 w-4" />;
      case 'exam-focused': return <ListCheck className="h-4 w-4" />;
      case 'bullet': return <List className="h-4 w-4" />;
      case 'key-concepts': return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getModeLabel = (mode: SummaryMode) => {
    switch (mode) {
      case 'beginner': return "Beginner Mode";
      case 'concise': return "Concise Summary";
      case 'detailed': return "Detailed Synthesis";
      case 'exam-focused': return "Exam Guide";
      case 'bullet': return "Bullet Notes";
      case 'key-concepts': return "Key Concepts";
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-4 items-start">
      
      {/* LEFT SIDE: Active Summarization Sheet (Main Study Area) */}
      <div className="md:col-span-3 flex flex-col gap-5">
        
        {/* Dynamic Mode Switcher pill deck */}
        <div className="flex flex-wrap p-1 gap-1 bg-muted/60 backdrop-blur-xs rounded-xl border border-border/60">
          {(['beginner', 'concise', 'detailed', 'exam-focused', 'bullet', 'key-concepts'] as SummaryMode[]).map((mode) => {
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  isActive 
                    ? "bg-card text-foreground shadow-xs border border-border/80" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {getModeIcon(mode)}
                {getModeLabel(mode)}
              </button>
            );
          })}
        </div>

        {/* Dynamic Content Panel */}
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md relative overflow-hidden min-h-[500px]">
          {/* Shimmer header when processing */}
          {loading && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 animate-pulse" />
          )}

          <CardHeader className="border-b border-border/60 pt-6 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
              {getModeLabel(activeMode)} Study Guide
            </CardTitle>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase bg-muted/50 px-2 py-0.5 rounded border">
              Gemini 2.5 Flash
            </div>
          </CardHeader>

          <CardContent className="pt-6 pb-8 px-6 md:px-8">
            {isProcessing ? (
              /* Beautiful Pulsating Premium Loader */
              <div className="flex flex-col items-center justify-center text-center p-8 py-16 gap-6 max-w-lg mx-auto">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Brain className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold tracking-tight">Neuron AI is reading your document...</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We are currently extracting text, analyzing core academic concepts, and styling your customized study guide. This usually takes 10-15 seconds.
                  </p>
                </div>

                <div className="w-full h-1 bg-muted rounded-full overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full animate-pulse w-full" />
                </div>

                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  Analyzing page contents. Please wait...
                </div>
              </div>
            ) : loading ? (
              /* Shimmering Skeleton Loader */
              <div className="space-y-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-5/6 bg-muted rounded" />
                </div>
                <div className="space-y-2.5 pt-4">
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-4/5 bg-muted rounded" />
                </div>
                <div className="space-y-2.5 pt-4">
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-5/6 bg-muted rounded" />
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center text-center p-8 mt-12 gap-3 text-red-500">
                <Brain className="h-10 w-10 opacity-70 animate-bounce" />
                <h3 className="font-bold text-foreground">Failed to Synthesize</h3>
                <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
                <Button onClick={() => fetchSummary(activeMode)} variant="outline" className="mt-2 text-xs">
                  Retry Connection
                </Button>
              </div>
            ) : (
              /* Main Markdown Output */
              <div className="prose prose-sm dark:prose-invert max-w-none">
                
                {/* Key Takeaways Section */}
                {keyPoints.length > 0 && (
                  <div className="mb-8 p-5 rounded-xl border border-purple-500/10 bg-purple-500/5/10 bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      Key Takeaways
                    </h4>
                    <ul className="space-y-2">
                      {keyPoints.map((point, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                          <Check className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rendered Summary body */}
                {renderMarkdown(summaryText)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT SIDE: Action Deck & History Timeline */}
      <div className="flex flex-col gap-6">
        
        {/* Action Panel */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pt-5 pb-3">
            <CardTitle className="text-sm font-bold">Study Utilities</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pb-5">
            <Button 
              onClick={handleCopy} 
              disabled={loading || !summaryText}
              variant="outline" 
              className="w-full text-xs font-semibold flex items-center justify-center gap-2 h-9"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copied Guide!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  Copy Study Sheet
                </>
              )}
            </Button>

            <Button 
              onClick={handleExport} 
              disabled={loading || !summaryText || exporting}
              variant="outline" 
              className="w-full text-xs font-semibold flex items-center justify-center gap-2 h-9"
            >
              <Download className="h-4 w-4 text-muted-foreground" />
              {exporting ? "Exporting..." : "Download Markdown (.md)"}
            </Button>

            <Button 
              onClick={() => fetchSummary(activeMode, true)} 
              disabled={loading}
              variant="outline" 
              className="w-full text-xs font-semibold flex items-center justify-center gap-2 h-9 border-dashed border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Force Regenerate AI
            </Button>
          </CardContent>
        </Card>

        {/* History Timeline */}
        <Card className="border border-border/80 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pt-5 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Summary History
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {history.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No history records found.
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="flex gap-3 border-l border-border pl-4 relative ml-2">
                    {/* Glowing point marker */}
                    <div className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-primary shadow-xs shadow-primary" />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground capitalize">
                        {item.mode} summary
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {new Date(item.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
