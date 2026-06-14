import { create } from 'zustand';

interface MemberColorsStore {
  colors: Record<string, string | null>;
  setColors(entries: Array<{ userId: string; color: string | null }>): void;
  clear(): void;
}

export const useMemberColorsStore = create<MemberColorsStore>((set) => ({
  colors: {},
  setColors(entries) {
    set((s) => {
      const next = { ...s.colors };
      for (const { userId, color } of entries) {
        next[userId] = color;
      }
      return { colors: next };
    });
  },
  clear() {
    set({ colors: {} });
  },
}));
