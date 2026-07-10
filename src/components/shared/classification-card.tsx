"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { Sparkles, Check, ChevronRight, Settings } from "lucide-react";
import { confirmAIClassification, rejectOrCustomizeClassification } from "@/actions/uploads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PendingDoc {
  id: string;
  title: string;
  ai_subject: string | null;
  ai_topic: string | null;
  ai_doc_type: string | null;
  classification_confidence: number | null;
}

interface ClassificationCardProps {
  pendingDocs: PendingDoc[];
}

export function ClassificationCard({ pendingDocs }: ClassificationCardProps) {
  const [isPending, startTransition] = useTransition();
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [customSubject, setCustomSubject] = useState("");
  const [customTopic, setCustomTopic] = useState("");

  if (!pendingDocs || pendingDocs.length === 0) return null;

  const handleConfirm = (docId: string) => {
    startTransition(async () => {
      try {
        await confirmAIClassification(docId);
      } catch (err) {
        console.error("Failed to confirm classification:", err);
      }
    });
  };

  const handleCustomizeSave = (docId: string) => {
    if (!customSubject.trim() || !customTopic.trim()) return;
    startTransition(async () => {
      try {
        await rejectOrCustomizeClassification(docId, customSubject, customTopic);
        setEditingDocId(null);
        setCustomSubject("");
        setCustomTopic("");
      } catch (err) {
        console.error("Failed to customize classification:", err);
      }
    });
  };

  const startEditing = (doc: PendingDoc) => {
    setEditingDocId(doc.id);
    setCustomSubject(doc.ai_subject || "");
    setCustomTopic(doc.ai_topic || "");
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary/90">
        <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
        <span>AI Auto-Classification Pending Approval ({pendingDocs.length})</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {pendingDocs.map((doc) => {
          const confidencePct = Math.round((doc.classification_confidence || 0) * 100);
          const isEditing = editingDocId === doc.id;

          return (
            <div
              key={doc.id}
              className="relative overflow-hidden rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-background to-card p-5 shadow-md backdrop-blur-md"
            >
              {/* Colored side-border effect */}
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-purple-500 to-indigo-600" />

              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider">
                      {doc.ai_doc_type || "Lecture Material"}
                    </p>
                    <h3 className="font-semibold text-foreground text-sm mt-0.5 truncate pr-2" title={doc.title}>
                      {doc.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full text-xs font-medium border border-purple-500/25">
                    <span>{confidencePct}% Match</span>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>

                {!isEditing ? (
                  <>
                    {/* Suggested Course Location Details */}
                    <div className="flex items-center gap-4 bg-muted/30 p-2.5 rounded-lg border border-border/50 text-xs">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">Suggested Subject</span>
                        <span className="font-medium text-foreground truncate">{doc.ai_subject || "General Study"}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">Suggested Folder</span>
                        <span className="font-medium text-foreground truncate">{doc.ai_topic || "General Notes"}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => startEditing(doc)}
                        className="text-xs h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Settings className="mr-1.5 h-3.5 w-3.5" />
                        Customize
                      </Button>
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleConfirm(doc.id)}
                        className="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Confirm & Organize
                      </Button>
                    </div>
                  </>
                ) : (
                  /* Custom Organization Form */
                  <div className="flex flex-col gap-3 mt-1 bg-muted/40 p-3 rounded-lg border border-border/80">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Specify Subject & Folder Location
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-semibold text-muted-foreground">Subject Name</label>
                        <Input
                          placeholder="e.g. Operating Systems"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          className="h-7 text-xs bg-background"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-semibold text-muted-foreground">Folder/Topic Name</label>
                        <Input
                          placeholder="e.g. Process Management"
                          value={customTopic}
                          onChange={(e) => setCustomTopic(e.target.value)}
                          className="h-7 text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setEditingDocId(null)}
                        className="text-[11px] h-6 px-2 text-muted-foreground"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={isPending || !customSubject.trim() || !customTopic.trim()}
                        onClick={() => handleCustomizeSave(doc.id)}
                        className="text-[11px] h-6 px-2 bg-foreground text-background hover:bg-foreground/90 font-medium"
                      >
                        Save Course Path
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
