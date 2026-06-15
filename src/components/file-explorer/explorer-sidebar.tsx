"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  UploadCloud,
  Trash2,
  BookOpen,
  GraduationCap,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { SidebarSubject, SidebarFolder } from "@/types";


interface ExplorerSidebarProps {
  subjects: SidebarSubject[];
  folders: SidebarFolder[];
  activeTab: "subjects" | "uploads" | "assignments" | "notes" | "recycle-bin";
  activeSubjectId: string | null;
  activeFolderId: string | null;
  onNavigate: (
    tab: "subjects" | "uploads" | "assignments" | "notes" | "recycle-bin",
    subjectId: string | null,
    folderId: string | null
  ) => void;
  onMoveItem: (
    itemId: string,
    itemType: "folder" | "file",
    targetSubjectId: string,
    targetFolderId: string | null
  ) => void;
}

export function ExplorerSidebar({
  subjects,
  folders,
  activeTab,
  activeSubjectId,
  activeFolderId,
  onNavigate,
  onMoveItem,
}: ExplorerSidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // Drag and drop events for sidebar nodes
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const targetElement = e.currentTarget as HTMLElement;
    targetElement.classList.add("bg-primary/10", "border-primary/30");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const targetElement = e.currentTarget as HTMLElement;
    targetElement.classList.remove("bg-primary/10", "border-primary/30");
  };

  const handleDrop = (
    e: React.DragEvent,
    targetSubjectId: string,
    targetFolderId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const targetElement = e.currentTarget as HTMLElement;
    targetElement.classList.remove("bg-primary/10", "border-primary/30");

    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;

      const draggedItem = JSON.parse(dataStr) as {
        id: string;
        type: "subject" | "folder" | "file";
      };

      // Prevent dropping inside itself
      if (draggedItem.id === targetFolderId || draggedItem.id === targetSubjectId) return;

      onMoveItem(draggedItem.id, draggedItem.type === "file" ? "file" : "folder", targetSubjectId, targetFolderId);
    } catch (err) {
      console.error("Failed sidebar drop:", err);
    }
  };

  // Helper to filter folder children
  const getSubFolders = (subjectId: string, parentFolderId: string | null) => {
    return folders.filter(
      (f) => f.subject_id === subjectId && f.parent_folder_id === parentFolderId
    );
  };

  // Recursive folder node renderer
  const renderFolderNode = (folder: SidebarFolder, depth: number) => {
    const subFolders = getSubFolders(folder.subject_id, folder.id);
    const hasChildren = subFolders.length > 0;
    const isExpanded = expandedIds.has(folder.id);
    const isActive = activeTab === "subjects" && activeFolderId === folder.id;

    return (
      <div key={folder.id} className="flex flex-col select-none">
        <div
          onClick={() => onNavigate("subjects", folder.subject_id, folder.id)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.subject_id, folder.id)}
          className={cn(
            "group flex items-center gap-1.5 rounded-lg py-1 px-2.5 text-[11px] font-semibold border border-transparent cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:text-foreground",
            isActive
              ? "bg-primary/10 border-primary/20 text-foreground"
              : "text-muted-foreground"
          )}
          style={{ paddingLeft: `${depth * 8 + 10}px` }}
        >
          {/* Collapse/Expand chevron */}
          <button
            onClick={(e) => {
              if (hasChildren) {
                toggleExpand(folder.id, e);
              } else {
                e.stopPropagation();
              }
            }}
            className={cn(
              "h-4 w-4 flex items-center justify-center rounded-sm hover:bg-secondary/70 transition-colors shrink-0",
              !hasChildren && "opacity-0 cursor-default"
            )}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          )}

          <span className="truncate flex-1">{folder.name}</span>
        </div>

        {/* Child Folders */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col mt-0.5">
            {subFolders.map((sub) => renderFolderNode(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card/10 p-3 select-none w-56 shrink-0 border-r border-border/60 animate-in fade-in duration-200">
      <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2.5 mb-3">
        Navigation
      </h2>

      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
        {/* Root Node: Subjects */}
        <div className="space-y-1">
          <div
            onClick={() => onNavigate("subjects", null, null)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-transparent cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:text-foreground",
              activeTab === "subjects" && activeSubjectId === null
                ? "bg-primary/10 border-primary/20 text-foreground"
                : "text-muted-foreground"
            )}
          >
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="flex-1">Subjects</span>
          </div>

          {/* Subjects Sub-tree */}
          <div className="flex flex-col gap-0.5 pl-1.5 border-l border-border/40 ml-3.5 mt-1">
            {subjects.map((subject) => {
              const subjectFolders = getSubFolders(subject.id, null);
              const hasFolders = subjectFolders.length > 0;
              const isExpanded = expandedIds.has(subject.id);
              const isActive =
                activeTab === "subjects" &&
                activeSubjectId === subject.id &&
                activeFolderId === null;

              return (
                <div key={subject.id} className="flex flex-col">
                  {/* Subject Node */}
                  <div
                    onClick={() => onNavigate("subjects", subject.id, null)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, subject.id, null)}
                    className={cn(
                      "group flex items-center gap-1.5 rounded-lg py-1 px-2 border border-transparent cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:text-foreground",
                      isActive
                        ? "bg-primary/10 border-primary/20 text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <button
                      onClick={(e) => {
                        if (hasFolders) {
                          toggleExpand(subject.id, e);
                        } else {
                          e.stopPropagation();
                        }
                      }}
                      className={cn(
                        "h-4 w-4 flex items-center justify-center rounded-sm hover:bg-secondary/70 transition-colors shrink-0",
                        !hasFolders && "opacity-0 cursor-default"
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>

                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        subject.color || "bg-blue-500"
                      )}
                    />
                    <span className="truncate flex-1 text-[11px] font-bold">
                      {subject.name}
                    </span>
                  </div>

                  {/* Subject folders */}
                  {hasFolders && isExpanded && (
                    <div className="flex flex-col mt-0.5">
                      {subjectFolders.map((folder) =>
                        renderFolderNode(folder, 1)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Nodes */}
        <div className="space-y-1 pt-2 border-t border-border/40">
          <div
            onClick={() => onNavigate("uploads", null, null)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-transparent cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:text-foreground",
              activeTab === "uploads"
                ? "bg-primary/10 border-primary/20 text-foreground"
                : "text-muted-foreground"
            )}
          >
            <UploadCloud className="h-4 w-4 text-sky-400 shrink-0" />
            <span>All Uploads</span>
          </div>

          <div
            onClick={() => onNavigate("assignments", null, null)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-transparent cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:text-foreground",
              activeTab === "assignments"
                ? "bg-primary/10 border-primary/20 text-foreground"
                : "text-muted-foreground"
            )}
          >
            <GraduationCap className="h-4 w-4 text-pink-400 shrink-0" />
            <span>Assignments</span>
          </div>

          <div
            onClick={() => onNavigate("notes", null, null)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-transparent cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:text-foreground",
              activeTab === "notes"
                ? "bg-primary/10 border-primary/20 text-foreground"
                : "text-muted-foreground"
            )}
          >
            <Layers className="h-4 w-4 text-yellow-400 shrink-0" />
            <span>Notes</span>
          </div>

        </div>
      </div>
    </div>
  );
}
