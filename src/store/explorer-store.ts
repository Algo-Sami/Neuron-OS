import { create } from "zustand";

interface ExplorerState {
  selectedIds: Set<string>;
  viewMode: "grid" | "list" | "compact";
  sortBy: "name" | "date" | "size";
  sortOrder: "asc" | "desc";
  setSelectedIds: (ids: Set<string>) => void;
  setViewMode: (mode: "grid" | "list" | "compact") => void;
  setSortBy: (by: "name" | "date" | "size") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  clearSelection: () => void;
}

export const useExplorerStore = create<ExplorerState>((set) => ({
  selectedIds: new Set<string>(),
  viewMode: "grid",
  sortBy: "name",
  sortOrder: "asc",
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (by) => set({ sortBy: by }),
  setSortOrder: (order) => set({ sortOrder: order }),
  clearSelection: () => set({ selectedIds: new Set<string>() }),
}));
