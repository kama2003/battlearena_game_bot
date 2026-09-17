import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserDto } from "@battle/types";

interface AuthState {
  token: string | null;
  user: UserDto | null;
  setSession: (token: string, user: UserDto) => void;
  updateUser: (user: UserDto) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      updateUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: "battle-auth" },
  ),
);
