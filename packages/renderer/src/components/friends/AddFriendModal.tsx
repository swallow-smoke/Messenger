import React, { useState, useRef } from 'react';
import api from '../../lib/api';
import { useFriendsStore } from '../../store/friends';
import { useAuthStore } from '../../store/auth';
import toast from 'react-hot-toast';

interface UserResult {
  id: string;
  displayName: string;
  avatarUrl?: string;
  email: string;
}

interface Props {
  onClose(): void;
}

export function AddFriendModal({ onClose }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const { sendRequest, getRelationship } = useFriendsStore();
  const { user } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const q = e.target.value;
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<UserResult[]>(`/users/search?q=${encodeURIComponent(q)}`);
        setResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function handleSend(userId: string): Promise<void> {
    setSending(userId);
    try {
      await sendRequest(userId);
      toast.success('친구 요청을 보냈습니다');
    } finally {
      setSending(null);
    }
  }

  function getButtonState(userId: string): { label: string; disabled: boolean } {
    const rel = getRelationship(userId, user?.id ?? '');
    if (rel.status === 'accepted') return { label: '이미 친구', disabled: true };
    if (rel.status === 'pending_sent') return { label: '요청 보냄', disabled: true };
    if (rel.status === 'pending_received') return { label: '받은 요청', disabled: true };
    if (rel.status === 'blocked') return { label: '차단됨', disabled: true };
    return { label: '친구 요청', disabled: false };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-white/15 rounded-2xl shadow-2xl w-[420px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">친구 추가</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white text-lg leading-none">&times;</button>
        </div>

        <input
          autoFocus
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="이름 또는 이메일로 검색..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
        />

        <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
          {searching && (
            <div className="text-center py-4 text-white/40 text-sm">검색 중...</div>
          )}
          {!searching && results.length === 0 && query.length >= 2 && (
            <div className="text-center py-4 text-white/40 text-sm">검색 결과가 없습니다</div>
          )}
          {results.map((u) => {
            const { label, disabled } = getButtonState(u.id);
            const isSending = sending === u.id;
            return (
              <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.displayName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    u.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.displayName}</div>
                  <div className="text-xs text-white/40 truncate">{u.email}</div>
                </div>
                <button
                  onClick={() => void handleSend(u.id)}
                  disabled={disabled || isSending}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                    disabled
                      ? 'bg-white/5 text-white/30 cursor-default'
                      : 'bg-accent hover:bg-accent/80 text-white'
                  }`}
                >
                  {isSending ? '...' : label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
