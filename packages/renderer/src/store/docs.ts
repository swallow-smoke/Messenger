import { create } from 'zustand';
import api from '../lib/api';
import type { FileNode } from '../types/electron';

export interface Doc {
  id: string;
  title: string;
  content: string | null;
  source: 'internal' | 'notion' | 'obsidian';
  externalId?: string;
  externalUrl?: string;
  updatedAt: string;
}

interface DocsState {
  docs: Record<string, Doc>;
  activeDocId: string | null;
  obsidianTree: FileNode[];
  fetchDocs(workspaceId: string, q?: string): Promise<Doc[]>;
  fetchDoc(id: string): Promise<void>;
  saveDoc(id: string, content: string, vaultPath?: string): Promise<void>;
  loadObsidianTree(vaultPath: string): Promise<void>;
  openObsidianFile(filePath: string, vaultPath: string): Promise<string>;
  setActive(id: string | null): void;
  updateDocMeta(id: string, meta: Partial<Doc>): void;
}

export const useDocsStore = create<DocsState>((set, get) => ({
  docs: {},
  activeDocId: null,
  obsidianTree: [],

  async fetchDocs(workspaceId, q) {
    const { data } = await api.get('/documents', { params: { workspaceId, q } });
    return data as Doc[];
  },

  async fetchDoc(id) {
    const { data } = await api.get(`/documents/${id}`);
    set((s) => ({ docs: { ...s.docs, [id]: data as Doc } }));
  },

  async saveDoc(id, content, vaultPath) {
    const doc = get().docs[id];
    if (doc?.source === 'obsidian' && doc.externalId && vaultPath && window.electron) {
      await window.electron.obsidian.writeFile(doc.externalId, content, vaultPath);
      set((s) => ({ docs: { ...s.docs, [id]: { ...s.docs[id], content } } }));
    } else {
      const { data } = await api.patch(`/documents/${id}`, { content });
      set((s) => ({ docs: { ...s.docs, [id]: data as Doc } }));
    }
  },

  async loadObsidianTree(vaultPath) {
    if (!window.electron) return;
    const tree = await window.electron.obsidian.listFiles(vaultPath);
    set({ obsidianTree: tree });
  },

  async openObsidianFile(filePath, vaultPath) {
    if (!window.electron) throw new Error('Not in Electron');
    return window.electron.obsidian.readFile(filePath, vaultPath);
  },

  setActive(id) {
    set({ activeDocId: id });
  },

  updateDocMeta(id, meta) {
    set((s) => ({
      docs: s.docs[id] ? { ...s.docs, [id]: { ...s.docs[id], ...meta } } : s.docs,
    }));
  },
}));
