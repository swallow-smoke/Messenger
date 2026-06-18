import React, { useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { BADGE_LIST, BADGE_META, type SocialBadgeType } from './socialBadges';

interface Props {
  workspaceId: string;
  toUserId: string;
  toDisplayName: string;
  onClose(): void;
}

const MESSAGE_MAX = 100;

export function GiveBadgeModal({ workspaceId, toUserId, toDisplayName, onClose }: Props): React.ReactElement {
  const [type, setType] = useState<SocialBadgeType>('helpful');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleGive(): Promise<void> {
    setSaving(true);
    try {
      await api.post(`/workspaces/${workspaceId}/members/${toUserId}/social-badges`, {
        type,
        message: message.trim() || null,
      });
      toast.success(`${toDisplayName}님에게 ${BADGE_META[type].emoji} ${BADGE_META[type].label} 배지를 보냈습니다`);
      onClose();
    } catch {
      // error toast handled by the api interceptor (e.g. monthly limit 429)
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">배지 주기 · {toDisplayName}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="grid grid-cols-1 gap-1.5 mb-4">
          {BADGE_LIST.map((b) => (
            <button
              key={b.type}
              onClick={() => setType(b.type)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                type === b.type ? b.chip : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              <span className="text-lg">{b.emoji}</span>
              <span>{b.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-4">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
            placeholder="메시지 (선택)"
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
          />
          <div className="text-right text-[10px] text-white/30 mt-1">{message.length} / {MESSAGE_MAX}</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => void handleGive()}
            disabled={saving}
            className="flex-1 py-2 text-sm bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {saving ? '보내는 중...' : '배지 주기'}
          </button>
        </div>
      </div>
    </div>
  );
}
