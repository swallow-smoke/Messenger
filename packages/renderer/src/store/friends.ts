import { create } from 'zustand';
import api from '../lib/api';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface FriendUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  status: string;
  statusText?: string;
  lastSeenAt?: string;
}

export interface FriendshipEntry {
  id: string;
  status: FriendshipStatus;
  requesterId: string;
  receiverId: string;
  otherUser: FriendUser;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  requesterId: string;
  receiverId: string;
  createdAt: string;
  requester: { id: string; displayName: string; avatarUrl?: string; status: string };
}

interface FriendsState {
  friendships: FriendshipEntry[];
  requests: FriendRequest[];
  loading: boolean;
  pendingCount: number;

  fetchAll(): Promise<void>;
  fetchRequests(): Promise<void>;
  sendRequest(targetUserId: string): Promise<void>;
  acceptRequest(id: string): Promise<void>;
  rejectRequest(id: string): Promise<void>;
  removeFriend(id: string): Promise<void>;
  blockFriend(id: string): Promise<void>;
  getRelationship(
    userId: string,
    myId: string
  ): { status: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked'; id: string | null };
  addIncomingRequest(req: FriendRequest): void;
  markAccepted(id: string): void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friendships: [],
  requests: [],
  loading: false,
  pendingCount: 0,

  async fetchAll() {
    set({ loading: true });
    try {
      const { data } = await api.get<FriendshipEntry[]>('/friends?status=all');
      set({ friendships: data });
    } finally {
      set({ loading: false });
    }
  },

  async fetchRequests() {
    const { data } = await api.get<FriendRequest[]>('/friends/requests');
    set({ requests: data, pendingCount: data.length });
  },

  async sendRequest(targetUserId) {
    const { data } = await api.post<{ id: string; requesterId: string; receiverId: string; createdAt: string; receiver: FriendUser }>('/friends/request', { targetUserId });
    set((s) => ({
      friendships: [
        ...s.friendships,
        {
          id: data.id,
          status: 'pending' as FriendshipStatus,
          requesterId: data.requesterId,
          receiverId: data.receiverId,
          otherUser: data.receiver,
          createdAt: data.createdAt,
        },
      ],
    }));
  },

  async acceptRequest(id) {
    await api.post(`/friends/${id}/accept`);
    set((s) => ({
      friendships: s.friendships.map((f) => (f.id === id ? { ...f, status: 'accepted' as FriendshipStatus } : f)),
      requests: s.requests.filter((r) => r.id !== id),
      pendingCount: Math.max(0, s.pendingCount - 1),
    }));
  },

  async rejectRequest(id) {
    await api.post(`/friends/${id}/reject`);
    set((s) => ({
      friendships: s.friendships.filter((f) => f.id !== id),
      requests: s.requests.filter((r) => r.id !== id),
      pendingCount: Math.max(0, s.pendingCount - 1),
    }));
  },

  async removeFriend(id) {
    await api.delete(`/friends/${id}`);
    set((s) => ({ friendships: s.friendships.filter((f) => f.id !== id) }));
  },

  async blockFriend(id) {
    await api.post(`/friends/${id}/block`);
    set((s) => ({
      friendships: s.friendships.map((f) => (f.id === id ? { ...f, status: 'blocked' as FriendshipStatus } : f)),
    }));
  },

  getRelationship(userId, myId) {
    const { friendships, requests } = get();
    const req = requests.find((r) => r.requesterId === userId);
    if (req) return { status: 'pending_received', id: req.id };

    const f = friendships.find((entry) => entry.otherUser.id === userId);
    if (!f) return { status: 'none', id: null };
    if (f.status === 'accepted') return { status: 'accepted', id: f.id };
    if (f.status === 'blocked') return { status: 'blocked', id: f.id };
    return { status: f.requesterId === myId ? 'pending_sent' : 'pending_received', id: f.id };
  },

  addIncomingRequest(req) {
    set((s) => ({
      requests: [req, ...s.requests],
      pendingCount: s.pendingCount + 1,
    }));
  },

  markAccepted(id) {
    set((s) => ({
      friendships: s.friendships.map((f) => (f.id === id ? { ...f, status: 'accepted' as FriendshipStatus } : f)),
    }));
  },
}));
