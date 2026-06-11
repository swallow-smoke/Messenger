import React from 'react';
import { usePresenceStore } from '../../store/presence';

interface Props {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  onClose(): void;
  onOpenDM?(userId: string): void;
  style?: React.CSSProperties;
}

const STATUS_LABEL: Record<string, string> = {
  online: '온라인',
  away: '자리 비움',
  dnd: '방해 금지',
  offline: '오프라인',
};

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export function UserHoverCard({ userId, displayName, avatarUrl, email, onClose, onOpenDM, style }: Props): React.ReactElement {
  const getStatus = usePresenceStore((s) => s.getStatus);
  const presences = usePresenceStore((s) => s.presences);
  const status = getStatus(userId);
  const statusText = presences[userId]?.statusText;

  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div
      className="absolute z-50 bg-surface border border-white/15 rounded-xl shadow-2xl p-4 w-64"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-2 right-2 text-white/30 hover:text-white text-sm">&times;</button>
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-bold">
              {initials}
            </div>
          )}
          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-surface ${STATUS_COLOR[status]}`} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{displayName}</div>
          {email && <div className="text-xs text-white/40 truncate">{email}</div>}
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[status]}`} />
            <span className="text-xs text-white/50">{STATUS_LABEL[status] ?? status}</span>
          </div>
          {statusText && <div className="text-xs text-white/60 mt-0.5 truncate">{statusText}</div>}
        </div>
      </div>
      {onOpenDM && (
        <button
          onClick={() => { onOpenDM(userId); onClose(); }}
          className="w-full py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          메시지 보내기
        </button>
      )}
    </div>
  );
}
