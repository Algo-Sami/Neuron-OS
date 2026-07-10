import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  activeModals: Record<string, boolean>;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setModalOpen: (modalId: string, isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeModals: {},
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setModalOpen: (modalId, isOpen) =>
    set((state) => ({
      activeModals: { ...state.activeModals, [modalId]: isOpen },
    })),
}));
