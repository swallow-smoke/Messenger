import React, { useEffect, useState } from 'react';
import { useDocsStore } from '../../store/docs';
import type { Doc } from '../../store/docs';
import { DocEditor } from './DocEditor';
import { FileTree } from './FileTree';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  workspaceId: string;
}

interface Version {
  id: string;
  createdAt: string;
  editor: { id: string; displayName: string };
  content: string;
}

export function DocsView({ workspaceId }: Props): React.ReactElement {
  const { fetchDocs, setActive, activeDocId, obsidianTree, loadObsidianTree } = useDocsStore();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [vaultPath] = useState<string>('');

  useEffect(() => {
    fetchDocs(workspaceId, query || undefined).then(setDocs).catch(() => {});
  }, [workspaceId, query, fetchDocs]);

  async function createDoc(): Promise<void> {
    if (!newTitle.trim()) { toast.error('제목을 입력하세요'); return; }
    setCreating(true);
    try {
      const { data } = await api.post('/documents', {
        workspaceId,
        title: newTitle.trim(),
        content: '',
      });
      const doc = data as Doc;
      setDocs((prev) => [doc, ...prev]);
      setActive(doc.id);
      setShowCreate(false);
      setNewTitle('');
      toast.success(`"${doc.title}" 문서가 생성되었습니다`);
    } catch {
      toast.error('문서 생성 실패');
    } finally {
      setCreating(false);
    }
  }

  async function loadVersions(docId: string): Promise<void> {
    try {
      const { data } = await api.get(`/documents/${docId}/versions`);
      setVersions(data as Version[]);
      setShowVersions(true);
    } catch {
      toast.error('버전 히스토리 로드 실패');
    }
  }

  async function restoreVersion(version: Version): Promise<void> {
    if (!activeDocId) return;
    try {
      await api.patch(`/documents/${activeDocId}`, { content: version.content });
      toast.success('버전이 복원되었습니다');
      setShowVersions(false);
    } catch {
      toast.error('복원 실패');
    }
  }

  return (
    <div className="flex h-full">
      {/* Document list sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col">
        <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문서 검색..."
            className="flex-1 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none placeholder-white/30"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="w-6 h-6 flex items-center justify-center bg-accent hover:bg-accent/80 rounded text-xs font-bold transition-colors"
            title="새 문서"
          >
            +
          </button>
        </div>

        {/* Obsidian vault section */}
        {obsidianTree.length > 0 && (
          <div className="border-b border-white/10">
            <div className="px-3 py-1.5 text-xs font-semibold text-white/40 uppercase tracking-wide">Obsidian</div>
            <div className="max-h-40 overflow-y-auto">
              <FileTree
                nodes={obsidianTree}
                vaultPath={vaultPath}
                onOpen={(filePath, vault) => {
                  void loadObsidianTree(vault || filePath);
                }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setActive(doc.id)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                activeDocId === doc.id
                  ? 'bg-accent/15 text-white'
                  : 'text-white/70 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {doc.source !== 'internal' && (
                  <span className="text-[9px] bg-accent/20 text-accent px-1 rounded uppercase flex-shrink-0">
                    {doc.source}
                  </span>
                )}
                <span className="truncate font-medium">{doc.title}</span>
              </div>
              <div className="text-white/30 text-[10px] mt-0.5">
                {new Date(doc.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
          {docs.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-white/30">
              문서가 없습니다.<br />
              <button onClick={() => setShowCreate(true)} className="text-accent hover:underline mt-1">
                첫 문서 만들기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeDocId ? (
          <>
            {/* Doc toolbar */}
            <div className="flex items-center justify-end px-4 py-2 border-b border-white/10 gap-2 flex-shrink-0">
              <button
                onClick={() => void loadVersions(activeDocId)}
                className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              >
                버전 히스토리
              </button>
            </div>
            <DocEditor docId={activeDocId} vaultPath={vaultPath || undefined} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3">
            <span className="text-5xl">📄</span>
            <p className="text-sm">문서를 선택하거나 새로 만드세요</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs text-accent hover:text-accent/80"
            >
              새 문서 만들기
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div
            className="bg-surface border border-white/10 rounded-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4">새 문서 만들기</h2>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void createDoc(); }}
              placeholder="문서 제목..."
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 text-sm text-white/60 border border-white/10 rounded-lg hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => void createDoc()}
                disabled={creating}
                className="flex-1 py-2 text-sm bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {creating ? '생성 중...' : '만들기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version history panel */}
      {showVersions && activeDocId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowVersions(false)}>
          <div
            className="bg-surface border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="font-semibold">버전 히스토리</h2>
              <button onClick={() => setShowVersions(false)} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {versions.length === 0 && (
                <p className="text-center text-white/30 text-sm py-8">저장된 버전이 없습니다</p>
              )}
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">{v.editor.displayName}</div>
                    <div className="text-xs text-white/40">{new Date(v.createdAt).toLocaleString()}</div>
                    <div className="text-xs text-white/30 mt-0.5 truncate max-w-xs">
                      {v.content.slice(0, 80)}...
                    </div>
                  </div>
                  <button
                    onClick={() => void restoreVersion(v)}
                    className="text-xs text-accent hover:text-accent/70 px-3 py-1 border border-accent/30 rounded transition-colors"
                  >
                    복원
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
