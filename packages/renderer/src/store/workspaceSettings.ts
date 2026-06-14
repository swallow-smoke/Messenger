import { create } from 'zustand';
import { storage } from '../lib/api';

export type NotifLevel = 'all' | 'mentions' | 'nothing';

interface WorkspaceSettingsState {
  muted: Record<string, boolean>;
  notifLevel: Record<string, NotifLevel>;
  loaded: boolean;
  load(): Promise<void>;
  setMuted(workspaceId: string, muted: boolean): void;
  setNotifLevel(workspaceId: string, level: NotifLevel): void;
  isMuted(workspaceId: string): boolean;
  getNotifLevel(workspaceId: string): NotifLevel;
}

const STORAGE_KEY = 'workspaceSettings';

export const useWorkspaceSettingsStore = create<WorkspaceSettingsState>((set, get) => ({
  muted: {},
  notifLevel: {},
  loaded: false,

  async load() {
    try {
      const raw = await storage.get(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { muted?: Record<string, boolean>; notifLevel?: Record<string, NotifLevel> };
        set({ muted: parsed.muted ?? {}, notifLevel: parsed.notifLevel ?? {}, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  setMuted(workspaceId, muted) {
    const next = { ...get().muted, [workspaceId]: muted };
    set({ muted: next });
    void storage.set(STORAGE_KEY, JSON.stringify({ muted: next, notifLevel: get().notifLevel }));
  },

  setNotifLevel(workspaceId, level) {
    const next = { ...get().notifLevel, [workspaceId]: level };
    set({ notifLevel: next });
    void storage.set(STORAGE_KEY, JSON.stringify({ muted: get().muted, notifLevel: next }));
  },

  isMuted(workspaceId) {
    return get().muted[workspaceId] === true;
  },

  getNotifLevel(workspaceId) {
    return get().notifLevel[workspaceId] ?? 'all';
  },
}));
