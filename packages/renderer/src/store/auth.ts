import { create } from 'zustand';
import api, { storage } from '../lib/api';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  status?: string;
  statusText?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, displayName: string, password: string): Promise<void>;
  logout(): Promise<void>;
  loadFromStorage(): Promise<void>;
  updateStatus(status: string, statusText?: string): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: false,

  async login(email, password) {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await storage.set('accessToken', data.accessToken);
      await storage.set('refreshToken', data.refreshToken);
      set({ user: data.user, accessToken: data.accessToken });
    } finally {
      set({ isLoading: false });
    }
  },

  async register(email, displayName, password) {
    set({ isLoading: true });
    try {
      await api.post('/auth/register', { email, displayName, password });
      const { data } = await api.post('/auth/login', { email, password });
      await storage.set('accessToken', data.accessToken);
      await storage.set('refreshToken', data.refreshToken);
      set({ user: data.user, accessToken: data.accessToken });
    } finally {
      set({ isLoading: false });
    }
  },

  async logout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    await storage.remove('accessToken');
    await storage.remove('refreshToken');
    set({ user: null, accessToken: null });
  },

  async loadFromStorage() {
    set({ isLoading: true });
    try {
      const token = await storage.get('accessToken');
      if (!token) return;
      const { data } = await api.get('/auth/me');
      set({ user: data, accessToken: token });
    } catch {
      await storage.remove('accessToken');
    } finally {
      set({ isLoading: false });
    }
  },

  updateStatus(status, statusText) {
    set((s) => ({
      user: s.user ? { ...s.user, status, statusText } : null,
    }));
  },
}));
