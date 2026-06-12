import React, { useRef, useCallback, useState } from 'react';
import { useChannelsStore } from '../../store/channels';
import { useAuthStore } from '../../store/auth';
import { usePresenceStore } from '../../store/presence';
import { useDMStore } from '../../store/dm';
import { useFriendsStore } from '../../store/friends';
import { useSettingsStore, resolveTheme } from '../../store/settings';
import { UserAvatar } from '../user/UserAvatar';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';

type Tab = 'channels' | 'dm' | 'friends' | 'docs' | 'tasks';

const TAB_LABELS: Record<Tab, string> = {
  channels: '채널',
  dm: 'DM',
  friends: '친구',
  docs: '문서',
  tasks: '태스크',
};

interface Props {
  workspaceId: string;
  activeTab: Tab;
  onTabChange(tab: Tab): void;
  width: number;
  onWidthChange(w: number): void;
  onCreateChannel(): void;
  onOpenProfile(): void;
  onOpenSettings(): void;
  onSelectDM(conversationId: string): void;
}

export type { Tab as SidebarTab };

const STATUS_LABELS: Record<string, string> = {
  online: '온라인',
  away: '자리 비움',
  dnd: '방해 금지',
  offline: '오프라인',
};

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export function Sidebar({
  workspaceId: _workspaceId,
  activeTab,
  onTabChange,
  width,
  onWidthChange,
  onCreateChannel,
  onOpenProfile,
  onOpenSettings,
  onSelectDM,
}: Props): React.ReactElement {
  const { channels, activeChannelId, setActive, unreadCounts } = useChannelsStore();
  const { user, updateStatus, logout } = useAuthStore();
  const presences = usePresenceStore((s) => s.presences);
  const { conversations, activeConversationId, setActiveConversation } = useDMStore();
  const { pendingCount: friendPendingCount } = useFriendsStore();
  const { settings, update } = useSettingsStore();
  const onlineCount = Object.values(presences).filter((p) => p.status === 'online').length;
  const [showUserMenu, setShowUserMenu] = useState(false);

  const resolved = resolveTheme(settings.theme);

  const dragStart = useRef<number | null>(null);
  const dragInitialWidth = useRef<number>(width);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    dragStart.current = e.clientX;
    dragInitialWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: MouseEvent) {
      if (dragStart.current === null) return;
      const delta = ev.clientX - dragStart.current;
      const newWidth = Math.min(320, Math.max(180, dragInitialWidth.current + delta));
      onWidthChange(newWidth);
    }

    function onUp() {
      dragStart.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, onWidthChange]);

  function changeStatus(status: string): void {
    updateStatus(status);
    getSocket().emit('status:set', { status });
    toast.success(`상태: ${STATUS_LABELS[status] ?? status}`);
    setShowUserMenu(false);
  }

  async function handleLogout(): Promise<void> {
    setShowUserMenu(false);
    await logout();
  }

  function toggleTheme(): void {
    update({ theme: resolved === 'dark' ? 'light' : 'dark' });
  }

  return (
    <div className="flex h-full" style={{ width }} data-sidebar="">
      <div className="flex flex-col flex-1 bg-sidebar border-r border-white/10 h-full overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {(['channels', 'dm', 'friends', 'docs', 'tasks'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex-1 py-2 text-xs transition-colors relative ${
                activeTab === tab
                  ? 'text-white border-b-2 border-accent'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {TAB_LABELS[tab]}
              {tab === 'friends' && friendPendingCount > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-accent rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {activeTab === 'channels' && (
            <>
              <div className="px-3 mb-1 flex items-center justify-between">
                <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">채널</span>
                <div className="flex items-center gap-2">
                  {onlineCount > 0 && (
                    <span className="text-white/30 text-xs">{onlineCount}명 온라인</span>
                  )}
                  <button
                    onClick={onCreateChannel}
                    className="text-white/30 hover:text-white text-base leading-none w-4 h-4 flex items-center justify-center"
                    title="채널 만들기"
                  >
                    +
                  </button>
                </div>
              </div>
              {channels.map((ch) => {
                const unread = unreadCounts[ch.id] ?? 0;
                return (
                  <button
                    key={ch.id}
                    onClick={() => { setActive(ch.id); onTabChange('channels'); }}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded mx-1 flex items-center justify-between transition-colors ${
                      activeChannelId === ch.id
                        ? 'bg-accent/20 text-white'
                        : unread > 0
                        ? 'text-white font-medium hover:bg-white/10'
                        : 'text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-white/40">#</span>
                      <span className="truncate">{ch.name}</span>
                    </span>
                    {unread > 0 && (
                      <span className="bg-accent text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0 font-semibold">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                );
              })}
              {channels.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-white/30">
                  채널이 없습니다.{' '}
                  <button onClick={onCreateChannel} className="text-accent hover:underline">
                    채널 만들기
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'dm' && (
            <>
              <div className="px-3 mb-1 flex items-center justify-between">
                <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">다이렉트 메시지</span>
              </div>
              {conversations.map((conv) => {
                const others = conv.members.filter((m) => m.user.id !== user?.id);
                const name = conv.name ?? others.map((m) => m.user.displayName).join(', ');
                const unread = conv.unreadCount;
                return (
                  <button
                    key={conv.id}
                    onClick={() => { setActiveConversation(conv.id); onSelectDM(conv.id); }}
                    className={`w-full text-left px-3 py-1.5 rounded mx-1 flex items-center justify-between transition-colors ${
                      activeConversationId === conv.id
                        ? 'bg-accent/20 text-white'
                        : unread > 0
                        ? 'text-white font-medium hover:bg-white/10'
                        : 'text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex -space-x-1.5 flex-shrink-0">
                        {others.slice(0, 2).map((m) => (
                          <div key={m.user.id} className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold border border-sidebar">
                            {m.user.avatarUrl ? (
                              <img src={m.user.avatarUrl} alt={m.user.displayName} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              m.user.displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-sm truncate">{name || 'Unknown'}</span>
                    </div>
                    {unread > 0 && (
                      <span className="bg-accent text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0 font-semibold">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                );
              })}
              {conversations.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-white/30">
                  DM이 없습니다
                </div>
              )}
            </>
          )}

          {activeTab === 'friends' && (
            <div className="px-3 py-4 text-center">
              <div className="text-xs text-white/30">친구 탭에서 친구를 관리하세요</div>
              {friendPendingCount > 0 && (
                <div className="mt-2 text-xs text-accent font-medium">
                  대기 중인 요청 {friendPendingCount}개
                </div>
              )}
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="px-3 py-2 text-xs text-white/40">
              좌측 패널에서 문서를 관리하세요
            </div>
          )}
          {activeTab === 'tasks' && (
            <div className="px-3 py-2 text-xs text-white/40">
              태스크 보드
            </div>
          )}
        </div>

        {/* Footer: user + theme toggle */}
        <div className="flex-shrink-0 border-t border-white/10 px-2 py-2">
          {user && (
            <div className="relative mb-1">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-full flex items-center gap-2 px-1 py-1 rounded hover:bg-white/5 transition-colors"
              >
                <UserAvatar
                  userId={user.id}
                  displayName={user.displayName}
                  avatarUrl={user.avatarUrl}
                  size="sm"
                  showStatus
                />
                <span className="text-white/80 text-xs font-medium truncate flex-1 text-left">
                  {user.displayName}
                </span>
                <svg className="w-3 h-3 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="absolute bottom-10 left-0 right-0 bg-surface border border-white/15 rounded-xl shadow-2xl py-1 z-50">
                  <button
                    onClick={() => { setShowUserMenu(false); onOpenProfile(); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors"
                  >
                    프로필 편집
                  </button>
                  <div className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wide border-t border-white/5 mt-1">상태 변경</div>
                  {Object.entries(STATUS_LABELS).map(([s, label]) => (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s]}`} />
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-white/5 mt-1">
                    <button
                      onClick={() => { setShowUserMenu(false); onOpenSettings(); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors"
                    >
                      설정
                    </button>
                    <button
                      onClick={() => void handleLogout()}
                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
            title={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {resolved === 'dark' ? (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                라이트 모드
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                다크 모드
              </>
            )}
          </button>
        </div>
      </div>

      {/* Drag resize handle */}
      <div
        className="w-1 hover:bg-accent/30 cursor-col-resize transition-colors flex-shrink-0"
        onMouseDown={handleDragStart}
      />
    </div>
  );
}
