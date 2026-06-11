import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChannelsStore } from '../../store/channels';

interface Result {
  type: 'channel' | 'user' | 'doc' | 'task';
  id: string;
  label: string;
  sub?: string;
}

interface Props {
  onClose(): void;
  onSelectChannel(id: string): void;
}

export function CommandPalette({ onClose, onSelectChannel }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { channels } = useChannelsStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo<Result[]>(() => {
    const q = query.toLowerCase();
    if (!q) {
      return channels.slice(0, 8).map((ch) => ({
        type: 'channel' as const,
        id: ch.id,
        label: `# ${ch.name}`,
        sub: ch.description,
      }));
    }
    return channels
      .filter((ch) => ch.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((ch) => ({
        type: 'channel' as const,
        id: ch.id,
        label: `# ${ch.name}`,
        sub: ch.description,
      }));
  }, [query, channels]);

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused((f) => Math.min(f + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused((f) => Math.max(f - 1, 0));
    } else if (e.key === 'Enter') {
      const r = results[focused];
      if (r) {
        if (r.type === 'channel') onSelectChannel(r.id);
        onClose();
      }
    }
  }

  function select(r: Result): void {
    if (r.type === 'channel') onSelectChannel(r.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-white/20 rounded-xl w-[520px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocused(0); }}
            onKeyDown={handleKeyDown}
            placeholder="채널, 문서, 태스크 검색..."
            className="flex-1 bg-transparent outline-none text-white placeholder-white/40 text-sm"
          />
          <kbd className="text-white/30 text-xs border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-white/40 text-sm">결과 없음</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => select(r)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                i === focused ? 'bg-accent/20' : 'hover:bg-white/5'
              }`}
            >
              <span className="text-white/40 text-xs w-14 flex-shrink-0 capitalize">{r.type}</span>
              <span className="text-white text-sm font-medium">{r.label}</span>
              {r.sub && <span className="text-white/40 text-xs truncate">{r.sub}</span>}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-white/10 flex gap-4 text-xs text-white/30">
          <span><kbd className="border border-white/10 rounded px-1">↑↓</kbd> 이동</span>
          <span><kbd className="border border-white/10 rounded px-1">↵</kbd> 선택</span>
          <span><kbd className="border border-white/10 rounded px-1">Esc</kbd> 닫기</span>
        </div>
      </div>
    </div>
  );
}
