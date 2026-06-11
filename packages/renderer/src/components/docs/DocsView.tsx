import React, { useEffect, useState, useMemo } from 'react';
import { useDocsStore } from '../../store/docs';
import type { Doc, SortBy, FilterBy } from '../../store/docs';
import { useAuthStore } from '../../store/auth';
import { DocEditor } from './DocEditor';
import { FileTree } from './FileTree';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  workspaceId: string;
}

interface Version {
  id: string;
  createdAt: string;
  editor: { id: string; displayName: string };
  content: string;
}

const TEMPLATES = [
  { label: '빈 문서', content: '' },
  { label: '캐릭터 설계', content: `# 캐릭터 설계서\n\n## 기본 정보\n- 이름: \n- 역할: \n\n## 배경\n\n## 능력치\n` },
  { label: '레벨 설계', content: `# 레벨 설계서\n\n## 개요\n\n## 레이아웃\n\n## 적 배치\n` },
  { label: '버그 리포트', content: `# 버그 리포트\n\n## 요약\n\n## 재현 방법\n1. \n\n## 예상 동작\n\n## 실제 동작\n` },
];

function buildFolderTree(docs: Doc[]): Record<string, Doc[]> {
  const tree: Record<string, Doc[]> = { '': [] };
  for (const doc of docs) {
    const slash = doc.title.indexOf('/');
    if (slash > 0) {
      const folder = doc.title.slice(0, slash);
      if (!tree[folder]) tree[folder] = [];
      tree[folder].push(doc);
    } else {
      tree[''].push(doc);
    }
  }
  return tree;
}

