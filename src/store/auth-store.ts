import { create } from "zustand";
import { UserProfile } from "@/types";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  setUser: (user: UserProfile | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
}));
