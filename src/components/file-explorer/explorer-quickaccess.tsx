"use client";

import React from "react";
import { Star, Clock, X, ChevronDown, ChevronRight } from "lucide-react";
import { RecentItem } from "@/types/explorer";
import { FileIcon } from "./explorer-icons";
import { cn } from "@/lib/utils";

interface ExplorerQuickAccessProps {
  favorites: RecentItem[];
  recentItems: RecentItem[];
  onNavigate: (item: RecentItem) => void;
  onRemoveFavorite: (id: string, type: "subject" | "folder" | "file") => void;
}

export function ExplorerQuickAccess({
  favorites,
  recentItems,
  onNavigate,
  onRemoveFavorite,
}: ExplorerQuickAccessProps) {
  const [showFavs, setShowFavs] = React.useState(true);
  const [showRecent, setShowRecent] = React.useState(true);

  if (favorites.length === 0 && recentItems.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border/30 bg-card/40 backdrop-blur-sm select-none">
      {/* Favorites strip */}
      {favorites.length > 0 && (
        <div className="border-b border-border/20 last:border-0">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button
              onClick={() => setShowFavs(!showFavs)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFavs ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>Favorites</span>
              <span className="text-muted-foreground/50 font-normal">({favorites.length})</span>
            </button>

            {showFavs && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 ml-1">
                {favorites.map((item) => (
                  <div
                    key={`fav-${item.type}-${item.id}`}
                    className="group relative flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/30 bg-background/40 hover:bg-secondary/50 hover:border-border/60 transition-all cursor-pointer shrink-0"
                    onClick={() => onNavigate(item)}
                  >
                    <FileIcon
                      type={item.type === "file" ? (item.name.split(".").pop() || "") : item.type}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="text-[10px] font-medium text-foreground/90 max-w-[100px] truncate whitespace-nowrap">
                      {item.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite(item.id, item.type);
                      }}
                      className="opacity-0 group-hover:opacity-100 h-3.5 w-3.5 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 transition-all"
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent strip */}
      {recentItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button
              onClick={() => setShowRecent(!showRecent)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRecent ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Clock className="h-3 w-3 text-blue-400" />
              <span>Recent</span>
              <span className="text-muted-foreground/50 font-normal">({Math.min(recentItems.length, 12)})</span>
            </button>

            {showRecent && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 ml-1">
                {recentItems.slice(0, 12).map((item) => (
                  <div
                    key={`rec-${item.type}-${item.id}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/30 bg-background/40 hover:bg-secondary/50 hover:border-border/60 transition-all cursor-pointer shrink-0"
                    onClick={() => onNavigate(item)}
                  >
                    <FileIcon
                      type={item.type === "file" ? (item.name.split(".").pop() || "") : item.type}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="text-[10px] font-medium text-foreground/90 max-w-[90px] truncate whitespace-nowrap">
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
