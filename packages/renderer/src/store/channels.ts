import { create } from 'zustand';
import api from '../lib/api';

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  rules?: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  lastReadAt?: string;
}

export interface ChannelCategory {
  id: string;
  workspaceId: string;
  name: string;
  position: number;
}

interface ChannelsState {
  channels: Channel[];
  categories: ChannelCategory[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  fetchChannels(workspaceId: string): Promise<void>;
  fetchCategories(workspaceId: string): Promise<void>;
  createCategory(workspaceId: string, name: string): Promise<ChannelCategory>;
  deleteCategory(categoryId: string): Promise<void>;
  setChannelCategory(channelId: string, categoryId: string | null): Promise<void>;
  updateChannelRules(channelId: string, rules: string | null): Promise<void>;
  setActive(channelId: string): void;
  markRead(channelId: string): Promise<void>;
  incrementUnread(channelId: string): void;
  addChannel(channel: Channel): void;
  updateChannel(channel: Channel): void;
  removeChannel(id: string): void;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  categories: [],
  activeChannelId: null,
  unreadCounts: {},

  async fetchChannels(workspaceId) {
    const { data } = await api.get('/channels', { params: { workspaceId } });
    set({ channels: data as Channel[] });
  },

  async fetchCategories(workspaceId) {
    const { data } = await api.get('/categories', { params: { workspaceId } });
    set({ categories: data as ChannelCategory[] });
  },

  async createCategory(workspaceId, name) {
    const { data } = await api.post('/categories', { workspaceId, name });
    const cat = data as ChannelCategory;
    set((s) => ({ categories: [...s.categories, cat] }));
    return cat;
  },

  async deleteCategory(categoryId) {
    await api.delete(`/categories/${categoryId}`);
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== categoryId),
      channels: s.channels.map((ch) => ch.categoryId === categoryId ? { ...ch, categoryId: null, categoryName: null } : ch),
    }));
  },

  async setChannelCategory(channelId, categoryId) {
    await api.patch(`/channels/${channelId}`, { categoryId });
    set((s) => {
      const cat = categoryId ? s.categories.find((c) => c.id === categoryId) : null;
      return {
        channels: s.channels.map((ch) =>
          ch.id === channelId ? { ...ch, categoryId, categoryName: cat?.name ?? null } : ch
        ),
      };
    });
  },

  async updateChannelRules(channelId, rules) {
    await api.patch(`/channels/${channelId}`, { rules });
    set((s) => ({
      channels: s.channels.map((ch) => ch.id === channelId ? { ...ch, rules } : ch),
    }));
  },

  setActive(channelId) {
    set((s) => ({
      activeChannelId: channelId,
      unreadCounts: { ...s.unreadCounts, [channelId]: 0 },
    }));
    get().markRead(channelId).catch(() => {});
  },

  async markRead(channelId) {
    await api.post(`/channels/${channelId}/read`);
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [channelId]: 0 } }));
  },

  addChannel(channel) {
    set((s) => {
      if (s.channels.some((c) => c.id === channel.id)) return s;
      return { channels: [...s.channels, channel] };
    });
  },

  updateChannel(channel) {
    set((s) => ({ channels: s.channels.map((c) => (c.id === channel.id ? { ...c, ...channel } : c)) }));
  },

  removeChannel(id) {
    set((s) => ({
      channels: s.channels.filter((c) => c.id !== id),
      activeChannelId: s.activeChannelId === id ? null : s.activeChannelId,
    }));
  },

  incrementUnread(channelId) {
    set((s) => {
      const next = { ...s.unreadCounts, [channelId]: (s.unreadCounts[channelId] ?? 0) + 1 };
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      if (window.electron?.window) {
        void window.electron.window.setBadgeCount(total);
      }
      return { unreadCounts: next };
    });
  },
}));
