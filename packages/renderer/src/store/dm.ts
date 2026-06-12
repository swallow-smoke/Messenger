import { create } from 'zustand';
import api from '../lib/api';

export interface DMParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string;
  status?: string;
}

export interface DMConversation {
  id: string;
  workspaceId: string;
  isGroup: boolean;
  name?: string;
  members: { user: DMParticipant }[];
  unreadCount: number;
  lastReadAt?: string;
}

export interface DMMessage {
  id: string;
  contextId: string;
  contextType: string;
  content: string;
  senderId: string;
  sender: { id: string; displayName: string; avatarUrl?: string };
  createdAt: string;
  isEdited: boolean;
  isPending?: boolean;
  metadata?: Record<string, unknown>;
}

interface DMState {
  conversations: DMConversation[];
  activeConversationId: string | null;
  messages: Record<string, DMMessage[]>;
  fetchConversations(workspaceId: string): Promise<void>;
  setActiveConversation(id: string): void;
  fetchMessages(conversationId: string): Promise<void>;
  openOrCreateDM(workspaceId: string, userId: string): Promise<string>;
  appendDMMessage(msg: DMMessage): void;
  updateDMMessage(msg: DMMessage): void;
  incrementUnread(conversationId: string): void;
}

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},

  async fetchConversations(workspaceId) {
    const { data } = await api.get('/dm', { params: { workspaceId } });
    set({
      conversations: (data as DMConversation[]).map((c) => ({ ...c, unreadCount: c.unreadCount ?? 0 })),
    });
  },

  setActiveConversation(id) {
    set((s) => ({
      activeConversationId: id,
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    }));
  },

  async fetchMessages(conversationId) {
    const { data } = await api.get(`/dm/${conversationId}/messages`);
    set((s) => ({ messages: { ...s.messages, [conversationId]: data as DMMessage[] } }));
  },

  async openOrCreateDM(workspaceId, userId) {
    // Check if conversation already exists with that user
    const existing = get().conversations.find(
      (c) => !c.isGroup && c.members.some((m) => m.user.id === userId)
    );
    if (existing) return existing.id;
    const { data } = await api.post('/dm', { workspaceId, memberIds: [userId] });
    const conv = { ...(data as DMConversation), unreadCount: 0 };
    set((s) => ({
      conversations: s.conversations.some((c) => c.id === conv.id)
        ? s.conversations
        : [conv, ...s.conversations],
    }));
    return conv.id;
  },

  appendDMMessage(msg) {
    set((s) => {
      const list = s.messages[msg.contextId] ?? [];
      if (list.some((m) => m.id === msg.id)) return s;
      return { messages: { ...s.messages, [msg.contextId]: [...list, msg] } };
    });
  },

  updateDMMessage(msg) {
    set((s) => ({
      messages: {
        ...s.messages,
        [msg.contextId]: (s.messages[msg.contextId] ?? []).map((m) =>
          m.id === msg.id ? msg : m
        ),
      },
    }));
  },

  incrementUnread(conversationId) {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    }));
  },
}));
