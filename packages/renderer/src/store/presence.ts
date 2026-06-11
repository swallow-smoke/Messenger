import { create } from 'zustand';

export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

export interface PresenceEntry {
  userId: string;
  status: UserStatus;
  statusText?: string;
}

interface PresenceState {
  presences: Record<string, PresenceEntry>;
  typingUsers: Record<string, string[]>; // contextId → userId[]
  setPresence(entry: PresenceEntry): void;
  setTyping(contextId: string, userId: string, isTyping: boolean): void;
  getStatus(userId: string): UserStatus;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presences: {},
  typingUsers: {},

  setPresence(entry) {
    set((s) => ({
      presences: { ...s.presences, [entry.userId]: entry },
    }));
  },

  setTyping(contextId, userId, isTyping) {
    set((s) => {
      const current = s.typingUsers[contextId] ?? [];
      const next = isTyping
        ? current.includes(userId) ? current : [...current, userId]
        : current.filter((id) => id !== userId);
      return { typingUsers: { ...s.typingUsers, [contextId]: next } };
    });
  },

  getStatus(userId) {
    return get().presences[userId]?.status ?? 'offline';
  },
}));
