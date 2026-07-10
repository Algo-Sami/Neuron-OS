"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { ArrowLeft, Save, Edit3, Loader2, Check, AlertTriangle, Bold, Italic, Underline, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { saveFileAction, renameDocument } from "@/actions/uploads";
import { DocumentItem } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function FileEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const fileId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<DocumentItem | null>(null);

  // Editor states
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"Saved ✓" | "Saving..." | "Error saving" | "">("Saved ✓");
  const [isSaving, setIsSaving] = useState(false);

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Dialogs
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Refs for tracking values inside callbacks/timers
  const contentRef = useRef(content);
  const titleRef = useRef(title);
  const isDirtyRef = useRef(isDirty);
  const isSavingRef = useRef(isSaving);
  const fileTypeRef = useRef("");
  
  // Timer refs
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const richTextRef = useRef<HTMLDivElement>(null);

  // Sync refs with state
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);

  // Load file details
  useEffect(() => {
    if (!fileId) return;

    const fetchFile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data, error: docError } = await supabase
          .from("documents")
          .select("*")
          .eq("id", fileId)
          .eq("user_id", user.id)
          .single();

        if (docError || !data) {
          throw new Error("Unable to open file. Please try again.");
        }

        setFile(data);
        setTitle(data.title);
        setRenameValue(data.title);
        fileTypeRef.current = (data.file_type || "").toLowerCase();
        
        const initialContent = data.content || "";
        setContent(initialContent);
        
        // Populate rich text editor if docx
        if (fileTypeRef.current === "docx" && richTextRef.current) {
          richTextRef.current.innerHTML = initialContent || "<p>Start writing your rich notes here...</p>";
        }

        setIsDirty(false);
        setSaveStatus("Saved ✓");
      } catch (err: any) {
        setError(err.message || "Unable to open file. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFile();
  }, [fileId, router]);

  // The save function
  const handleSave = useCallback(async (_isAuto = false) => {
    if (!fileId || !isDirtyRef.current || isSavingRef.current) return;

    setIsSaving(true);
    setSaveStatus("Saving...");

    try {
      const contentToSave = fileTypeRef.current === "docx" && richTextRef.current
        ? richTextRef.current.innerHTML
        : contentRef.current;

      // Calculate size in bytes
      const sizeInBytes = new Blob([contentToSave]).size;

      const res = await saveFileAction(fileId, contentToSave, sizeInBytes);
      if (res.success) {
        setIsDirty(false);
        setSaveStatus("Saved ✓");
      } else {
        setSaveStatus("Error saving");
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("Error saving");
    } finally {
      setIsSaving(false);
    }
  }, [fileId]);

  // Setup auto-save inactivity timer (5 seconds) and interval timer (15 seconds)
  useEffect(() => {
    if (isLoading || error || !fileId) return;

    // Reset inactivity timer when content or dirty status changes
    if (isDirty) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        handleSave(true);
      }, 5000);
    }

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [content, isDirty, isLoading, error, fileId, handleSave]);

  // Setup 15-second interval timer
  useEffect(() => {
    if (isLoading || error || !fileId) return;

    intervalTimerRef.current = setInterval(() => {
      if (isDirtyRef.current && !isSavingRef.current) {
        handleSave(true);
      }
    }, 15000);

    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    };
  }, [isLoading, error, fileId, handleSave]);

  // Setup beforeunload browser safety event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Handle content edits
  const onContentChange = (val: string) => {
    setContent(val);
    setIsDirty(true);
    setSaveStatus("");
  };

  // Handle content edits in Rich Text
  const onRichTextChange = () => {
    if (richTextRef.current) {
      setIsDirty(true);
      setSaveStatus("");
    }
  };

  // Format rich text helper
  const execFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    onRichTextChange();
    if (richTextRef.current) {
      setContent(richTextRef.current.innerHTML);
    }
  };

  // Handle rename submission
  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === title || !fileId) {
      setIsRenaming(false);
      return;
    }

    setIsSaving(true);
    setSaveStatus("Saving...");
    try {
      await renameDocument(fileId, trimmed);
      setTitle(trimmed);
      setIsRenaming(false);
      setSaveStatus("Saved ✓");
    } catch (err) {
      console.error(err);
      setSaveStatus("Error saving");
      alert("Failed to rename file.");
    } finally {
      setIsSaving(false);
    }
  };

  // Navigate back handling
  const getBackUrl = () => {
    const fromParam = searchParams?.get("from");
    if (fromParam) return decodeURIComponent(fromParam);
    if (file?.subject_id) return `/subjects/${file.subject_id}?folder=${file.folder_id || ""}`;
    return "/uploads";
  };

  const handleBackClick = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      router.push(getBackUrl());
    }
  };

  const handleSaveAndExit = async () => {
    setShowUnsavedDialog(false);
    setIsSaving(true);
    setSaveStatus("Saving...");
    try {
      const contentToSave = fileTypeRef.current === "docx" && richTextRef.current
        ? richTextRef.current.innerHTML
        : content;
      const sizeInBytes = new Blob([contentToSave]).size;
      await saveFileAction(fileId, contentToSave, sizeInBytes);
      setIsDirty(false);
      router.push(getBackUrl());
    } catch (err) {
      console.error(err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExitWithoutSaving = () => {
    setIsDirty(false);
    setShowUnsavedDialog(false);
    router.push(getBackUrl());
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] h-[75vh] w-full text-muted-foreground select-none">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <span className="text-sm font-semibold tracking-wide">Loading File...</span>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] h-[75vh] w-full text-destructive p-6 text-center select-none">
        <AlertTriangle className="h-10 w-10 mb-3" />
        <h3 className="text-lg font-bold">Unable to open file.</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">Please verify the file exists or try opening it again from your explorer.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/subjects")} className="mt-4 text-xs font-semibold cursor-pointer">
          Go to Subjects
        </Button>
      </div>
    );
  }

  const isDocx = (file.file_type || "").toLowerCase() === "docx";

  return (
    <div className="flex flex-col h-[calc(100vh-3.25rem-1px)] min-h-0 bg-background select-none">
      
      {/* Top Toolbar */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-card/65 backdrop-blur-md px-4 md:px-6 shrink-0 z-20">
        
        <div className="flex items-center gap-2 md:gap-3.5 min-w-0">
          {/* Back */}
          <button
            onClick={handleBackClick}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <span className="text-border text-xs hidden sm:inline select-none">|</span>
          
          {/* File Name */}
          {isRenaming ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") {
                    setRenameValue(title);
                    setIsRenaming(false);
                  }
                }}
                autoFocus
                className="px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground font-semibold placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-[160px] sm:w-[240px]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs md:text-sm font-bold text-foreground truncate select-all">{title}</h2>
              <button
                onClick={() => setIsRenaming(true)}
                className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-white/8 transition-all cursor-pointer"
                title="Rename File"
              >
                <Edit3 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Status & Save Button */}
        <div className="flex items-center gap-3">
          {saveStatus && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/80 tracking-wide bg-muted/30 px-2 py-0.5 rounded border border-border/30">
              {saveStatus === "Saving..." && <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />}
              {saveStatus === "Saved ✓" && <Check className="h-2.5 w-2.5 text-green-400" />}
              {saveStatus}
            </span>
          )}
          
          <button
            onClick={() => {
              setIsDirty(true);
              handleSave();
            }}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-border/80 bg-muted/40 hover:bg-white/8 text-foreground transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            <Save className="h-3 w-3" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        {isDocx ? (
          /* Rich Text Editor for DOCX */
          <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
            {/* Rich formatting options bar */}
            <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border/40 bg-card/40 shrink-0">
              <button
                onClick={() => execFormat("bold")}
                className="p-1.5 rounded hover:bg-white/8 text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => execFormat("italic")}
                className="p-1.5 rounded hover:bg-white/8 text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => execFormat("underline")}
                className="p-1.5 rounded hover:bg-white/8 text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                title="Underline"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>
              <span className="h-4 w-px bg-border/50 mx-1" />
              <button
                onClick={() => execFormat("insertUnorderedList")}
                className="p-1.5 rounded hover:bg-white/8 text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                title="Bullet List"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => execFormat("formatBlock", "h1")}
                className="p-1.5 rounded hover:bg-white/8 text-muted-foreground hover:text-foreground cursor-pointer transition-all text-xs font-black"
                title="Heading 1"
              >
                H1
              </button>
              <button
                onClick={() => execFormat("formatBlock", "h2")}
                className="p-1.5 rounded hover:bg-white/8 text-muted-foreground hover:text-foreground cursor-pointer transition-all text-xs font-black"
                title="Heading 2"
              >
                H2
              </button>
            </div>

            {/* Scrollable editable zone */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 flex justify-center">
              <div
                ref={richTextRef}
                contentEditable
                onInput={onRichTextChange}
                className="w-full max-w-3xl bg-card border border-border/80 shadow-sm rounded-xl p-8 min-h-[400px] h-fit outline-none text-sm text-foreground leading-relaxed prose prose-invert focus:ring-1 focus:ring-primary/20 select-text"
                style={{ fontFamily: 'Inter, sans-serif' }}
              />
            </div>
          </div>
        ) : (
          /* Plain Text Area for TXT, MD, NOTE */
          <div className="flex-1 p-4 md:p-6 flex justify-center bg-muted/10 overflow-hidden">
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Start writing your notes here..."
              className="w-full max-w-3xl bg-card border border-border/80 shadow-sm rounded-xl p-6 outline-none text-xs md:text-sm text-foreground leading-relaxed resize-none focus:ring-1 focus:ring-primary/20 font-mono select-text h-full overflow-y-auto"
            />
          </div>
        )}
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="sm:max-w-[400px] bg-card border border-border/85 p-5 rounded-xl shadow-2xl">
          <DialogHeader className="gap-2 pb-2 border-b border-border">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-sm font-bold text-foreground">Unsaved Changes</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              You have unsaved changes in this document. Are you sure you want to leave?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-5 flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowUnsavedDialog(false)}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleExitWithoutSaving}
              className="w-full sm:w-auto text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Exit Without Saving
            </Button>
            <Button
              onClick={handleSaveAndExit}
              className="w-full sm:w-auto text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
