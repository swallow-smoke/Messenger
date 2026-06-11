import React, { useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  workspaceId: string;
  onClose(): void;
}

export function ChannelCreateModal({ workspaceId, onClose }: Props): React.ReactElement {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) { setError('채널 이름을 입력하세요'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/channels', {
        name: name.trim(),
        description: description.trim() || undefined,
        isPrivate,
        workspaceId,
      });
      toast.success(`#${name.trim().replace(/^#/, '')} 채널이 생성되었습니다`);
      onClose();
    } catch {
      setError('채널 생성에 실패했습니다');
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
          <h2 className="text-lg font-semibold">새 채널 만들기</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">채널 이름 *</label>
            <div className="flex items-center bg-white/10 rounded-lg px-3 py-2 gap-1.5">
              <span className="text-white/40">#</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="채널-이름"
                className="flex-1 bg-transparent text-sm outline-none placeholder-white/30"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">설명 (선택)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 채널은 무엇을 위한 곳인가요?"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsPrivate((v) => !v)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${isPrivate ? 'bg-accent' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm text-white/70">비공개 채널</span>
          </label>
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
