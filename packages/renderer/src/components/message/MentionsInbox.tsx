import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useChannelsStore } from '../../store/channels';

interface MentionMessage {
  id: string;
  content: string;
  contextId: string;
  contextType: string;
  createdAt: string;
  sender: { id: string; displayName: string; avatarUrl?: string };
}

interface Notification {
  id: string;
  isRead: boolean;
  createdAt: string;
  message: MentionMessage | null;
}

interface Props {
  onSelectChannel(id: string): void;
}

export function MentionsInbox({ onSelectChannel }: Props): React.ReactElement {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { channels } = useChannelsStore();

  useEffect(() => {
    setLoading(true);
    api.get<Notification[]>('/notifications', { params: { type: 'mention' } })
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function markRead(id: string): void {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  }

  function markAllRead(): void {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    api.post('/notifications/read-all').catch(() => {});
  }

  function handleClick(notification: Notification): void {
    markRead(notification.id);
    if (notification.message?.contextType === 'channel') {
      onSelectChannel(notification.message.contextId);
    }
  }

  function channelName(contextId: string): string {
    return channels.find((c) => c.id === contextId)?.name ?? '채널';
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60_000))}분 전`;
    if (diffH < 24) return `${diffH}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-primary)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">멘션</span>
          {unread > 0 && (
            <span className="px-1.5 py-0.5 bg-accent rounded-full text-[10px] font-medium text-white">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            모두 읽음
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-white/40 text-sm">불러오는 중...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
            <span className="text-4xl">@</span>
            <p className="text-sm">멘션이 없습니다</p>
          </div>
        )}
        {!loading && items.map((notif) => {
          if (!notif.message) return null;
          const msg = notif.message;
          return (
            <button
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3 ${
                notif.isRead ? 'opacity-60' : ''
              }`}
            >
              {!notif.isRead && (
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
              )}
              <div className={`flex flex-col gap-1 min-w-0 ${notif.isRead ? 'ml-[18px]' : ''}`}>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  {msg.sender.avatarUrl ? (
                    <img src={msg.sender.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[9px] text-accent">
                      {msg.sender.displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-white/70">{msg.sender.displayName}</span>
                  {msg.contextType === 'channel' && (
                    <span className="text-white/30">in #{channelName(msg.contextId)}</span>
                  )}
                  <span className="ml-auto text-white/30 flex-shrink-0">{formatTime(notif.createdAt)}</span>
                </div>
                <p className="text-sm text-white/80 truncate">{msg.content}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
