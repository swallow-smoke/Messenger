import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChannelsStore } from '../../store/channels';
import { useDMStore } from '../../store/dm';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';

interface WorkspaceMember {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface Result {
  type: 'channel' | 'dm' | 'user';
  id: string;
  label: string;
  sub?: string;
  avatarUrl?: string;
}

interface Props {
  onClose(): void;
  onSelectChannel(id: string): void;
  workspaceId?: string;
  onSelectDM?: (id: string) => void;
  onOpenDMWithUser?: (userId: string) => void;
}

export function CommandPalette({ onClose, onSelectChannel, workspaceId, onSelectDM, onOpenDMWithUser }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { channels } = useChannelsStore();
  const { conversations } = useDMStore();
  const { user } = useAuthStore();

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

  useEffect(() => {
    if (!workspaceId) return;
    api.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
      .then(({ data }) => setMembers(data))
      .catch(() => {});
  }, [workspaceId]);

  const results = useMemo<Result[]>(() => {
    const q = query.toLowerCase();

    const channelResults: Result[] = (
      q
        ? channels.filter((ch) => ch.name.toLowerCase().includes(q))
        : channels.slice(0, 5)
    ).slice(0, 5).map((ch) => ({
      type: 'channel' as const,
      id: ch.id,
      label: `# ${ch.name}`,
      sub: ch.description,
    }));

    const dmResults: Result[] = (
      q
        ? conversations.filter((c) => {
            const name = c.name ?? c.members.filter((m) => m.user.id !== user?.id).map((m) => m.user.displayName).join(', ');
            return name.toLowerCase().includes(q);
          })
        : conversations.slice(0, 3)
    ).slice(0, 4).map((c) => {
      const other = c.members.find((m) => m.user.id !== user?.id)?.user;
      const label = c.name ?? other?.displayName ?? 'DM';
      return {
        type: 'dm' as const,
        id: c.id,
        label,
        avatarUrl: other?.avatarUrl,
      };
    });

    const memberResults: Result[] = q
      ? members
          .filter((m) => m.id !== user?.id && m.displayName.toLowerCase().includes(q))
          .slice(0, 4)
          .map((m) => ({
            type: 'user' as const,
            id: m.id,
            label: m.displayName,
            sub: '대화 시작',
            avatarUrl: m.avatarUrl,
          }))
      : [];

    return [...channelResults, ...dmResults, ...memberResults];
  }, [query, channels, conversations, members, user]);

  useEffect(() => {
    setFocused(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused((f) => Math.min(f + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused((f) => Math.max(f - 1, 0));
    } else if (e.key === 'Enter') {
      const r = results[focused];
      if (r) select(r);
    }
  }

  function select(r: Result): void {
    if (r.type === 'channel') onSelectChannel(r.id);
    else if (r.type === 'dm') onSelectDM?.(r.id);
    else if (r.type === 'user') onOpenDMWithUser?.(r.id);
    onClose();
  }

  const TYPE_ICON: Record<Result['type'], string> = {
    channel: '#',
    dm: '💬',
    user: '👤',
  };

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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="채널, DM, 멤버 검색..."
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
              key={`${r.type}-${r.id}`}
              onClick={() => select(r)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                i === focused ? 'bg-accent/20' : 'hover:bg-white/5'
              }`}
            >
              {r.avatarUrl ? (
                <img src={r.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="text-white/40 text-sm w-6 text-center flex-shrink-0">{TYPE_ICON[r.type]}</span>
              )}
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
