"use client";

import React, { useState, useEffect, useRef } from "react";
import { Clock, Pin, X, Folder, Trash2 } from "lucide-react";
import { RecentItem } from "@/types/explorer";
import { FileIcon } from "./explorer-icons";
import { cn } from "@/lib/utils";

interface ExplorerQuickAccessProps {
  favorites: RecentItem[];
  recentItems: RecentItem[];
  onNavigate: (item: RecentItem) => void;
  onRemoveFavorite: (id: string, type: "subject" | "folder" | "file") => void;
  onRemoveItem: (id: string, type: "subject" | "folder" | "file") => void;
}

export function ExplorerQuickAccess({
  favorites,
  recentItems,
  onNavigate,
  onRemoveFavorite,
  onRemoveItem,
}: ExplorerQuickAccessProps) {
  // 1. Pinned Subjects (Subjects in favorites)
  const pinnedSubjects = favorites.filter((f) => f.type === "subject");

  // 2. Recently Opened Subjects (Subjects in recentItems, excluding those already pinned)
  const recentSubjects = recentItems.filter(
    (r) => r.type === "subject" && !pinnedSubjects.some((p) => p.id === r.id)
  );

  // 3. Recent Folders (Folders in recentItems)
  const recentFolders = recentItems.filter((r) => r.type === "folder");

  // Combine them with clear source category, up to 8 items total
  const quickAccessItems: {
    item: RecentItem;
    category: "pinned-subject" | "recent-subject" | "recent-folder";
    label: string;
    iconType: string;
  }[] = [];

  pinnedSubjects.slice(0, 3).forEach((item) => {
    quickAccessItems.push({
      item,
      category: "pinned-subject",
      label: "Pinned Subject",
      iconType: "subject",
    });
  });

  recentSubjects.slice(0, 3).forEach((item) => {
    quickAccessItems.push({
      item,
      category: "recent-subject",
      label: "Recent Subject",
      iconType: "subject",
    });
  });

  recentFolders.slice(0, 2).forEach((item) => {
    quickAccessItems.push({
      item,
      category: "recent-folder",
      label: "Recent Folder",
      iconType: "folder",
    });
  });

  // Limit total to maximum of 8 items
  const finalItems = quickAccessItems.slice(0, 8);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: RecentItem;
    category: "pinned-subject" | "recent-subject" | "recent-folder";
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  if (finalItems.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border/40 bg-[#f9fafb] dark:bg-card/20 px-4 py-2.5 select-none">
      <div className="flex items-center gap-1.5 mb-2">
        <Pin className="h-3.5 w-3.5 text-primary rotate-45" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quick Access</span>
        <span className="text-[10px] text-muted-foreground/60">({finalItems.length} items)</span>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
        {finalItems.map(({ item, category, label, iconType }) => {
          const isPinned = category === "pinned-subject";
          return (
            <div
              key={`qa-${item.type}-${item.id}-${category}`}
              onClick={() => onNavigate(item)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, item, category });
              }}
              className={cn(
                "group relative flex flex-col items-center p-2 rounded-lg border text-center transition-all duration-150 cursor-pointer select-none",
                "bg-white dark:bg-card/40 border-border/40 hover:border-primary/40 hover:bg-primary/5 hover:shadow-xs"
              )}
            >
              {/* Badge representing category */}
              <div className="absolute top-1 left-1.5 flex items-center justify-center" title={label}>
                {category === "pinned-subject" && (
                  <Pin className="h-2.5 w-2.5 text-red-400 rotate-45" />
                )}
                {category === "recent-subject" && (
                  <Clock className="h-2.5 w-2.5 text-blue-400" />
                )}
                {category === "recent-folder" && (
                  <Folder className="h-2.5 w-2.5 text-amber-400" />
                )}
              </div>

              {/* Unfavorite / Remove button (visible on hover) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPinned) {
                    onRemoveFavorite(item.id, item.type);
                  } else {
                    onRemoveItem(item.id, item.type);
                  }
                }}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-4 w-4 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                title={isPinned ? "Unpin from Quick Access" : "Remove from Quick Access"}
              >
                <X className="h-2.5 w-2.5" />
              </button>

              {/* Icon */}
              <div className="h-9 w-9 rounded-lg flex items-center justify-center mb-1.5 mt-1 shrink-0">
                <FileIcon
                  type={iconType}
                  className="h-[22px] w-[22px] text-amber-400"
                />
              </div>

              {/* Text label */}
              <p className="text-[10px] font-bold text-foreground/90 truncate w-full px-1" title={item.name}>
                {item.name}
              </p>
              <p className="text-[8px] text-muted-foreground/60 truncate w-full uppercase tracking-wider font-semibold mt-0.5">
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-[180px] rounded-[10px] border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none text-[11px]"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            onClick={() => {
              const { item, category } = contextMenu;
              if (category === "pinned-subject") {
                onRemoveFavorite(item.id, item.type);
              } else {
                onRemoveItem(item.id, item.type);
              }
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove from Quick Access
          </button>
        </div>
      )}
    </div>
  );
}
