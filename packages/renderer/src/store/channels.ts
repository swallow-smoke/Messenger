import { create } from 'zustand';
import api from '../lib/api';

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  isArchived: boolean;
  lastReadAt?: string;
}

interface ChannelsState {
  channels: Channel[];
  activeChannelId: string | null;
  unreadCounts: Record<string, number>;
  fetchChannels(workspaceId: string): Promise<void>;
  setActive(channelId: string): void;
  markRead(channelId: string): Promise<void>;
  incrementUnread(channelId: string): void;
  addChannel(channel: Channel): void;
  updateChannel(channel: Channel): void;
  removeChannel(id: string): void;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  unreadCounts: {},

  async fetchChannels(workspaceId) {
    const { data } = await api.get('/channels', { params: { workspaceId } });
    set({ channels: data as Channel[] });
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
