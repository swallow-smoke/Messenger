import React, { useEffect, useState } from 'react';
import { useFriendsStore } from '../../store/friends';
import { usePresenceStore } from '../../store/presence';
import { AddFriendModal } from './AddFriendModal';
import toast from 'react-hot-toast';

type FriendTab = 'online' | 'all' | 'pending' | 'blocked';

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  online: '온라인',
  away: '자리 비움',
  dnd: '방해 금지',
  offline: '오프라인',
};

interface Props {
  onOpenDM(userId: string): void;
}

export function FriendsPage({ onOpenDM }: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<FriendTab>('online');
  const [showAddModal, setShowAddModal] = useState(false);
  const { friendships, requests, pendingCount, loading, fetchAll, fetchRequests, acceptRequest, rejectRequest, removeFriend } =
    useFriendsStore();
  const presences = usePresenceStore((s) => s.presences);

  useEffect(() => {
    void fetchAll();
    void fetchRequests();
  }, [fetchAll, fetchRequests]);

  const accepted = friendships.filter((f) => f.status === 'accepted');
  const blocked = friendships.filter((f) => f.status === 'blocked');

  const onlineFriends = accepted.filter((f) => {
    const p = presences[f.otherUser.id];
    return p?.status === 'online' || p?.status === 'away' || p?.status === 'dnd';
  });

  const displayFriends =
    activeTab === 'online' ? onlineFriends :
    activeTab === 'all' ? accepted :
    activeTab === 'blocked' ? blocked : [];

  async function handleAccept(id: string): Promise<void> {
    await acceptRequest(id);
    toast.success('친구 요청을 수락했습니다');
  }

  async function handleReject(id: string): Promise<void> {
    await rejectRequest(id);
  }

  async function handleRemove(id: string, name: string): Promise<void> {
    await removeFriend(id);
    toast.success(`${name}님과 친구가 해제되었습니다`);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h1 className="text-sm font-semibold">친구</h1>

          <div className="flex gap-1 ml-2">
            {([
              ['online', '온라인'],
              ['all', '전체'],
              ['pending', `대기 중${pendingCount > 0 ? ` ${pendingCount}` : ''}`],
              ['blocked', '차단'],
            ] as [FriendTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {label}
                {tab === 'pending' && pendingCount > 0 && (
                  <span className="ml-1 bg-accent text-white text-[9px] rounded-full min-w-[14px] h-[14px] inline-flex items-center justify-center px-0.5">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          친구 추가
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="text-center py-12 text-white/30 text-sm">불러오는 중...</div>
        )}

        {/* Pending tab */}
        {activeTab === 'pending' && !loading && (
          <>
            {requests.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">받은 친구 요청이 없습니다</div>
            ) : (
              <>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2 px-2">
                  받은 요청 — {requests.length}개
                </div>
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {req.requester.avatarUrl ? (
                        <img src={req.requester.avatarUrl} alt={req.requester.displayName} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        req.requester.displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{req.requester.displayName}</div>
                      <div className="text-xs text-white/40">친구 요청을 보냈습니다</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleAccept(req.id)}
                        className="w-8 h-8 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 flex items-center justify-center transition-colors"
                        title="수락"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => void handleReject(req.id)}
                        className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors"
                        title="거절"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* Friends list (online / all / blocked) */}
        {activeTab !== 'pending' && !loading && (
          <>
            {displayFriends.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                {activeTab === 'online' ? '온라인 친구가 없습니다' :
                 activeTab === 'blocked' ? '차단한 유저가 없습니다' : '친구가 없습니다'}
              </div>
            ) : (
              <>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2 px-2">
                  {activeTab === 'online' ? `온라인 — ${displayFriends.length}명` :
                   activeTab === 'blocked' ? `차단 — ${displayFriends.length}명` :
                   `전체 친구 — ${displayFriends.length}명`}
                </div>
                {displayFriends.map((f) => {
                  const presence = presences[f.otherUser.id];
                  const status = presence?.status ?? f.otherUser.status ?? 'offline';
                  const statusText = presence?.statusText ?? f.otherUser.statusText;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-sm font-bold">
                          {f.otherUser.avatarUrl ? (
                            <img src={f.otherUser.avatarUrl} alt={f.otherUser.displayName} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            f.otherUser.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--bg-primary)] ${STATUS_COLOR[status]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{f.otherUser.displayName}</div>
                        <div className="text-xs text-white/40">
                          {statusText ?? STATUS_LABEL[status] ?? status}
                        </div>
                      </div>
                      {activeTab !== 'blocked' && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { onOpenDM(f.otherUser.id); }}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            title="DM 보내기"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => void handleRemove(f.id, f.otherUser.displayName)}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/30 text-white/60 hover:text-red-400 flex items-center justify-center transition-colors"
                            title="친구 삭제"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {showAddModal && <AddFriendModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
