import { create } from 'zustand';

export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

export interface PresenceEntry {
  userId: string;
  status: UserStatus;
  statusText?: string;
}

export interface TypingMeta {
  displayName?: string;
  customTypingText?: string | null;
}

interface PresenceState {
  presences: Record<string, PresenceEntry>;
  typingUsers: Record<string, string[]>; // contextId → userId[]
  typingMeta: Record<string, TypingMeta>; // userId → meta
  setPresence(entry: PresenceEntry): void;
  setTyping(contextId: string, userId: string, isTyping: boolean, meta?: TypingMeta): void;
  getStatus(userId: string): UserStatus;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presences: {},
  typingUsers: {},
  typingMeta: {},

  setPresence(entry) {
    set((s) => ({
      presences: { ...s.presences, [entry.userId]: entry },
    }));
  },

  setTyping(contextId, userId, isTyping, meta) {
    set((s) => {
      const current = s.typingUsers[contextId] ?? [];
      const next = isTyping
        ? current.includes(userId) ? current : [...current, userId]
        : current.filter((id) => id !== userId);
      const typingMeta = isTyping && meta
        ? { ...s.typingMeta, [userId]: meta }
        : s.typingMeta;
      return { typingUsers: { ...s.typingUsers, [contextId]: next }, typingMeta };
    });
  },

  getStatus(userId) {
    return get().presences[userId]?.status ?? 'offline';
  },
}));
