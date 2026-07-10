"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, 
  Sparkles, 
  Send, 
  RotateCw, 
  Bot, 
  User,
  Award,
  CheckCircle,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { evaluateConceptAction } from "@/actions/study-coach";

interface VivaStudyModeProps {
  documentId: string;
  documentTitle: string;
  topicName: string;
  onBack: () => void;
  onReward: (xp: number) => void;
}

interface VivaMessage {
  role: "ai" | "user";
  text: string;
  score?: number;
  feedback?: string;
  suggestions?: string[];
}

export function VivaStudyMode({ 
  documentId, 
  documentTitle, 
  topicName, 
  onBack,
  onReward
}: VivaStudyModeProps) {
  const [messages, setMessages] = useState<VivaMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(true);
  const [vivaFinished, setVivaFinished] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize viva with the first question from AI
  useEffect(() => {
    async function loadFirstQuestion() {
      setIsAiLoading(true);
      try {
        const response = await fetch("/api/summarize", {
          method: "POST",
          body: JSON.stringify({ 
            documentId,
            customPrompt: `Act as a rigorous university professor conducting an oral viva exam on the topic "${topicName || "General Study"}". Ask the student exactly one highly specific conceptual question to start the viva. Keep your response short and formal (maximum 3 sentences).` 
          })
        });
        
        const data = await response.json();
        if (data?.summary) {
          setMessages([
            {
              role: "ai",
              text: data.summary.trim()
            }
          ]);
        } else {
          throw new Error("API failed");
        }
      } catch {
        setMessages([
          {
            role: "ai",
            text: `Welcome to your oral viva on ${topicName || "this lecture content"}. To begin, explain the primary purpose and structural mechanism of this topic. What specific problem does it resolve?`
          }
        ]);
      } finally {
        setIsAiLoading(false);
      }
    }
    loadFirstQuestion();
  }, [documentId, topicName]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiLoading]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (inputText.trim().length < 10) {
      alert("Please provide a more substantial explanation.");
      return;
    }

    const studentAnswer = inputText.trim();
    setInputText("");
    setIsAiLoading(true);

    // Append user message
    setMessages(prev => [...prev, { role: "user", text: studentAnswer }]);

    try {
      const activeQuestion = messages[messages.length - 1]?.text || "";
      
      // 1. Run evaluation first to log score/XP
      const res = await evaluateConceptAction(documentId, activeQuestion, studentAnswer);
      let score = 70;
      let shortFeedback = "Good effort.";
      let tips: string[] = [];

      if (res.success && res.evaluation) {
        const evalFeedback = res.evaluation.feedback;
        score = evalFeedback.score;
        shortFeedback = `Score: ${score}/100. Strengths: ${evalFeedback.strengths[0] || "Accurate explanation."} Gaps: ${evalFeedback.weakAreas[0] || "None detected."}`;
        tips = evalFeedback.suggestions || [];
      }

      // Update the user message in list to append the evaluated score
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "user") {
          last.score = score;
          last.feedback = shortFeedback;
          last.suggestions = tips;
        }
        return next;
      });

      // 2. Fetch professor's response and next question
      // Max viva depth: finish after 3 rounds
      const roundCount = messages.filter(m => m.role === "user").length + 1;
      if (roundCount >= 3) {
        setVivaFinished(true);
        setMessages(prev => [...prev, {
          role: "ai",
          text: `Thank you. That concludes our oral viva exam for today. I have assessed your responses and compiled your scores into your academic coach history. Great work pushing your understanding limits!`
        }]);
        onReward(150); // Final viva completion XP bonus!
      } else {
        const conversationContext = messages.map(m => `${m.role === "ai" ? "Professor" : "Student"}: ${m.text}`).join("\n");
        const nextQRes = await fetch("/api/summarize", {
          method: "POST",
          body: JSON.stringify({
            documentId,
            customPrompt: `Review our ongoing oral viva dialogue:\n${conversationContext}\n\nStudent just answered: "${studentAnswer}".\nAct as the professor. Briefly correct or validate their answer in 2 sentences. Then, ask your next challenging follow-up question in the viva. Keep the total response under 4 sentences.`
          })
        });
        const nextQData = await nextQRes.json();
        
        setMessages(prev => [...prev, {
          role: "ai",
          text: nextQData?.summary?.trim() || "Let us move to the next conceptual block. Explain the alternative designs mentioned in the notes."
        }]);
      }

    } catch {
      setMessages(prev => [...prev, {
        role: "ai",
        text: "My apologies, I experienced a cognitive disconnect. Let us proceed. Tell me how you would apply this concept in a heavy load system."
      }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const getAverageScore = () => {
    const scoredUserMsgs = messages.filter(m => m.role === "user" && m.score !== undefined);
    if (scoredUserMsgs.length === 0) return 0;
    const sum = scoredUserMsgs.reduce((acc, curr) => acc + (curr.score || 0), 0);
    return Math.round(sum / scoredUserMsgs.length);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 h-[650px] max-h-[85vh]">
      
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
              AI Viva Oral Exam
            </h2>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Topic: {topicName || "General Study"} • Lecture: {documentTitle}
            </p>
          </div>
        </div>
        <span className="text-xs bg-amber-500/10 text-amber-400 font-bold px-3 py-1 rounded-xl flex gap-1 items-center shadow-sm">
          <Sparkles className="h-3 w-3 animate-pulse" />
          Viva Professor Mode
        </span>
      </div>

      {/* Main Conversation Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Left Side: Professor Chat panel */}
        <div className="lg:col-span-8 flex flex-col bg-card/40 border border-border/40 rounded-2xl overflow-hidden min-h-0">
          
          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => {
              const isAI = msg.role === "ai";
              return (
                <div key={idx} className={`flex gap-3 items-start ${isAI ? "" : "flex-row-reverse"}`}>
                  {/* Avatar */}
                  <div className={`p-2 rounded-xl shrink-0 ${isAI ? "bg-primary/10 text-primary" : "bg-indigo-500/10 text-indigo-400"}`}>
                    {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div className="flex flex-col gap-1.5 max-w-[80%]">
                    <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed border shadow-sm ${
                      isAI 
                        ? "bg-card border-border/30 text-foreground" 
                        : "bg-indigo-500 text-white border-transparent"
                    }`}>
                      {msg.text}
                    </div>

                    {/* Sub-Feedback block for user messages */}
                    {!isAI && msg.score !== undefined && (
                      <div className="p-3 bg-muted/40 rounded-xl border border-border/20 space-y-1.5 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex gap-1 items-center">
                            <TrendingUp className="h-3 w-3 text-indigo-400" />
                            AI Assessment
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            msg.score >= 85 
                              ? "bg-emerald-500/10 text-emerald-500" 
                              : msg.score >= 60 
                                ? "bg-orange-500/10 text-orange-500" 
                                : "bg-red-500/10 text-red-500"
                          }`}>
                            Grade: {msg.score}/100
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground/90 font-medium leading-relaxed">
                          {msg.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI Loading indicator */}
            {isAiLoading && (
              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="p-3 rounded-2xl bg-card border border-border/30 shadow-sm flex gap-1 items-center py-4 px-6">
                  <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Interactive Chat Input Area */}
          <div className="p-3 bg-card border-t border-border/30 flex gap-2 items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isAiLoading && !vivaFinished && handleSendMessage()}
              disabled={isAiLoading || vivaFinished}
              placeholder={vivaFinished ? "Viva completed!" : "Type your oral response details..."}
              className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold focus:border-primary focus:outline-none disabled:opacity-50"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isAiLoading || !inputText.trim() || vivaFinished}
              size="icon"
              className="rounded-xl shadow-md cursor-pointer shrink-0"
            >
              {isAiLoading ? <RotateCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

        </div>

        {/* Right Side: Professor Rubrics / Performance Report */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60 flex flex-col">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-xs font-black uppercase tracking-wider flex gap-1.5 items-center">
                <Award className="h-4 w-4 text-amber-500" />
                Professor Assessment rubrics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col justify-between gap-6">
              
              {/* Stats */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold">Total Viva Rounds:</span>
                  <span className="font-bold text-foreground">3 / 3</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold">Active Round:</span>
                  <span className="font-bold text-primary">
                    {vivaFinished ? "Concluded" : `Round ${messages.filter(m => m.role === "user").length + 1}`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-semibold">Estimated Viva GPA:</span>
                  <span className="font-bold text-foreground">{getAverageScore()}%</span>
                </div>
              </div>

              {/* Status card */}
              {vivaFinished ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2 animate-in zoom-in duration-300">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Viva Successfully Concluded!</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    You completed all exam rounds and earned a 150 XP completion badge bonus! Check your dashboard log.
                  </p>
                  <Button onClick={onBack} size="sm" className="w-full mt-2 rounded-lg font-bold">
                    Return to Hub
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/40 border border-border/20 text-center space-y-1.5">
                  <Bot className="h-5 w-5 text-primary mx-auto opacity-70" />
                  <h4 className="text-[11px] font-bold text-foreground/90 uppercase tracking-wider">Active Oral Assessment</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Write answers clearly and completely to prove process mechanisms to the reviewer.
                  </p>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