export function DocsView({ workspaceId }: Props): React.ReactElement {
  const {
    fetchDocs, setActive, activeDocId, obsidianTree, loadObsidianTree,
    sortBy, filterBy, filterTag, starredIds, setSortBy, setFilterBy, toggleStar,
  } = useDocsStore();
  const { user } = useAuthStore();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState(0);
  const [creating, setCreating] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [vaultPath] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    fetchDocs(workspaceId, query || undefined).then((data) => {
      setDocs(data);
      // Collect all tags
      const tags = new Set<string>();
      data.forEach((d) => d.metadata?.tags?.forEach((t) => tags.add(t)));
      setAllTags([...tags]);
    }).catch(() => {});
  }, [workspaceId, query, fetchDocs]);

  const filteredAndSorted = useMemo(() => {
    let result = [...docs];

    // Filter
    if (filterBy === 'mine' && user) {
      result = result.filter((d) => d.createdBy === user.id);
    } else if (filterBy === 'starred') {
      result = result.filter((d) => starredIds.has(d.id));
    } else if (filterBy === 'tagged' && filterTag) {
      result = result.filter((d) => d.metadata?.tags?.includes(filterTag));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'ko');
      if (sortBy === 'createdAt') return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [docs, filterBy, filterTag, sortBy, starredIds, user]);

  const folderTree = useMemo(() => buildFolderTree(filteredAndSorted), [filteredAndSorted]);
  const folders = useMemo(() =>
    Object.keys(folderTree).filter((k) => k !== '').sort(),
    [folderTree]
  );

  async function createDoc(): Promise<void> {
    if (!newTitle.trim()) { toast.error('제목을 입력하세요'); return; }
    setCreating(true);
    try {
      const { data } = await api.post('/documents', {
        workspaceId,
        title: newTitle.trim(),
        content: TEMPLATES[newTemplate].content,
      });
      const doc = data as Doc;
      setDocs((prev) => [doc, ...prev]);
      setActive(doc.id);
      setShowCreate(false);
      setNewTitle('');
      setNewTemplate(0);
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

  function toggleFolder(folder: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  function DocRow({ doc }: { doc: Doc }) {
    const isActive = activeDocId === doc.id;
    const isStarred = starredIds.has(doc.id);
    // Strip folder prefix for display
    const displayTitle = doc.title.includes('/') ? doc.title.split('/').slice(1).join('/') : doc.title;

    return (
      <div
        className={`group flex items-center px-3 py-1.5 text-xs transition-colors cursor-pointer ${
          isActive ? 'bg-accent/15 text-white' : 'text-white/70 hover:bg-white/5'
        }`}
        onClick={() => setActive(doc.id)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {doc.source !== 'internal' && (
              <span className="text-[9px] bg-accent/20 text-accent px-1 rounded uppercase flex-shrink-0">
                {doc.source}
              </span>
            )}
            <span className="truncate font-medium">{displayTitle}</span>
            {(doc._count?.comments ?? 0) > 0 && (
              <span className="text-white/30 flex-shrink-0">💬{doc._count!.comments}</span>
            )}
          </div>
          <div className="text-white/30 text-[10px] mt-0.5 flex gap-1.5 items-center">
            <span>{formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: ko })}</span>
            {doc.metadata?.tags && doc.metadata.tags.length > 0 && (
              <span className="text-accent/60">#{doc.metadata.tags[0]}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar(doc.id); }}
          className={`flex-shrink-0 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''} ${isStarred ? '!opacity-100 text-yellow-400' : 'text-white/20 hover:text-yellow-400'}`}
          title={isStarred ? '즐겨찾기 해제' : '즐겨찾기'}
        >
          {isStarred ? '★' : '☆'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Document list sidebar */}
      {!fullscreen && (
        <div className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col">
          {/* Search */}
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

          {/* Sort & Filter controls */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5 flex-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-white/5 border border-white/10 rounded text-[10px] px-1.5 py-0.5 text-white/60 outline-none cursor-pointer"
            >
              <option value="updatedAt">최근 수정</option>
              <option value="title">이름</option>
              <option value="createdAt">생성일</option>
            </select>
            <select
              value={filterBy === 'tagged' ? `tagged:${filterTag}` : filterBy}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('tagged:')) setFilterBy('tagged', v.slice(7));
                else setFilterBy(v as FilterBy);
              }}
              className="bg-white/5 border border-white/10 rounded text-[10px] px-1.5 py-0.5 text-white/60 outline-none cursor-pointer flex-1 min-w-0"
            >
              <option value="all">전체</option>
              <option value="mine">내 문서</option>
              <option value="starred">즐겨찾기</option>
              {allTags.map((t) => (
                <option key={t} value={`tagged:${t}`}>#{t}</option>
              ))}
            </select>
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

          {/* Folder tree */}
          <div className="flex-1 overflow-y-auto py-1">
            {/* Starred section shortcut */}
            {filterBy === 'all' && starredIds.size > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-wide">즐겨찾기</div>
                {filteredAndSorted
                  .filter((d) => starredIds.has(d.id))
                  .map((doc) => <DocRow key={`star-${doc.id}`} doc={doc} />)}
                <div className="border-t border-white/5 my-1" />
              </div>
            )}

            {/* Folders */}
            {folders.map((folder) => (
              <div key={folder}>
                <button
                  onClick={() => toggleFolder(folder)}
                  className="w-full text-left px-3 py-1 text-[10px] font-semibold text-white/40 hover:text-white/70 uppercase tracking-wide flex items-center gap-1 transition-colors"
                >
                  <span>{expandedFolders.has(folder) ? '▾' : '▸'}</span>
                  <span className="truncate">{folder}</span>
                  <span className="text-white/20 ml-auto">{folderTree[folder].length}</span>
                </button>
                {expandedFolders.has(folder) && folderTree[folder].map((doc) => (
                  <div key={doc.id} className="pl-2">
                    <DocRow doc={doc} />
                  </div>
                ))}
              </div>
            ))}

            {/* Root documents */}
            {folderTree['']?.map((doc) => <DocRow key={doc.id} doc={doc} />)}

            {filteredAndSorted.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-white/30">
                문서가 없습니다.<br />
                <button onClick={() => setShowCreate(true)} className="text-accent hover:underline mt-1">
                  첫 문서 만들기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeDocId ? (
          <>
            {/* Doc toolbar */}
            <div className="flex items-center justify-end px-4 py-2 border-b border-white/10 gap-2 flex-shrink-0">
              {fullscreen && (
                <button
                  onClick={() => setFullscreen(false)}
                  className="text-xs text-accent hover:text-accent/70 px-2 py-1 rounded hover:bg-white/5 transition-colors mr-auto"
                >
                  ← 목록으로
                </button>
              )}
              <button
                onClick={() => void loadVersions(activeDocId)}
                className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              >
                버전 히스토리
              </button>
            </div>
            <DocEditor
              docId={activeDocId}
              vaultPath={vaultPath || undefined}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen((v) => !v)}
            />
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
              placeholder="문서 제목... (예: 캐릭터/전사)"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent mb-3"
              autoFocus
            />
            <div className="mb-4">
              <div className="text-xs text-white/40 mb-2">템플릿 선택</div>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setNewTemplate(i)}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left ${
                      newTemplate === i
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
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
                    <div className="text-xs text-white/40">
                      {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: ko })}
                    </div>
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
