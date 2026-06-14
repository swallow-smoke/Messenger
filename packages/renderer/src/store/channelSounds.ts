import { create } from 'zustand';
import { storage } from '../lib/api';
import type { SoundId } from '../lib/sounds';

const STORAGE_KEY = 'channel-sounds';

interface ChannelSoundsState {
  sounds: Record<string, SoundId>;
  loaded: boolean;
  load(): Promise<void>;
  setSound(channelId: string, soundId: SoundId): Promise<void>;
  getSound(channelId: string): SoundId;
}

export const useChannelSoundsStore = create<ChannelSoundsState>((set, get) => ({
  sounds: {},
  loaded: false,

  async load() {
    try {
      const raw = await storage.get(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw as string) as Record<string, SoundId>) : {};
      set({ sounds: parsed, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  async setSound(channelId, soundId) {
    const next = { ...get().sounds, [channelId]: soundId };
    set({ sounds: next });
    await storage.set(STORAGE_KEY, JSON.stringify(next));
  },

  getSound(channelId) {
    return get().sounds[channelId] ?? 'default';
  },
}));
