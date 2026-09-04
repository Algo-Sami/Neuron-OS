"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
  Copy,
  X,
  PanelLeftClose,
  PanelLeft,
  Folder,
  Upload,
  ArrowUpRight,
  ArrowUp,
  HelpCircle,
  Lightbulb,
  CheckCircle2
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription, 
  DialogHeader 
} from "@/components/ui/dialog";

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

type Subject = {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
};

type Document = {
  id: string;
  title: string;
  file_type: string;
  file_url: string;
  upload_date: string;
  subject_id?: string | null;
};

const MAX_REFERENCES = 5;

const PROMPT_SUGGESTIONS = [
  {
    icon: Lightbulb,
    title: "Summarize key concepts",
    desc: "Extract core topics & exam takeaways from your course notes.",
    prompt: "Can you summarize the most important core concepts from my study notes?"
  },
  {
    icon: CheckCircle2,
    title: "Practice quiz",
    desc: "Generate 5 multiple-choice questions to test your knowledge.",
    prompt: "Generate a 5-question multiple choice practice quiz with answer explanations."
  },
  {
    icon: BookOpen,
    title: "Explain with analogies",
    desc: "Break down difficult academic theories into simple terms.",
    prompt: "Explain the hardest topic in my uploaded notes using simple analogies."
  },
  {
    icon: Paperclip,
    title: "Reference study files",
    desc: "Attach your lecture notes to focus answers on specific material.",
    action: "open_references"
  }
];

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  
  // Reference modal state
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  
  // UI states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Modal state for citation inspector
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

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
  const inputRef = useRef<HTMLInputElement>(null);
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
        .select("id, title, file_type, file_url, upload_date, subject_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("upload_date", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching documents:", err instanceof Error ? err.message : String(err));
    }
  }, [supabase]);

  const fetchSubjects = useCallback(async () => {
    try {
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = userData?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code, color")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      setSubjects(data || []);
    } catch (err) {
      console.error("Error fetching subjects:", err instanceof Error ? err.message : String(err));
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
    fetchSubjects();
  }, [fetchConversations, fetchDocuments, fetchSubjects]);

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
        setMessages([]);
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
    
    if (!confirm("Delete this chat discussion?")) return;

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
    setMessages([]);
    setSelectedDocIds([]);
    setInput("");
    inputRef.current?.focus();
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds(prev => {
      if (prev.includes(docId)) {
        return prev.filter(id => id !== docId);
      }
      if (prev.length >= MAX_REFERENCES) {
        return prev;
      }
      return [...prev, docId];
    });
  };

  const removeReference = (docId: string) => {
    setSelectedDocIds(prev => prev.filter(id => id !== docId));
  };

  const clearSelectedDocuments = () => {
    setSelectedDocIds([]);
  };

  const handleSend = async (e?: React.FormEvent | string) => {
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
          referenceDocumentIds: selectedDocIds.length > 0 ? selectedDocIds : null,
          documentIds: selectedDocIds.length > 0 ? selectedDocIds : null
        })
      });

      const data = await (async () => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(
            res.status === 401
              ? 'Session expired. Please refresh the page and log in again.'
              : `Server returned unexpected response (HTTP ${res.status}). Please try again.`
          );
        }
        return res.json();
      })();
      if (data.error) throw new Error(data.error);

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

  // Filter documents for the reference selector modal
  const filteredModalDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = !docSearchQuery.trim() || 
        doc.title.toLowerCase().includes(docSearchQuery.toLowerCase());
      
      const matchesSubject = selectedSubjectFilter === "all" || 
        (selectedSubjectFilter === "unassigned" && !doc.subject_id) ||
        doc.subject_id === selectedSubjectFilter;

      return matchesSearch && matchesSubject;
    });
  }, [documents, docSearchQuery, selectedSubjectFilter]);

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
              <code key={`${keyPrefix}-code-${index}-${iIndex}-${cIndex}`} className="bg-[#f1f3f5] px-1.5 py-0.5 rounded font-mono text-[11px] text-[#1e293b] border border-[#e2e8f0]">
                {cPart}
              </code>
            );
          } else {
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
                      className="inline-flex items-center justify-center px-1.5 py-0.5 ml-0.5 text-[10px] font-bold rounded bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all cursor-pointer border border-blue-200 select-none shadow-xs"
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
            <em key={`${keyPrefix}-em-${index}-${iIndex}`} className="italic text-[#334155]">
              {codeElements}
            </em>
          );
        } else {
          italicElements.push(...codeElements);
        }
      });
      
      if (isBold) {
        boldElements.push(
          <strong key={`${keyPrefix}-bold-${index}`} className="font-semibold text-[#0f172a]">
            {italicElements}
          </strong>
        );
      } else {
        boldElements.push(...italicElements);
      }
    });
    
    return boldElements;
  };

  const renderMarkdown = (content: string, sources: Source[] = []) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Headers
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h4 key={index} className="text-xs font-semibold text-[#0f172a] mt-3 mb-1 tracking-tight">
            {parseCitationsAndInlineStyles(trimmed.replace("### ", ""), `h4-${index}`, sources)}
          </h4>
        );
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <h3 key={index} className="text-sm font-semibold text-[#0f172a] mt-3.5 mb-1.5 tracking-tight border-b border-[#e2e8f0] pb-1">
            {parseCitationsAndInlineStyles(trimmed.replace("## ", ""), `h3-${index}`, sources)}
          </h3>
        );
      } else if (trimmed.startsWith("# ")) {
        elements.push(
          <h2 key={index} className="text-base font-bold text-[#0f172a] mt-4 mb-2 tracking-tight border-b border-[#e2e8f0] pb-1">
            {parseCitationsAndInlineStyles(trimmed.replace("# ", ""), `h2-${index}`, sources)}
          </h2>
        );
      }
      // Bullet items
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <li key={index} className="text-[13px] text-[#334155] ml-4 list-disc my-1 leading-relaxed">
            {parseCitationsAndInlineStyles(trimmed.replace(/^[-\*]\s*/, ""), `bullet-${index}`, sources)}
          </li>
        );
      }
      // Empty Lines
      else if (!trimmed) {
        elements.push(<div key={index} className="h-2" />);
      } 
      // General Paragraph
      else {
        elements.push(
          <p key={index} className="text-[13px] text-[#334155] leading-relaxed mt-1 whitespace-pre-wrap">
            {parseCitationsAndInlineStyles(trimmed, `p-${index}`, sources)}
          </p>
        );
      }
    });

    return <div className="space-y-0.5">{elements}</div>;
  };

  const activeConv = conversations.find(c => c.id === activeConversationId);

  return (
    <div 
      className="flex h-full w-full overflow-hidden bg-[#ffffff] select-none"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", Inter, system-ui, sans-serif' }}
    >
      {/* ── Left Sidebar (ChatGPT-Style Chat History) ────────────────────────── */}
      {sidebarOpen && (
        <aside className="w-64 shrink-0 flex flex-col border-r border-[#e2e8f0] bg-[#f8fafc] select-none">
          {/* New Chat Button */}
          <div className="p-3 border-b border-[#e2e8f0]">
            <Button
              onClick={startNewChat}
              variant="outline"
              className="w-full h-9 text-xs font-semibold gap-2 rounded-lg cursor-pointer flex items-center justify-center border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#1e293b] shadow-2xs transition-all"
            >
              <Plus className="h-4 w-4 text-blue-600" />
              New Chat
            </Button>
          </div>

          {/* Chat List Header */}
          <div className="px-3 pt-3 pb-1.5 flex items-center justify-between text-[#64748b]">
            <span className="text-[11px] font-semibold tracking-wider uppercase">
              Recent Chats
            </span>
            <span className="text-[11px] font-medium bg-[#e2e8f0] px-1.5 py-0.25 rounded-md">
              {conversations.length}
            </span>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1 scrollbar-thin">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8] text-center px-3">
                <MessageSquare className="h-7 w-7 mb-2 opacity-40" />
                <p className="text-xs font-medium">No previous chats</p>
                <p className="text-[11px] text-[#94a3b8] mt-1">Start a discussion to ask questions about your study notes.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    title={conv.title}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all cursor-pointer group ${
                      isActive 
                        ? 'bg-[#e2e8f0] text-[#0f172a] font-semibold shadow-2xs' 
                        : 'hover:bg-[#f1f5f9] text-[#475569] hover:text-[#0f172a]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-[#94a3b8]'}`} />
                      <span className="truncate">{conv.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:bg-white text-[#94a3b8] hover:text-red-600 p-1 rounded transition-all cursor-pointer shrink-0 ml-1 border border-transparent hover:border-[#cbd5e1]"
                      title="Delete chat"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* ── Main Conversation Area (ChatGPT Style) ───────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        
        {/* Top Header Bar */}
        <header className="h-12 border-b border-[#e2e8f0] px-4 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] cursor-pointer rounded-lg"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-semibold text-[#0f172a] truncate">
                {activeConv ? activeConv.title : "Neuron AI Assistant"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedDocIds.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                <BookOpen className="h-3 w-3" />
                <span>{selectedDocIds.length} reference{selectedDocIds.length > 1 ? "s" : ""} attached</span>
              </span>
            )}
            
            {/* Quick New Chat button on mobile or when sidebar is collapsed */}
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewChat}
                className="h-8 text-xs font-medium gap-1 text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9]"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            )}
          </div>
        </header>

        {/* Conversation Stream (Centered max-w-3xl) */}
        <main className={`flex-1 px-4 scrollbar-thin ${messages.length === 0 ? "overflow-hidden flex flex-col justify-center py-2" : "overflow-y-auto py-6"}`}>
          <div className={`max-w-3xl mx-auto w-full ${messages.length === 0 ? "flex-1 flex flex-col justify-center items-center" : "space-y-6"}`}>
            
            {/* Empty State / Welcome Screen */}
            {messages.length === 0 && !messagesLoading && (
              <div className="w-full flex flex-col items-center text-center animate-fade-in my-auto py-2">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs mb-3">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-[#0f172a] tracking-tight">
                  How can I help with your studies today?
                </h2>
                <p className="text-xs text-[#64748b] max-w-md mt-1 mb-5">
                  Ask questions across all your course notes, or attach specific lecture files to get focused answers and practice quizzes.
                </p>

                {/* Prompt Suggestion Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left">
                  {PROMPT_SUGGESTIONS.map((s, idx) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (s.action === "open_references") {
                            setIsReferenceModalOpen(true);
                          } else if (s.prompt) {
                            handleSend(s.prompt);
                          }
                        }}
                        className="p-2.5 rounded-xl border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all cursor-pointer text-left shadow-2xs group flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="h-5 w-5 rounded-md bg-[#f1f5f9] group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center text-[#64748b] transition-colors">
                            <Icon className="h-3 w-3" />
                          </div>
                          <span className="text-xs font-semibold text-[#1e293b] group-hover:text-blue-700 transition-colors">
                            {s.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748b] leading-tight">
                          {s.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages Loading Spinner */}
            {messagesLoading && (
              <div className="space-y-4 py-8">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-xl bg-[#f1f5f9] animate-pulse shrink-0" />
                  <div className="bg-[#f1f5f9] h-14 w-2/3 rounded-2xl animate-pulse" />
                </div>
                <div className="flex gap-3 flex-row-reverse">
                  <div className="h-8 w-8 rounded-xl bg-[#f1f5f9] animate-pulse shrink-0" />
                  <div className="bg-[#f1f5f9] h-10 w-1/2 rounded-2xl animate-pulse" />
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isSystem = msg.role === "system";
              const isLastAi = !isUser && !isSystem && i === messages.length - 1;

              return (
                <div key={i} className={`flex gap-3.5 ${isUser ? "flex-row-reverse" : ""} animate-fade-in`}>
                  {/* Avatar */}
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                    isUser 
                      ? "bg-[#1e293b] border-[#0f172a] text-white shadow-xs"
                      : isSystem 
                      ? "bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b]"
                      : "bg-blue-50 border-blue-200 text-blue-600 shadow-xs"
                  }`}>
                    {isUser ? <User className="h-4 w-4" /> : isSystem ? <Paperclip className="h-3.5 w-3.5" /> : <BrainCircuit className="h-4 w-4" />}
                  </div>

                  {/* Message Bubble & Meta */}
                  <div className={`max-w-[85%] sm:max-w-[82%] flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
                    <div className={`rounded-2xl p-4 text-[13px] leading-relaxed transition-all shadow-xs ${
                      isUser 
                        ? "bg-[#0f172a] text-white font-normal whitespace-pre-wrap rounded-tr-xs"
                        : isSystem 
                        ? "bg-[#f8fafc] border border-dashed border-[#cbd5e1] text-[#64748b] text-xs font-mono whitespace-pre-wrap rounded-tl-xs"
                        : "bg-white border border-[#e2e8f0] text-[#0f172a] rounded-tl-xs w-full"
                    }`}>
                      {isUser ? msg.content : renderMarkdown(msg.content, msg.sources)}

                      {/* Grounded References / Citations */}
                      {!isUser && !isSystem && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-[#e2e8f0] space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block select-none">
                            Verified Source Grounding:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, srcIdx) => (
                              <button
                                key={srcIdx}
                                type="button"
                                onClick={() => setSelectedSource(src)}
                                className="inline-flex items-center gap-1.5 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-lg px-2.5 py-1 text-xs font-medium text-[#1e293b] transition-all cursor-pointer shadow-2xs"
                              >
                                <span className="h-4 w-4 rounded bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                                  {srcIdx + 1}
                                </span>
                                <span className="truncate max-w-[150px]">{src.document_title}</span>
                                <span className="text-[10px] text-[#64748b]">{(src.similarity * 100).toFixed(0)}% match</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions for Assistant response */}
                    {!isUser && !isSystem && (
                      <div className="flex items-center justify-between w-full px-1 text-[11px] text-[#64748b] gap-2">
                        <div className="flex items-center gap-2">
                          {msg.metrics && (
                            <span className="flex items-center gap-0.5 text-[#94a3b8] font-medium">
                              <Clock className="h-3 w-3 text-[#94a3b8]" />
                              {(msg.metrics.speedMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.25 rounded border border-emerald-200">
                            GROUNDED RAG
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(msg.content, i)}
                            className="p-1.5 rounded-md hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
                            title="Copy response"
                          >
                            {copiedIndex === i ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleFeedback(i, "like")}
                            className={`p-1.5 rounded-md hover:bg-[#f1f5f9] transition-colors cursor-pointer ${
                              msg.feedback === "like"
                                ? "text-emerald-600 bg-emerald-50"
                                : "text-[#64748b] hover:text-[#0f172a]"
                            }`}
                            title="Good response"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(i, "dislike")}
                            className={`p-1.5 rounded-md hover:bg-[#f1f5f9] transition-colors cursor-pointer ${
                              msg.feedback === "dislike"
                                ? "text-red-600 bg-red-50"
                                : "text-[#64748b] hover:text-[#0f172a]"
                            }`}
                            title="Bad response"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Follow-up question chips */}
                    {isLastAi && msg.followUps && msg.followUps.length > 0 && !loading && (
                      <div className="mt-2 space-y-1.5 w-full">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] pl-1">
                          Suggested follow-ups:
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {msg.followUps.map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSend(q)}
                              className="w-full text-left bg-white hover:bg-[#f8fafc] hover:border-blue-300 border border-[#e2e8f0] text-xs rounded-xl p-2.5 transition-all text-[#334155] hover:text-blue-700 flex items-center justify-between group cursor-pointer font-medium shadow-2xs"
                            >
                              <span>{q}</span>
                              <Plus className="h-3.5 w-3.5 text-[#94a3b8] group-hover:text-blue-600 transition-all shrink-0 ml-2" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Active AI Processing Indicator */}
            {loading && (
              <div className="flex gap-3.5 animate-fade-in">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border border-blue-200 bg-blue-50 text-blue-600 shadow-xs">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 text-xs max-w-[80%] flex items-center gap-2.5 text-[#475569] shadow-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-[#475569]">
                    Synthesizing notes and generating answer...
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </main>

        {/* ── Prompt Bar (Exact ChatGPT Capsule Look) ────────────────────── */}
        <footer className="w-full max-w-[768px] mx-auto px-4 pb-4 pt-1 shrink-0 bg-transparent">
          {/* Context Pills Bar (if references attached) */}
          {selectedDocIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 mb-2 animate-fade-in">
              <span className="text-[11px] text-[#64748b] font-medium flex items-center gap-1 mr-1 select-none">
                <Paperclip className="h-3 w-3 text-blue-600" />
                References ({selectedDocIds.length}/{MAX_REFERENCES}):
              </span>
              {selectedDocIds.map(id => {
                const doc = documents.find(d => d.id === id);
                const subj = subjects.find(s => s.id === doc?.subject_id);
                return (
                  <span 
                    key={id} 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-[#0f172a] border border-[#e2e8f0] shadow-2xs group"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-blue-600" />
                    <span className="truncate max-w-[140px]">{doc?.title || "Document"}</span>
                    {subj && (
                      <span className="text-[10px] text-[#64748b] border-l border-[#e2e8f0] pl-1.5">
                        {subj.code || subj.name}
                      </span>
                    )}
                    <button 
                      type="button" 
                      onClick={() => removeReference(id)} 
                      className="hover:text-red-600 text-[#94a3b8] hover:opacity-100 transition-colors ml-0.5 cursor-pointer" 
                      title="Remove reference"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              {selectedDocIds.length < MAX_REFERENCES && (
                <button 
                  type="button" 
                  onClick={() => setIsReferenceModalOpen(true)} 
                  className="inline-flex items-center gap-1 text-[11px] text-[#64748b] hover:text-[#0f172a] font-medium px-2 py-0.5 rounded-full hover:bg-[#f1f5f9] transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add more
                </button>
              )}
              <button 
                type="button" 
                onClick={clearSelectedDocuments} 
                className="text-[11px] text-[#94a3b8] hover:text-[#475569] hover:underline ml-auto cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* ChatGPT Capsule Input Box */}
          <form 
            onSubmit={handleSend}
            className="relative flex items-center gap-2 rounded-full bg-[#f4f4f4] hover:bg-[#efefef] focus-within:bg-[#f4f4f4] focus-within:shadow-sm border border-transparent focus-within:border-[#e5e5e5] px-3 py-1.5 transition-all min-h-[52px]"
          >
            {/* Left '+' Attachment Trigger (Exact ChatGPT Style) */}
            <button
              type="button"
              onClick={() => setIsReferenceModalOpen(true)}
              className="h-8 w-8 rounded-full flex items-center justify-center text-[#5d5d5d] hover:text-[#0d0d0d] hover:bg-[#e0e0e0] transition-colors cursor-pointer shrink-0 relative"
              title="Attach study reference files"
            >
              <Plus className="h-4.5 w-4.5 stroke-[2.2]" />
              {selectedDocIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center">
                  {selectedDocIds.length}
                </span>
              )}
            </button>

            {/* Middle Text Input */}
            <Input
              ref={inputRef}
              placeholder={
                selectedDocIds.length > 0 
                  ? `Ask about ${selectedDocIds.length} attached reference(s)...` 
                  : "Message Neuron AI..."
              }
              className="flex-1 text-[14px] border-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[#8e8e8e] h-9 text-[#0d0d0d] px-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />

            {/* Right Options & Send Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Reference Pill Button */}
              <button
                type="button"
                onClick={() => setIsReferenceModalOpen(true)}
                className="h-7 px-2.5 rounded-full text-xs font-medium gap-1 text-[#64748b] hover:text-[#0f172a] hover:bg-[#e4e4e4] transition-all cursor-pointer flex items-center"
                title="Manage reference documents"
              >
                <Paperclip className="h-3 w-3 text-[#64748b]" />
                <span className="text-[11px] font-medium hidden sm:inline">
                  {selectedDocIds.length > 0 ? `${selectedDocIds.length} Ref` : "Reference"}
                </span>
              </button>

              {/* Circular Black Send Button (Exact ChatGPT Style) */}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="h-8 w-8 rounded-full bg-[#0d0d0d] hover:bg-[#2f2f2f] text-white flex items-center justify-center transition-all cursor-pointer disabled:bg-[#e5e5e5] disabled:text-[#a0a0a0] disabled:cursor-not-allowed shadow-2xs shrink-0"
                title="Send message"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-center text-[#8e8e8e] mt-2 select-none">
            Neuron AI can make mistakes. Verify important academic facts with your course notes.
          </p>
        </footer>

      </div>

      {/* ── Reference File Selector Modal (Clean & Beautiful) ────────────────── */}
      <Dialog open={isReferenceModalOpen} onOpenChange={setIsReferenceModalOpen}>
        <DialogContent className="max-w-lg bg-white border border-[#cbd5e1] shadow-xl rounded-2xl p-0 overflow-hidden">
          
          {/* Header */}
          <DialogHeader className="p-4 pb-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <div className="flex items-center justify-between pr-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-semibold text-[#0f172a]">
                    Reference Study Materials
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#64748b] mt-0.5">
                    Select up to {MAX_REFERENCES} documents from your subjects to focus AI responses.
                  </DialogDescription>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-[#cbd5e1] text-[#475569]">
                {selectedDocIds.length}/{MAX_REFERENCES} Selected
              </span>
            </div>

            {/* Search Input & Subject Filters */}
            <div className="mt-3.5 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#94a3b8]" />
                <Input
                  placeholder="Search documents by title..."
                  className="pl-8 text-xs h-8 bg-white border-[#cbd5e1] focus-visible:ring-blue-400 rounded-lg"
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                />
              </div>

              {/* Subject Tabs */}
              {subjects.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectFilter("all")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
                      selectedSubjectFilter === "all"
                        ? "bg-[#0f172a] text-white shadow-2xs"
                        : "bg-white text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-[#e2e8f0]"
                    }`}
                  >
                    All Notes ({documents.length})
                  </button>
                  {subjects.map(subj => {
                    const count = documents.filter(d => d.subject_id === subj.id).length;
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => setSelectedSubjectFilter(subj.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          selectedSubjectFilter === subj.id
                            ? "bg-[#0f172a] text-white shadow-2xs"
                            : "bg-white text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] border border-[#e2e8f0]"
                        }`}
                      >
                        <Folder className="h-3 w-3 opacity-60" />
                        <span>{subj.name}</span>
                        <span className="text-[10px] opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Document list or Clean Empty State */}
          <div className="max-h-72 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
            {documents.length === 0 ? (
              /* User has 0 uploaded documents in the database */
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-3">
                  <Folder className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-[#0f172a]">
                  No Study Documents Uploaded Yet
                </h4>
                <p className="text-xs text-[#64748b] max-w-xs mt-1 mb-4 leading-relaxed">
                  You haven&apos;t uploaded any study materials yet. Upload your lecture notes or PDFs to your subjects, and they will appear here as reference options.
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/uploads"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Go to Upload Center
                    <ArrowUpRight className="h-3 w-3 opacity-70" />
                  </Link>
                  <Link
                    href="/subjects"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold shadow-2xs transition-all"
                  >
                    File Explorer
                  </Link>
                </div>
              </div>
            ) : filteredModalDocuments.length === 0 ? (
              /* Search / Subject filter yielded 0 matches */
              <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8] text-xs text-center">
                <Search className="h-6 w-6 mb-2 opacity-40" />
                <span>No documents match your search query or filter.</span>
                <button
                  type="button"
                  onClick={() => {
                    setDocSearchQuery("");
                    setSelectedSubjectFilter("all");
                  }}
                  className="text-xs text-blue-600 hover:underline font-medium mt-1.5"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filteredModalDocuments.map(doc => {
                const isSelected = selectedDocIds.includes(doc.id);
                const isMaxReached = selectedDocIds.length >= MAX_REFERENCES && !isSelected;
                const subj = subjects.find(s => s.id === doc.subject_id);

                return (
                  <div
                    key={doc.id}
                    onClick={() => !isMaxReached && toggleDocumentSelection(doc.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-200 text-[#0f172a] font-medium shadow-2xs"
                        : isMaxReached
                        ? "opacity-40 cursor-not-allowed border-transparent bg-[#f8fafc] text-[#94a3b8]"
                        : "hover:bg-[#f8fafc] border-transparent text-[#475569] hover:text-[#0f172a] cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]"
                      }`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-[#0f172a]">{doc.title}</span>
                          {subj && (
                            <span className="text-[10px] px-1.5 py-0.25 rounded bg-[#e2e8f0] text-[#334155] font-semibold shrink-0">
                              {subj.code || subj.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#94a3b8] block mt-0.5">
                          {new Date(doc.upload_date).toLocaleDateString()} • {doc.file_type.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className={`h-4.5 w-4.5 rounded-md flex items-center justify-center border transition-all shrink-0 ml-2 ${
                      isSelected 
                        ? "bg-blue-600 border-blue-600 text-white" 
                        : "border-[#cbd5e1] bg-white"
                    }`}>
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            {selectedDocIds.length > 0 ? (
              <button
                type="button"
                onClick={clearSelectedDocuments}
                className="text-xs text-[#64748b] hover:text-red-600 hover:underline cursor-pointer font-medium"
              >
                Clear all ({selectedDocIds.length})
              </button>
            ) : (
              <span className="text-xs text-[#94a3b8]">
                Select notes to reference
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReferenceModalOpen(false)}
                className="h-8 text-xs cursor-pointer rounded-lg border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f1f5f9]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setIsReferenceModalOpen(false)}
                disabled={selectedDocIds.length === 0}
                className="h-8 text-xs font-semibold cursor-pointer rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-40"
              >
                Attach References ({selectedDocIds.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Citation Inspector Dialog ────────────────────────────────────────── */}
      <Dialog open={!!selectedSource} onOpenChange={(open) => !open && setSelectedSource(null)}>
        <DialogContent className="max-w-2xl bg-white border border-[#cbd5e1] shadow-2xl rounded-2xl">
          {selectedSource && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5 border-b border-[#e2e8f0] pb-3">
                  <div className="h-9 w-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-200">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <DialogTitle className="text-sm font-semibold text-[#0f172a] truncate pr-4">
                      {selectedSource.document_title}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[#64748b] mt-0.5">
                      Chunk Index: {selectedSource.chunk_index} • Semantic match: {(selectedSource.similarity * 100).toFixed(0)}%
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5 block select-none">
                  Retrieved Lecture Context Segment:
                </span>
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 max-h-80 overflow-y-auto scrollbar-thin">
                  <p className="text-xs text-[#1e293b] leading-relaxed whitespace-pre-wrap">{selectedSource.content}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex justify-end">
                <Button 
                  onClick={() => setSelectedSource(null)} 
                  size="sm" 
                  className="text-xs font-semibold px-4 h-8 cursor-pointer bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-lg"
                >
                  Close Context
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
