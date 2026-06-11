import React, { useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Workspace {
  id: string;
  name: string;
  iconUrl?: string;
}

interface Props {
  onClose(): void;
  onCreated(workspace: Workspace): void;
}

export function WorkspaceCreateModal({ onClose, onCreated }: Props): React.ReactElement {
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) { setError('이름을 입력하세요'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/workspaces', {
        name: name.trim(),
        ...(iconUrl.trim() ? { iconUrl: iconUrl.trim() } : {}),
      });
      onCreated(data as Workspace);
      onClose();
      toast.success(`워크스페이스 "${(data as Workspace).name}" 생성 완료`);
    } catch {
      setError('워크스페이스 생성에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">새 워크스페이스 만들기</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">워크스페이스 이름 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 우리 게임 개발팀"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">아이콘 URL (선택)</label>
            <input
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-sm bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg font-medium transition-colors"
            >
              {loading ? '생성 중...' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
