import { create } from 'zustand';
import api from '../lib/api';

export interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  thumbnailUrl?: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  user: { id: string; displayName: string };
}

export interface Message {
  id: string;
  contextType: 'channel' | 'dm';
  contextId: string;
  senderId: string;
  sender: { id: string; displayName: string; avatarUrl?: string };
  parentId?: string;
  content: string;
  metadata: Record<string, unknown>;
  isEdited: boolean;
  isDeleted: boolean;
  isPending?: boolean;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  reactions: Reaction[];
  _count?: { replies: number };
  isPinned?: boolean;
  clientTempId?: string;
  mentions?: string[];
}

interface MessagesState {
  messages: Record<string, Message[]>;
  threads: Record<string, Message[]>;
  pinnedMessages: Record<string, Message | null>;
  loaded: Record<string, boolean>;
  fetchMessages(channelId: string, before?: string, after?: string): Promise<void>;
  clearLoaded(channelId: string): void;
  fetchThread(parentId: string): Promise<void>;
  appendMessage(message: Message): void;
  updateMessage(message: Message): void;
  deleteMessage(id: string, contextId: string): void;
  addReaction(payload: { messageId: string; reaction: Reaction; action: 'add' | 'remove'; emoji?: string; userId?: string }): void;
  addOptimistic(message: Message): void;
  confirmOptimistic(tempId: string, real: Message): void;
  removeOptimistic(tempId: string, contextId: string): void;
  setPinned(channelId: string, message: Message | null): void;
  editMessage(id: string, contextId: string, content: string): Promise<void>;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: {},
  threads: {},
  pinnedMessages: {},
  loaded: {},

  async fetchMessages(channelId, before, after) {
    // Skip initial fetch if already loaded unless jumping to a specific date
    if (!before && !after && get().loaded[channelId]) return;

    const { data } = await api.get(`/messages/${channelId}/messages`, {
      params: {
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
        limit: 50,
      },
    });
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: before
          ? [...(data as Message[]), ...(s.messages[channelId] ?? [])]
          : (data as Message[]),
      },
      loaded: { ...s.loaded, [channelId]: true },
    }));
  },

  async fetchThread(parentId) {
    const { data } = await api.get(`/messages/${parentId}/thread`);
    set((s) => ({ threads: { ...s.threads, [parentId]: data as Message[] } }));
  },

  appendMessage(message) {
    const list = message.parentId
      ? get().threads[message.parentId] ?? []
      : get().messages[message.contextId] ?? [];

    // Already in store by real ID
    if (list.some((m) => m.id === message.id)) return;

    // Replace matching temp message (dedup optimistic update from socket broadcast)
    if (message.clientTempId) {
      const tempIndex = list.findIndex((m) => m.id === message.clientTempId);
      if (tempIndex !== -1) {
        const clean = { ...message };
        delete clean.clientTempId;
        if (message.parentId) {
          set((s) => ({
            threads: {
              ...s.threads,
              [message.parentId!]: (s.threads[message.parentId!] ?? []).map((m) =>
                m.id === message.clientTempId ? clean : m
              ),
            },
          }));
        } else {
          set((s) => ({
            messages: {
              ...s.messages,
              [message.contextId]: (s.messages[message.contextId] ?? []).map((m) =>
                m.id === message.clientTempId ? clean : m
              ),
            },
          }));
        }
        return;
      }
    }

    const clean = { ...message };
    delete clean.clientTempId;

    if (message.parentId) {
      set((s) => ({
        threads: {
          ...s.threads,
          [message.parentId!]: [...(s.threads[message.parentId!] ?? []), clean],
        },
        // Keep parent message reply count in sync for the "N replies" indicator
        messages: {
          ...s.messages,
          [message.contextId]: (s.messages[message.contextId] ?? []).map((m) =>
            m.id === message.parentId
              ? { ...m, _count: { replies: (m._count?.replies ?? 0) + 1 } }
              : m
          ),
        },
      }));
    } else {
      set((s) => ({
        messages: {
          ...s.messages,
          [message.contextId]: [...(s.messages[message.contextId] ?? []), clean],
        },
      }));
    }
  },

  updateMessage(updated) {
    set((s) => ({
      messages: {
        ...s.messages,
        [updated.contextId]: (s.messages[updated.contextId] ?? []).map((m) =>
          m.id === updated.id ? updated : m
        ),
      },
    }));
  },

  deleteMessage(id, contextId) {
    set((s) => ({
      messages: {
        ...s.messages,
        [contextId]: (s.messages[contextId] ?? []).map((m) =>
          m.id === id ? { ...m, isDeleted: true, content: '' } : m
        ),
      },
    }));
  },

  addReaction(payload) {
    const update = (msgs: Message[]) =>
      msgs.map((m) => {
        if (m.id !== payload.messageId) return m;
        if (payload.action === 'add') {
          if (m.reactions.some((r) => r.id === payload.reaction.id)) return m;
          return { ...m, reactions: [...m.reactions, payload.reaction] };
        }
        return {
          ...m,
          reactions: m.reactions.filter(
            (r) => !(r.emoji === payload.emoji && r.userId === payload.userId)
          ),
        };
      });
    set((s) => {
      const updated: Record<string, Message[]> = {};
      for (const [k, v] of Object.entries(s.messages)) {
        updated[k] = update(v);
      }
      return { messages: updated };
    });
  },

  addOptimistic(message) {
    if (message.parentId) {
      set((s) => ({
        threads: {
          ...s.threads,
          [message.parentId!]: [...(s.threads[message.parentId!] ?? []), message],
        },
      }));
    } else {
      set((s) => ({
        messages: {
          ...s.messages,
          [message.contextId]: [...(s.messages[message.contextId] ?? []), message],
        },
      }));
    }
  },

  confirmOptimistic(tempId, real) {
    const replace = (msgs: Message[]) =>
      msgs.map((m) => (m.id === tempId ? real : m));

    set((s) => {
      const messages: Record<string, Message[]> = {};
      for (const [k, v] of Object.entries(s.messages)) {
        messages[k] = replace(v);
      }
      const threads: Record<string, Message[]> = {};
      for (const [k, v] of Object.entries(s.threads)) {
        threads[k] = replace(v);
      }
      return { messages, threads };
    });
  },

  removeOptimistic(tempId, contextId) {
    set((s) => ({
      messages: {
        ...s.messages,
        [contextId]: (s.messages[contextId] ?? []).filter((m) => m.id !== tempId),
      },
    }));
  },

  clearLoaded(channelId) {
    set((s) => ({ loaded: { ...s.loaded, [channelId]: false } }));
  },

  setPinned(channelId, message) {
    set((s) => ({ pinnedMessages: { ...s.pinnedMessages, [channelId]: message } }));
  },

  async editMessage(id, contextId, content) {
    const { data } = await api.patch(`/messages/${id}`, { content });
    set((s) => ({
      messages: {
        ...s.messages,
        [contextId]: (s.messages[contextId] ?? []).map((m) =>
          m.id === id ? { ...m, content, isEdited: true, ...data } : m
        ),
      },
    }));
  },
}));
