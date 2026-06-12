import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { usePresenceStore } from '../../store/presence';
import { useDMStore } from '../../store/dm';
import { useAuthStore } from '../../store/auth';

interface ChannelMember {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: string;
  statusText?: string;
  role: string;
}

interface Props {
  activeChannelId: string | null;
  activeDMConversationId: string | null;
  activeTab: string;
  onOpenDM(userId: string): void;
}

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

const STATUS_ORDER: Record<string, number> = { online: 0, away: 1, dnd: 2, offline: 3 };

export function MemberPanel({ activeChannelId, activeDMConversationId, activeTab, onOpenDM }: Props): React.ReactElement {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(true);
  const presences = usePresenceStore((s) => s.presences);
  const { conversations } = useDMStore();
  const { user } = useAuthStore();

  const fetchChannelMembers = useCallback(async (channelId: string): Promise<void> => {
    try {
      const { data } = await api.get<ChannelMember[]>(`/channels/${channelId}/members`);
      setMembers(data);
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'channels' && activeChannelId) {
      void fetchChannelMembers(activeChannelId);
    } else if (activeTab === 'dm' && activeDMConversationId) {
      const conv = conversations.find((c) => c.id === activeDMConversationId);
      if (conv) {
        setMembers(
          conv.members.map((m) => ({
            userId: m.user.id,
            displayName: m.user.displayName,
            avatarUrl: m.user.avatarUrl,
            status: m.user.status ?? 'offline',
            role: 'member',
          }))
        );
      }
    } else {
      setMembers([]);
    }
  }, [activeTab, activeChannelId, activeDMConversationId, conversations, fetchChannelMembers]);

  // Re-apply live presence to members
  const enriched = members.map((m) => {
    const p = presences[m.userId];
    return { ...m, status: p?.status ?? m.status, statusText: p?.statusText ?? m.statusText };
  });

  const online = enriched.filter((m) => m.status !== 'offline').sort((a, b) => {
    const order = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
    return order !== 0 ? order : a.displayName.localeCompare(b.displayName);
  });
  const offline = enriched.filter((m) => m.status === 'offline').sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  function renderMember(m: typeof enriched[0]): React.ReactElement {
    return (
      <button
        key={m.userId}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/8 transition-colors text-left"
        onClick={() => { if (user && m.userId !== user.id) onOpenDM(m.userId); }}
        title={m.userId === user?.id ? undefined : `DM 보내기: ${m.displayName}`}
      >
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.displayName} className="w-full h-full rounded-full object-cover" />
            ) : (
              m.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-secondary,#1e1e2e)] ${STATUS_COLOR[m.status] ?? 'bg-gray-500'}`} />
        </div>
        <span className={`text-xs truncate ${m.status === 'offline' ? 'text-white/40' : 'text-white/80'}`}>
          {m.displayName}
          {m.userId === user?.id ? ' (나)' : ''}
        </span>
      </button>
    );
  }

  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-sidebar border-l border-white/10 h-full overflow-hidden">
      <div className="px-3 py-3 border-b border-white/10 flex-shrink-0">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">멤버</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {members.length === 0 ? (
          <div className="text-center py-8 text-white/20 text-xs">멤버 없음</div>
        ) : (
          <>
            {/* Online section */}
            <button
              className="w-full flex items-center gap-1 px-3 py-1 text-left"
              onClick={() => setOnlineOpen((v) => !v)}
            >
              <svg
                className={`w-2.5 h-2.5 text-white/30 transition-transform ${onlineOpen ? 'rotate-90' : ''}`}
                fill="currentColor" viewBox="0 0 8 8"
              >
                <path d="M2 1l4 3-4 3V1z" />
              </svg>
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                온라인 — {online.length}명
              </span>
            </button>
            {onlineOpen && online.map((m) => renderMember(m))}

            {/* Offline section */}
            {offline.length > 0 && (
              <>
                <button
                  className="w-full flex items-center gap-1 px-3 py-1 mt-2 text-left"
                  onClick={() => setOfflineOpen((v) => !v)}
                >
                  <svg
                    className={`w-2.5 h-2.5 text-white/30 transition-transform ${offlineOpen ? 'rotate-90' : ''}`}
                    fill="currentColor" viewBox="0 0 8 8"
                  >
                    <path d="M2 1l4 3-4 3V1z" />
                  </svg>
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                    오프라인 — {offline.length}명
                  </span>
                </button>
                {offlineOpen && offline.map((m) => renderMember(m))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
