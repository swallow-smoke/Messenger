import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import api from '../../lib/api';
import type { Message } from '../../store/messages';

interface PinnedMessageEntry extends Message {
  pinnedBy: { id: string; displayName: string };
  pinnedAt: string;
}

interface Props {
  channelId: string;
  onClose(): void;
  onGoTo(messageId: string): void;
}

export function PinnedMessagesPanel({ channelId, onClose, onGoTo }: Props): React.ReactElement {
  const [pins, setPins] = useState<PinnedMessageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<PinnedMessageEntry[]>(`/channels/${channelId}/pins`)
      .then(({ data }) => setPins(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId]);

  return (
    <div className="w-72 flex flex-col border-l border-white/10 bg-surface h-full flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span>📌</span>
          <span className="font-semibold text-sm">고정된 메시지</span>
          {!loading && pins.length > 0 && (
            <span className="text-xs text-white/40">{pins.length}개</span>
          )}
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-white/40 text-xs text-center py-8">불러오는 중...</p>
        ) : pins.length === 0 ? (
          <p className="text-white/40 text-xs text-center py-8">고정된 메시지가 없습니다.</p>
        ) : (
          pins.map((pin) => (
            <div
              key={pin.id}
              className="px-4 py-3 border-b border-white/5 hover:bg-white/5 group transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-xs font-medium text-white/90 truncate">
                      {pin.sender.displayName}
                    </span>
                    <span className="text-xs text-white/40 flex-shrink-0">
                      {formatDistanceToNow(new Date(pin.createdAt), { addSuffix: true, locale: ko })}
                    </span>
                  </div>
                  <p className="text-xs text-white/70 line-clamp-3 break-words leading-relaxed">
                    {pin.isDeleted ? '(삭제된 메시지)' : pin.content || '(첨부파일)'}
                  </p>
                  <p className="text-xs text-white/30 mt-1.5">
                    {pin.pinnedBy.displayName}이(가) 고정함
                  </p>
                </div>
                <button
                  onClick={() => onGoTo(pin.id)}
                  className="flex-shrink-0 text-xs text-accent hover:underline opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                >
                  이동
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
