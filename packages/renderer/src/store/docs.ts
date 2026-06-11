import { create } from 'zustand';
import api from '../lib/api';
import type { FileNode } from '../types/electron';

export interface DocVersion {
  id: string;
  createdAt: string;
  editor: { id: string; displayName: string; avatarUrl?: string };
  content: string;
}

export interface Doc {
  id: string;
  title: string;
  content: string | null;
  source: 'internal' | 'notion' | 'obsidian';
  externalId?: string;
  externalUrl?: string;
  updatedAt: string;
  createdAt?: string;
  createdBy?: string;
  metadata?: { tags?: string[]; [key: string]: unknown };
  _count?: { comments: number };
  versions?: DocVersion[];
  creator?: { id: string; displayName: string; avatarUrl?: string };
}

export interface DocComment {
  id: string;
  documentId: string;
  authorId: string;
  author: { id: string; displayName: string; avatarUrl?: string };
  parentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  replies: DocComment[];
}

export type SortBy = 'updatedAt' | 'title' | 'createdAt';
export type FilterBy = 'all' | 'mine' | 'starred' | 'tagged';

interface DocsState {
  docs: Record<string, Doc>;
  activeDocId: string | null;
  obsidianTree: FileNode[];
  sortBy: SortBy;
  filterBy: FilterBy;
  filterTag: string | null;
  starredIds: Set<string>;
  fetchDocs(workspaceId: string, q?: string): Promise<Doc[]>;
  fetchDoc(id: string): Promise<void>;
  saveDoc(id: string, content: string, vaultPath?: string): Promise<void>;
  updateDocTags(id: string, tags: string[]): Promise<void>;
  loadObsidianTree(vaultPath: string): Promise<void>;
  openObsidianFile(filePath: string, vaultPath: string): Promise<string>;
  setActive(id: string | null): void;
  updateDocMeta(id: string, meta: Partial<Doc>): void;
  setSortBy(sort: SortBy): void;
  setFilterBy(filter: FilterBy, tag?: string | null): void;
  toggleStar(id: string): void;
}

function loadStarred(): Set<string> {
  try {
    const raw = localStorage.getItem('doc_starred');
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function saveStarred(ids: Set<string>): void {
  localStorage.setItem('doc_starred', JSON.stringify([...ids]));
}

export const useDocsStore = create<DocsState>((set, get) => ({
  docs: {},
  activeDocId: null,
  obsidianTree: [],
  sortBy: 'updatedAt',
  filterBy: 'all',
  filterTag: null,
  starredIds: loadStarred(),

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
      set((s) => ({ docs: { ...s.docs, [id]: { ...s.docs[id], ...(data as Doc) } } }));
    }
  },

  async updateDocTags(id, tags) {
    const doc = get().docs[id];
    const metadata = { ...(doc?.metadata ?? {}), tags };
    await api.patch(`/documents/${id}`, { metadata });
    set((s) => ({
      docs: { ...s.docs, [id]: { ...s.docs[id], metadata } },
    }));
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

  setSortBy(sort) {
    set({ sortBy: sort });
  },

  setFilterBy(filter, tag = null) {
    set({ filterBy: filter, filterTag: tag });
  },

  toggleStar(id) {
    set((s) => {
      const next = new Set(s.starredIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveStarred(next);
      return { starredIds: next };
    });
  },
}));
