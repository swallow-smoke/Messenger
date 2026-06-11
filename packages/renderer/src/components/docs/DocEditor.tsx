import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useDocsStore } from '../../store/docs';
import { DocToc } from './DocToc';
import { DocComments } from './DocComments';

interface Props {
  docId: string;
  vaultPath?: string;
  fullscreen?: boolean;
  onToggleFullscreen?(): void;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function readTime(text: string): number {
  const WORDS_PER_MIN = 200;
  return Math.max(1, Math.round(wordCount(text) / WORDS_PER_MIN));
}

const TEMPLATES: Array<{ label: string; content: string }> = [
  { label: '빈 문서', content: '' },
  {
    label: '캐릭터 설계',
    content: `# 캐릭터 설계서\n\n## 기본 정보\n- 이름: \n- 역할: \n- 외형: \n\n## 배경 스토리\n\n## 능력치\n\n## 특수 능력\n\n## 관계\n`,
  },
  {
    label: '레벨 설계',
    content: `# 레벨 설계서\n\n## 개요\n- 레벨명: \n- 배경: \n- 난이도: \n\n## 목표\n\n## 레이아웃\n\n## 적 배치\n\n## 체크포인트\n`,
  },
  {
    label: '버그 리포트',
    content: `# 버그 리포트\n\n## 요약\n\n## 재현 방법\n1. \n2. \n3. \n\n## 예상 동작\n\n## 실제 동작\n\n## 환경\n- OS: \n- 버전: \n\n## 스크린샷\n`,
  },
];

export function DocEditor({ docId, vaultPath, fullscreen, onToggleFullscreen }: Props): React.ReactElement {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { docs, fetchDoc, saveDoc, updateDocTags } = useDocsStore();
  const doc = docs[docId];
  const [liveContent, setLiveContent] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  useEffect(() => {
    void fetchDoc(docId);
  }, [docId, fetchDoc]);

  // Sync liveContent when doc loads
  useEffect(() => {
    if (doc?.content !== undefined && doc.content !== null) {
      setLiveContent(doc.content);
    }
  }, [doc?.id]);

  const scheduleSave = useCallback(
    (content: string) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveDoc(docId, content, vaultPath);
      }, 1000);
    },
    [docId, saveDoc, vaultPath]
  );

  useEffect(() => {
    if (!editorRef.current || !doc) return;
    if (viewRef.current) {
      viewRef.current.destroy();
    }
    const view = new EditorView({
      doc: doc.content ?? '',
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            setLiveContent(content);
            scheduleSave(content);
          }
        }),
      ],
      parent: editorRef.current,
    });
    viewRef.current = view;
    setLiveContent(doc.content ?? '');
    return () => { view.destroy(); clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, scheduleSave]);

  function jumpToLine(lineIndex: number) {
    const view = viewRef.current;
    if (!view) return;
    const lines = view.state.doc.toString().split('\n');
    let charOffset = 0;
    for (let i = 0; i < Math.min(lineIndex, lines.length); i++) {
      charOffset += lines[i].length + 1;
    }
    view.dispatch({ selection: { anchor: charOffset }, scrollIntoView: true });
    view.focus();
  }

  function applyTemplate(content: string) {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    });
    setShowTemplateMenu(false);
  }

  function exportMarkdown() {
    const content = viewRef.current?.state.doc.toString() ?? doc?.content ?? '';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc?.title ?? 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tags = useMemo(() => doc?.metadata?.tags ?? [], [doc?.metadata]);

  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    await updateDocTags(docId, next);
  }

  async function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || tags.includes(t)) { setTagInput(''); setShowTagInput(false); return; }
    await updateDocTags(docId, [...tags, t]);
    setTagInput('');
    setShowTagInput(false);
  }

  const wc = useMemo(() => wordCount(liveContent), [liveContent]);
  const rt = useMemo(() => readTime(liveContent), [liveContent]);

  // Last editor from versions
  const lastVersion = doc?.versions?.[0];
  const lastEditorName = lastVersion?.editor.displayName ?? doc?.creator?.displayName;
  const lastEditedAt = lastVersion?.createdAt ?? doc?.updatedAt;

  const collaborators = useMemo(() => {
    if (!doc?.versions) return [];
    const seen = new Set<string>();
    return doc.versions.reduce<Array<{ id: string; displayName: string; avatarUrl?: string }>>(
      (acc, v) => {
        if (!seen.has(v.editor.id)) {
          seen.add(v.editor.id);
          acc.push(v.editor);
        }
        return acc;
      },
      []
    ).slice(0, 5);
  }, [doc?.versions]);

  if (!doc) {
    return <div className="flex-1 flex items-center justify-center text-white/40">Loading...</div>;
  }

  return (
    <div className={`flex flex-col h-full ${fullscreen ? 'fixed inset-0 z-40 bg-background' : ''}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{doc.title}</h1>
          {(lastEditorName || lastEditedAt) && (
            <div className="text-xs text-white/30 mt-0.5">
              마지막 수정: {lastEditorName}
              {lastEditedAt && ` · ${formatDistanceToNow(new Date(lastEditedAt), { addSuffix: true, locale: ko })}`}
            </div>
          )}
        </div>

        {/* Collaborator avatars */}
        {collaborators.length > 0 && (
          <div className="flex -space-x-1.5 flex-shrink-0">
            {collaborators.map((c) => (
              <div
                key={c.id}
                title={c.displayName}
                className="w-6 h-6 rounded-full border-2 border-surface bg-accent/30 flex items-center justify-center text-xs font-medium ring-1 ring-white/10"
              >
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  c.displayName[0].toUpperCase()
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap max-w-48">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent/15 text-accent text-xs rounded-full"
            >
              {tag}
              <button onClick={() => void removeTag(tag)} className="hover:text-red-400 leading-none">×</button>
            </span>
          ))}
          {showTagInput ? (
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addTag();
                if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); }
              }}
              onBlur={() => void addTag()}
              placeholder="태그..."
              autoFocus
              className="w-20 bg-white/10 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-accent"
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="text-xs text-white/30 hover:text-accent px-1 transition-colors"
              title="태그 추가"
            >
              + 태그
            </button>
          )}
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Template menu */}
          <div className="relative">
            <button
              onClick={() => setShowTemplateMenu((v) => !v)}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded text-xs transition-colors"
              title="템플릿"
            >
              📋
            </button>
            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-white/15 rounded-lg shadow-xl z-20 py-1 min-w-36">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t.content)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 text-white/70"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowComments((v) => !v)}
            className={`p-1.5 text-xs rounded transition-colors ${showComments ? 'text-accent bg-accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            title="댓글"
          >
            💬
            {(doc._count?.comments ?? 0) > 0 && (
              <span className="ml-0.5 text-[10px]">{doc._count!.comments}</span>
            )}
          </button>
          <button
            onClick={exportMarkdown}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded text-xs transition-colors"
            title="마크다운으로 내보내기"
          >
            ↓
          </button>
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded text-xs transition-colors"
            title={fullscreen ? '전체화면 종료' : '전체화면 편집'}
          >
            {fullscreen ? '⊡' : '⊞'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* TOC */}
        <DocToc content={liveContent} onJumpToLine={jumpToLine} />

        {/* Editor + comments */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div ref={editorRef} className="flex-1 overflow-auto text-sm" />

          {/* Word count footer */}
          <div className="px-4 py-1.5 border-t border-white/5 flex items-center gap-3 text-xs text-white/25 flex-shrink-0">
            <span>약 {wc.toLocaleString()}자</span>
            <span>·</span>
            <span>읽는 시간 {rt}분</span>
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="border-t border-white/10 overflow-y-auto max-h-[40vh] px-4 pb-4">
              <DocComments docId={docId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
