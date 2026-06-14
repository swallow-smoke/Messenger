import { create } from 'zustand';
import { storage } from '../lib/api';

const KEY = (workspaceId: string) => `channel-order-${workspaceId}`;
const FAV_KEY = (workspaceId: string) => `channel-favorites-${workspaceId}`;

interface ChannelOrderState {
  favorites: Record<string, string[]>;
  order: Record<string, string[]>;
  load(workspaceId: string): Promise<void>;
  toggleFavorite(workspaceId: string, channelId: string): Promise<void>;
  isFavorite(workspaceId: string, channelId: string): boolean;
  setOrder(workspaceId: string, ids: string[]): Promise<void>;
  getOrder(workspaceId: string, ids: string[]): string[];
}

export const useChannelOrderStore = create<ChannelOrderState>((set, get) => ({
  favorites: {},
  order: {},

  async load(workspaceId) {
    const [rawFav, rawOrder] = await Promise.all([
      storage.get(FAV_KEY(workspaceId)).catch(() => null),
      storage.get(KEY(workspaceId)).catch(() => null),
    ]);
    set((s) => ({
      favorites: { ...s.favorites, [workspaceId]: rawFav ? (JSON.parse(rawFav as string) as string[]) : [] },
      order: { ...s.order, [workspaceId]: rawOrder ? (JSON.parse(rawOrder as string) as string[]) : [] },
    }));
  },

  async toggleFavorite(workspaceId, channelId) {
    const cur = get().favorites[workspaceId] ?? [];
    const next = cur.includes(channelId) ? cur.filter((id) => id !== channelId) : [...cur, channelId];
    set((s) => ({ favorites: { ...s.favorites, [workspaceId]: next } }));
    await storage.set(FAV_KEY(workspaceId), JSON.stringify(next));
  },

  isFavorite(workspaceId, channelId) {
    return (get().favorites[workspaceId] ?? []).includes(channelId);
  },

  async setOrder(workspaceId, ids) {
    set((s) => ({ order: { ...s.order, [workspaceId]: ids } }));
    await storage.set(KEY(workspaceId), JSON.stringify(ids));
  },

  getOrder(workspaceId, ids) {
    const saved = get().order[workspaceId];
    if (!saved || saved.length === 0) return ids;
    const savedSet = new Set(saved);
    const ordered = saved.filter((id) => ids.includes(id));
    const unseen = ids.filter((id) => !savedSet.has(id));
    return [...ordered, ...unseen];
  },
}));
