"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BrainCircuit, 
  Send, 
  User, 
  Paperclip, 
  Loader2, 
  Plus, 
  Trash2, 
  Sparkles, 
  BookOpen, 
  Check, 
  Clock, 
  FileText, 
  Search, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Copy
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger, 
  DialogTitle, 
  DialogDescription, 
  DialogHeader 
} from "@/components/ui/dialog";
import { UploadZone } from "@/components/shared/upload-zone";

type Source = {
  id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

type Message = {
  role: "user" | "ai" | "system";
  content: string;
  sources?: Source[];
  metrics?: {
    speedMs: number;
    tokenEstimate: number;
  };
  followUps?: string[];
  feedback?: "like" | "dislike" | null;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Document = {
  id: string;
  title: string;
  file_type: string;
  file_url: string;
  upload_date: string;
};

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: "Hello! I'm **Neuron AI**, your personal study agent. 🎓\n\nI have direct access to your courses, folders, uploaded materials, and calendar reminders. Ask me anything about your notes, or say things like:\n- *'Summarize my Physics lecture notes.'*\n- *'What lectures do I have uploaded?'*\n- *'Add an exam reminder for Biology next Friday.'*",
      sources: []
    }
  ]);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  
  const [input, setInput] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Modal state for citation inspector
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  // Panel hover expand state
  const [leftExpanded, setLeftExpanded] = useState(false);
  const [rightExpanded, setRightExpanded] = useState(false);

  const handleFeedback = (index: number, type: 'like' | 'dislike') => {
    setMessages(prev => prev.map((msg, i) => {
      if (i === index) {
        return {
          ...msg,
          feedback: msg.feedback === type ? null : type
        };
      }
      return msg;
    }));
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchConversations = useCallback(async () => {
    try {
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = userData?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error("Error fetching conversations:", err instanceof Error ? err.message : String(err));
    }
  }, [supabase]);

  const fetchDocuments = useCallback(async () => {
    try {
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = userData?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_type, file_url, upload_date")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("upload_date", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching documents:", err instanceof Error ? err.message : String(err));
    }
  }, [supabase]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, messagesLoading]);

  // Load initial data
  useEffect(() => {
    fetchConversations();
    fetchDocuments();
  }, [fetchConversations, fetchDocuments]);

  interface MessageRow {
    role: string;
    content: string;
    sources: Source[] | null;
  }

  const selectConversation = async (convId: string) => {
    if (activeConversationId === convId) return;
    
    setActiveConversationId(convId);
    setMessagesLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("role, content, sources")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessages([
          {
            role: "ai",
            content: "Welcome to this chat session. Type a message below to begin tutoring!",
            sources: []
          }
        ]);
      } else {
        setMessages((data as unknown as MessageRow[]).map((m) => ({
          role: m.role as "user" | "ai" | "system",
          content: m.content,
          sources: m.sources || []
        })));
      }
    } catch (err) {
      console.error("Error loading chat messages:", err instanceof Error ? err.message : String(err));
    } finally {
      setMessagesLoading(false);
    }
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this chat session?")) return;

    try {
      const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", convId);

      if (error) throw error;

      if (activeConversationId === convId) {
        startNewChat();
      }
      
      fetchConversations();
    } catch (err) {
      console.error("Error deleting conversation:", err instanceof Error ? err.message : String(err));
    }
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([
      {
        role: "ai",
        content: "Hello! I'm **Neuron AI**, your personal study agent. 🎓\n\nI have direct access to your courses, folders, uploaded materials, and calendar reminders. Ask me anything about your notes, or say things like:\n- *'Summarize my Physics lecture notes.'*\n- *'What lectures do I have uploaded?'*\n- *'Add an exam reminder for Biology next Friday.'*",
        sources: []
      }
    ]);
  };

  const handleUploadComplete = (documentId: string, fileName: string) => {
    setIsDialogOpen(false);
    fetchDocuments(); // Refresh docs list
    
    // Auto-select the newly uploaded document
    setSelectedDocIds(prev => [...prev, documentId]);

    setMessages(prev => [
      ...prev,
      { 
        role: "system", 
        content: `Successfully uploaded and embedded "${fileName}"! This document has been added to your Active Focus list. I will automatically use its contents to ground my answers when you chat.` 
      }
    ]);
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId) 
        : [...prev, docId]
    );
  };

  const selectAllDocuments = () => {
    setSelectedDocIds(filteredDocuments.map(d => d.id));
  };

  const clearSelectedDocuments = () => {
    setSelectedDocIds([]);
  };

  const handleSend = async (e: React.FormEvent | string) => {
    if (e && typeof e !== "string") {
      e.preventDefault();
    }
    
    const messageText = typeof e === "string" ? e : input;
    if (!messageText.trim() || loading) return;

    if (typeof e !== "string") {
      setInput("");
    }
    
    setLoading(true);

    const userMsg: Message = { role: "user", content: messageText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          message: messageText,
          conversationId: activeConversationId,
          documentIds: selectedDocIds.length > 0 ? selectedDocIds : null
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // If a new conversation was created on the backend
      if (!activeConversationId && data.conversationId) {
        setActiveConversationId(data.conversationId);
        fetchConversations();
      }

      setMessages(prev => [
        ...prev,
        { 
          role: "ai" as const, 
          content: data.content,
          sources: data.sources || [],
          metrics: data.metrics,
          followUps: data.followUps || []
        }
      ]);
    } catch (err) {
      console.error("AI Chat failed:", err instanceof Error ? err.message : String(err));
      setMessages(prev => [
        ...prev,
        { 
          role: "ai" as const, 
          content: `⚠️ **AI Chat Connection Error**\n\nDetails: ${err instanceof Error ? err.message : 'Unknown error. Please check your developer console.'}`,
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Filter documents by search query
  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  // Markdown parser with citations [1], [2], etc.
  const parseCitationsAndInlineStyles = (raw: string, keyPrefix: string, sources: Source[]) => {
    const parts = raw.split("**");
    const boldElements: React.ReactNode[] = [];
    
    parts.forEach((part, index) => {
      const isBold = index % 2 === 1;
      const italicParts = part.split("*");
      const italicElements: React.ReactNode[] = [];
      
      italicParts.forEach((iPart, iIndex) => {
        const isItalic = iIndex % 2 === 1;
        const codeParts = iPart.split("`");
        const codeElements: React.ReactNode[] = [];
        
        codeParts.forEach((cPart, cIndex) => {
          const isCode = cIndex % 2 === 1;
          
          if (isCode) {
            codeElements.push(
              <code key={`${keyPrefix}-code-${index}-${iIndex}-${cIndex}`} className="bg-muted px-1 py-0.5 rounded font-mono text-[10px] text-foreground border border-border/40">
                {cPart}
              </code>
            );
          } else {
            // Find citations matching [1], [2], etc.
            const citationRegex = /\[(\d+)\]/g;
            let lastIdx = 0;
            let match;
            const segments: React.ReactNode[] = [];
            
            while ((match = citationRegex.exec(cPart)) !== null) {
              const matchIndex = match.index;
              const fullMatch = match[0];
              const numStr = match[1];
              const sourceIndex = parseInt(numStr, 10) - 1;
              
              if (matchIndex > lastIdx) {
                segments.push(cPart.substring(lastIdx, matchIndex));
              }
              
              const source = sources && sources[sourceIndex];
              if (source) {
                segments.push(
                  <sup key={`${keyPrefix}-cit-${index}-${iIndex}-${cIndex}-${matchIndex}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedSource(source)}
                      className="inline-flex items-center justify-center px-1.5 py-0.25 ml-0.5 text-[9px] font-bold rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer border border-primary/10 select-none shadow-3xs font-sans h-3.5"
                      title={`Source ${numStr}: ${source.document_title}`}
                    >
                      {numStr}
                    </button>
                  </sup>
                );
              } else {
                segments.push(fullMatch);
              }
              lastIdx = citationRegex.lastIndex;
            }
            
            if (lastIdx < cPart.length) {
              segments.push(cPart.substring(lastIdx));
            }
            
            codeElements.push(...segments);
          }
        });
        
        if (isItalic) {
          italicElements.push(
            <em key={`${keyPrefix}-em-${index}-${iIndex}`} className="italic text-foreground/90">
              {codeElements}
            </em>
          );
        } else {
          italicElements.push(...codeElements);
        }
      });
      
      if (isBold) {
        boldElements.push(
          <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-foreground">
            {italicElements}
          </strong>
        );
      } else {
        boldElements.push(...italicElements);
      }
    });
    
    return boldElements;
  };

  const renderMarkdown = (text: string, sources: Source[] = []) => {
    if (!text) return null;

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Heading 3
      if (trimmed.startsWith("###")) {
        elements.push(
          <h3 key={index} className="text-xs font-bold text-foreground mt-3 mb-1.5 tracking-tight flex items-center gap-1.5 border-b border-border/40 pb-0.5">
            {parseCitationsAndInlineStyles(trimmed.replace(/^###\s*/, ""), `h3-${index}`, sources)}
          </h3>
        );
      } 
      // Heading 2
      else if (trimmed.startsWith("##")) {
        elements.push(
          <h2 key={index} className="text-xs font-extrabold text-foreground mt-4 mb-2 tracking-tight border-b border-border/40 pb-0.5">
            {parseCitationsAndInlineStyles(trimmed.replace(/^##\s*/, ""), `h2-${index}`, sources)}
          </h2>
        );
      }
      // Heading 1
      else if (trimmed.startsWith("#")) {
        elements.push(
          <h1 key={index} className="text-sm font-black text-foreground mt-5 mb-2.5 tracking-tight border-b border-border pb-1">
            {parseCitationsAndInlineStyles(trimmed.replace(/^#\s*/, ""), `h1-${index}`, sources)}
          </h1>
        );
      }
      // Bullet Items
      else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        elements.push(
          <li key={index} className="text-xs text-muted-foreground ml-4 pl-1 list-disc leading-relaxed mt-1">
            {parseCitationsAndInlineStyles(trimmed.replace(/^[-\*]\s*/, ""), `bullet-${index}`, sources)}
          </li>
        );
      }
      // Empty Lines
      else if (!trimmed) {
        elements.push(<div key={index} className="h-1.5" />);
      } 
      // General Paragraph
      else {
        elements.push(
          <p key={index} className="text-xs text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap">
            {parseCitationsAndInlineStyles(trimmed, `p-${index}`, sources)}
          </p>
        );
      }
    });

    return <div className="space-y-0.5">{elements}</div>;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] px-4 md:px-0 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between shrink-0 border-b border-border/40 pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-1.5 select-none bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
            AI Study Copilot <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Semantic study assistant grounded dynamically by your course files and lectures.
          </p>
        </div>
      </div>

      {/* ── 3-Column Workspace ────────────────────────────────────────────────── */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

        {/* LEFT: Chat History — hover-expand */}
        <div
          onMouseEnter={() => setLeftExpanded(true)}
          onMouseLeave={() => setLeftExpanded(false)}
          style={{ width: leftExpanded ? '240px' : '150px', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="group/left shrink-0 hidden lg:flex flex-col overflow-hidden border border-border/60 rounded-xl bg-card/45 shadow-2xs z-20 backdrop-blur-xs"
        >
          {/* New Chat button */}
          <div className="p-2 border-b border-border/20 shrink-0">
            <Button
              onClick={startNewChat}
              size="sm"
              className="w-full h-8 text-xs font-medium gap-1.5 rounded-lg cursor-pointer items-center justify-center flex bg-primary hover:bg-primary/95 text-primary-foreground transition-all shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </Button>
          </div>

          {/* History label */}
          <div className="px-3 pt-3 pb-1 shrink-0 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Chat History
            </span>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto px-1.5 pb-3 space-y-0.5 scrollbar-none">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-muted-foreground/40 text-xs">
                <MessageSquare className="h-4 w-4 mb-1.5 opacity-30 shrink-0" />
                <span className="text-[10px] text-center whitespace-nowrap">No conversations.</span>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    title={conv.title}
                    className={`flex items-center justify-between p-2 rounded-lg border group/conv text-[11px] transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-secondary border-border/60 text-foreground font-medium shadow-3xs' 
                        : 'hover:bg-card/60 border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground/30'}`} />
                      <span className="truncate whitespace-nowrap">{conv.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="opacity-0 group-hover/conv:opacity-100 hover:bg-secondary text-muted-foreground hover:text-destructive p-0.5 rounded transition-all cursor-pointer shrink-0 ml-1 border border-transparent hover:border-border/30"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER: Chat */}
        <Card className="flex-1 flex flex-col overflow-hidden bg-card/40 border border-border/60 shadow-2xs rounded-xl min-w-0 backdrop-blur-xs">
          {/* Chat header */}
          <div className="px-4 py-2.5 border-b border-border/40 bg-card/25 shrink-0 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 truncate">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span className="text-xs font-semibold text-foreground truncate select-none">
                {activeConversationId
                  ? conversations.find(c => c.id === activeConversationId)?.title || "Active Discussion"
                  : "New Study Discussion"
                }
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedDocIds.length > 0 && (
                <div className="flex items-center gap-1.5 text-[9px] text-primary font-semibold bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  <BookOpen className="h-3 w-3" />
                  <span>{selectedDocIds.length} file{selectedDocIds.length > 1 ? "s" : ""} active</span>
                </div>
              )}
              {/* Mobile new chat */}
              <Button size="icon" variant="outline" className="lg:hidden h-7 w-7 rounded-lg cursor-pointer border-border/80 hover:bg-secondary/60" onClick={startNewChat} title="New chat">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 scrollbar-thin">
            {messagesLoading ? (
              <div className="space-y-4 py-8">
                <div className="flex gap-4">
                  <div className="h-7 w-7 rounded bg-muted animate-pulse shrink-0" />
                  <div className="bg-muted/20 h-12 w-[60%] rounded-xl animate-pulse" />
                </div>
                <div className="flex gap-4 flex-row-reverse">
                  <div className="h-7 w-7 rounded bg-muted animate-pulse shrink-0" />
                  <div className="bg-muted/20 h-8 w-[40%] rounded-xl animate-pulse" />
                </div>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isSystem = msg.role === "system";
                const isLastAi = !isUser && !isSystem && i === messages.length - 1;
                return (
                  <div key={i} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} animate-fade-in`}>
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                      isUser ? "bg-secondary border-border/60 text-foreground shadow-3xs"
                      : isSystem ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                      : "bg-secondary/80 border-border/60 text-muted-foreground shadow-3xs"
                    }`}>
                      {isUser ? <User className="h-3.5 w-3.5" /> : isSystem ? <Paperclip className="h-3 w-3" /> : <BrainCircuit className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="max-w-[85%] sm:max-w-[78%] flex flex-col gap-1">
                      <div className={`rounded-xl p-3.5 text-xs shadow-2xs leading-relaxed transition-all ${
                        isUser ? "bg-primary text-primary-foreground font-medium whitespace-pre-wrap"
                        : isSystem ? "bg-secondary/35 border border-dashed border-border/80 text-muted-foreground text-[10px] font-mono whitespace-pre-wrap"
                        : "bg-card/75 border border-border/50 text-foreground"
                      }`}>
                        {isUser ? msg.content : renderMarkdown(msg.content, msg.sources)}
                        {!isUser && !isSystem && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3.5 pt-3 border-t border-border/20 space-y-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 block">Source references:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((src, srcIdx) => (
                                <button key={srcIdx} type="button" onClick={() => setSelectedSource(src)}
                                  className="inline-flex items-center gap-1.5 bg-secondary/80 hover:bg-secondary border border-border/40 rounded-md px-2 py-0.5 text-[10px] font-medium text-foreground transition-all cursor-pointer hover:border-primary/10">
                                  <span className="h-3.5 w-3.5 rounded bg-primary/10 text-primary font-bold flex items-center justify-center text-[8px]">{srcIdx + 1}</span>
                                  <span className="truncate max-w-[100px]">{src.document_title}</span>
                                  <span className="text-[8px] text-muted-foreground">{(src.similarity * 100).toFixed(0)}%</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {!isUser && !isSystem && (
                        <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground mt-1 gap-2">
                          <div className="flex items-center gap-2">
                            {msg.metrics && (
                              <span className="flex items-center gap-0.5 text-muted-foreground/60 font-medium">
                                <Clock className="h-2.5 w-2.5 text-muted-foreground/45" />
                                {(msg.metrics.speedMs / 1000).toFixed(1)}s
                              </span>
                            )}
                            {msg.metrics && <span className="text-muted-foreground/35">•</span>}
                            <span className="text-[8px] text-emerald-400 font-bold bg-emerald-500/5 px-1.5 py-0.25 rounded border border-emerald-500/10">RAG ACTIVE</span>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleCopy(msg.content, i)}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Copy response"
                            >
                              {copiedIndex === i ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => handleFeedback(i, "like")}
                              className={`p-1 rounded hover:bg-secondary transition-colors cursor-pointer ${
                                msg.feedback === "like"
                                  ? "text-emerald-400"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              title="Good response"
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleFeedback(i, "dislike")}
                              className={`p-1 rounded hover:bg-secondary transition-colors cursor-pointer ${
                                msg.feedback === "dislike"
                                  ? "text-rose-400"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              title="Bad response"
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                      {isLastAi && msg.followUps && msg.followUps.length > 0 && !loading && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground pl-1">
                            <span>Recommended follow-ups:</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {msg.followUps.map((q, idx) => (
                              <button key={idx} onClick={() => handleSend(q)}
                                className="w-full text-left bg-secondary/35 hover:bg-primary/5 hover:text-primary hover:border-primary/20 border border-border/40 text-[11px] rounded-lg p-2 transition-all text-muted-foreground flex items-center justify-between group cursor-pointer font-medium">
                                <span>{q}</span>
                                <Plus className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-all shrink-0 ml-2" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {loading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border border-border bg-secondary shadow-3xs">
                  <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-card/75 border border-border/60 rounded-xl p-3 text-xs max-w-[80%] flex items-center gap-2 text-muted-foreground shadow-2xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Reading embeddings and searching context...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </CardContent>

          {/* Input */}
          <div className="p-3 border-t border-border/40 bg-card/25 shrink-0">
            <form className="flex gap-2 max-w-5xl mx-auto" onSubmit={handleSend}>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger render={<Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9 border-border/80 hover:border-primary hover:text-primary transition-all cursor-pointer rounded-lg bg-secondary/65 text-muted-foreground hover:text-foreground" title="Upload Study Notes Context" />}>
                  <Paperclip className="h-3.5 w-3.5" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl bg-card border border-border/80 shadow-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload Study Document</DialogTitle>
                    <DialogDescription>Upload lecture transcripts, textbooks, study guide notes (PDF, TXT, DOCX) to extract semantically search-enabled embeddings instantly.</DialogDescription>
                  </DialogHeader>
                  <div className="mt-3"><UploadZone onUploadComplete={handleUploadComplete} /></div>
                </DialogContent>
              </Dialog>
              <Input
                placeholder={selectedDocIds.length > 0 ? `Ask about ${selectedDocIds.length} selected document(s)...` : "Ask study questions, or say: 'What documents do I have uploaded?'"}
                className="flex-1 text-xs h-9 bg-secondary/35 border-border/80 focus-visible:ring-primary focus-visible:bg-card transition-all rounded-lg"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0 cursor-pointer shadow-xs bg-primary hover:bg-primary/95 text-primary-foreground rounded-lg" disabled={loading || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </Card>

        {/* RIGHT: Study Focus — hover-expand */}
        <div
          onMouseEnter={() => setRightExpanded(true)}
          onMouseLeave={() => setRightExpanded(false)}
          style={{ width: rightExpanded ? '280px' : '150px', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="group/right shrink-0 hidden lg:flex flex-col overflow-hidden border border-border/60 rounded-xl bg-card/45 shadow-2xs z-20 backdrop-blur-xs"
        >
          {/* Header */}
          <div className="px-2 pt-3 pb-2 border-b border-border/20 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between h-8">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <h3 className="font-bold text-[9px] uppercase tracking-widest text-muted-foreground whitespace-nowrap select-none">Study Focus</h3>
              </div>
              {selectedDocIds.length > 0 && (
                <span className="bg-primary/5 text-primary border border-primary/10 text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                  {selectedDocIds.length}
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input placeholder="Search files..." className="pl-7 text-[11px] h-7 bg-secondary/35 border-border/80 focus-visible:ring-primary rounded-md" value={docSearchQuery} onChange={(e) => setDocSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold px-0.5 pt-0.5">
              <span className="whitespace-nowrap">Select to focus:</span>
              <div className="flex items-center gap-1.5">
                <button onClick={selectAllDocuments} className="text-primary hover:underline cursor-pointer">All</button>
                <span className="text-border/40">•</span>
                <button onClick={clearSelectedDocuments} className="hover:underline cursor-pointer">Clear</button>
              </div>
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5 scrollbar-none">
            {filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-muted-foreground/40">
                <FileText className="h-4 w-4 mb-1.5 opacity-30 shrink-0" />
                <span className="text-[10px] text-center whitespace-nowrap">No documents found.</span>
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <div key={doc.id} onClick={() => toggleDocumentSelection(doc.id)}
                    title={doc.title}
                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-primary/5 border-primary/30 text-foreground font-semibold shadow-3xs' 
                        : 'hover:bg-card/65 border-transparent text-muted-foreground hover:text-foreground'
                    }`}>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground/65'}`} />
                      <span className="truncate whitespace-nowrap">{doc.title}</span>
                    </div>
                    <div className={`h-3.5 w-3.5 rounded flex items-center justify-center border transition-all shrink-0 ml-1.5 ${
                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border/80 bg-secondary/80'
                    }`}>
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Upload button */}
          <div className="p-2 border-t border-border/20 shrink-0">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="w-full h-8 text-[11px] font-semibold gap-1.5 border-border/80 hover:border-primary hover:text-primary transition-all cursor-pointer flex items-center justify-center bg-secondary/65 text-muted-foreground hover:text-foreground rounded-lg" />}>
                <Paperclip className="h-3 w-3" /> Upload File
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl bg-card border border-border/80 shadow-2xl">
                <DialogHeader>
                  <DialogTitle>Upload Study Document</DialogTitle>
                  <DialogDescription>Upload lecture transcripts, textbooks, study guide notes (PDF, TXT, DOCX).</DialogDescription>
                </DialogHeader>
                <div className="mt-3"><UploadZone onUploadComplete={handleUploadComplete} /></div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

      </div>

      {/* Citation Inspector Dialog */}
      <Dialog open={!!selectedSource} onOpenChange={(open) => !open && setSelectedSource(null)}>
        <DialogContent className="max-w-2xl bg-card border border-border/80 shadow-2xl rounded-xl">
          {selectedSource && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
                  <div className="h-8 w-8 bg-primary/5 rounded-lg flex items-center justify-center text-primary border border-primary/10">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <DialogTitle className="text-xs font-semibold text-foreground truncate pr-4">{selectedSource.document_title}</DialogTitle>
                    <DialogDescription className="text-[9px] font-semibold text-muted-foreground mt-0.5">
                      Chunk Index: {selectedSource.chunk_index} • Match score: {(selectedSource.similarity * 100).toFixed(0)}%
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="mt-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block select-none">Retrieved Grounding Context Segment:</span>
                <div className="bg-secondary/35 border border-border/50 rounded-xl p-3.5 max-h-80 overflow-y-auto scrollbar-thin">
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedSource.content}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/20 flex justify-end">
                <Button onClick={() => setSelectedSource(null)} size="sm" className="text-xs font-semibold px-3 h-8 cursor-pointer bg-primary text-primary-foreground rounded-lg">Dismiss Context</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
