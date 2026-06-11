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
  isPending?: boolean; // optimistic flag
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  reactions: Reaction[];
  _count?: { replies: number };
  isPinned?: boolean;
}

interface MessagesState {
  messages: Record<string, Message[]>;
  threads: Record<string, Message[]>;
  pinnedMessages: Record<string, Message | null>; // channelId → pinned
  fetchMessages(channelId: string, before?: string): Promise<void>;
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

  async fetchMessages(channelId, before) {
    const { data } = await api.get(`/messages/${channelId}/messages`, {
      params: { ...(before ? { before } : {}), limit: 50 },
    });
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: before
          ? [...(data as Message[]), ...(s.messages[channelId] ?? [])]
          : (data as Message[]),
      },
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

    // Skip if already in store (dedup for sender who gets message:new via io.to broadcast)
    if (list.some((m) => m.id === message.id)) return;

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
