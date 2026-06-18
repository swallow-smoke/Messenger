import React, { useRef, useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useChannelsStore } from '../../store/channels';
import { useChannelOrderStore } from '../../store/channelOrder';
import { useAuthStore } from '../../store/auth';
import { usePresenceStore } from '../../store/presence';
import { useDMStore } from '../../store/dm';
import { useFriendsStore } from '../../store/friends';
import { useSettingsStore, resolveTheme } from '../../store/settings';
import { useFocusModeStore, FOCUS_STATUS, FOCUS_STATUS_TEXT } from '../../store/focusMode';
import { setUserStatus } from '../../lib/status';
import { UserAvatar } from '../user/UserAvatar';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import type { Channel } from '../../store/channels';

type Tab = 'channels' | 'dm' | 'friends' | 'docs' | 'tasks' | 'mentions';

const TAB_LABELS: Record<Tab, string> = {
  channels: '채널',
  dm: 'DM',
  friends: '친구',
  docs: '문서',
  tasks: '태스크',
  mentions: '멘션',
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

function SortableChannelItem({
  ch,
  activeChannelId,
  unread,
  isFav,
  onSelect,
  onToggleFav,
}: {
  ch: Channel;
  activeChannelId: string | null;
  unread: number;
  isFav: boolean;
  onSelect(): void;
  onToggleFav(): void;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ch.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center mx-1 rounded"
    >
      <button
        {...attributes}
        {...listeners}
        className="px-1 py-1.5 text-white/20 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0"
        tabIndex={-1}
      >
        ⠿
      </button>
      <button
        onClick={onSelect}
        className={`flex-1 text-left py-1.5 text-sm flex items-center justify-between transition-colors rounded ${
          activeChannelId === ch.id
            ? 'bg-accent/20 text-white'
            : unread > 0
            ? 'text-white font-medium hover:bg-white/10'
            : 'text-white/70 hover:bg-white/10'
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0 pl-1">
          <span className="text-white/40">#</span>
          <span className="truncate">{ch.name}</span>
        </span>
        {unread > 0 && (
          <span className="bg-accent text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0 font-semibold mr-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <button
        onClick={onToggleFav}
        className={`px-1 py-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs ${
          isFav ? 'text-yellow-400 opacity-100' : 'text-white/30 hover:text-yellow-400'
        }`}
        title={isFav ? '즐겨찾기 해제' : '즐겨찾기'}
      >
        ★
      </button>
    </div>
  );
}

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
  workspaceId,
  activeTab,
  onTabChange,
  width,
  onWidthChange,
  onCreateChannel,
  onOpenProfile,
  onOpenSettings,
  onSelectDM,
}: Props): React.ReactElement {
  const { channels, categories, activeChannelId, setActive, unreadCounts, createCategory, deleteCategory } = useChannelsStore();
  const { favorites, toggleFavorite, isFavorite, setOrder, getOrder } = useChannelOrderStore();
  const { user, updateStatus, logout } = useAuthStore();
  const presences = usePresenceStore((s) => s.presences);
  const { conversations, activeConversationId, setActiveConversation } = useDMStore();
  const { pendingCount: friendPendingCount } = useFriendsStore();
  const { settings, update } = useSettingsStore();
  const onlineCount = Object.values(presences).filter((p) => p.status === 'online').length;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const focusActive = useFocusModeStore((s) => s.active);
  const focusEndsAt = useFocusModeStore((s) => s.endsAt);
  const beginFocus = useFocusModeStore((s) => s.begin);
  const clearFocus = useFocusModeStore((s) => s.clear);
  const [focusDuration, setFocusDuration] = useState(25);
  const [focusCustomMin, setFocusCustomMin] = useState('');
  const [, setNowTick] = useState(0);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const favIds = favorites[workspaceId] ?? [];
  const orderedChannels = getOrder(workspaceId, channels.map((c) => c.id));
  const sortedChannels = orderedChannels.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as Channel[];
  const favoriteChannels = sortedChannels.filter((c) => favIds.includes(c.id));
  const nonFavChannels = sortedChannels.filter((c) => !favIds.includes(c.id));

  function toggleCategory(id: string): void {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreateCategory(): Promise<void> {
    const name = newCategoryName.trim();
    if (!name || !workspaceId) return;
    await createCategory(workspaceId, name);
    setNewCategoryName('');
    setShowNewCategory(false);
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sortedChannels.map((c) => c.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(ids, oldIdx, newIdx);
    void setOrder(workspaceId, reordered);
  }

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

  const STATUS_PRESETS = [
    { status: 'online' as const, text: '회의 중', emoji: '📅' },
    { status: 'dnd' as const, text: '디버깅 중', emoji: '🐛' },
    { status: 'dnd' as const, text: '방해 금지', emoji: '🚫' },
    { status: 'away' as const, text: '잠시 자리 비움', emoji: '☕' },
  ];

  function changeStatus(status: string, statusText?: string): void {
    updateStatus(status, statusText);
    getSocket().emit('status:set', { status, statusText });
    toast.success(statusText ? `${statusText}` : `상태: ${STATUS_LABELS[status] ?? status}`);
    setShowUserMenu(false);
  }

  // Re-render every second while focusing so the countdown updates.
  React.useEffect(() => {
    if (!focusActive) return;
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [focusActive]);

  function startFocus(minutes: number): void {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    beginFocus({
      endsAt: Date.now() + minutes * 60_000,
      durationMin: minutes,
      prevStatus: user?.status ?? 'online',
      prevStatusText: user?.statusText ?? null,
    });
    setUserStatus(FOCUS_STATUS, FOCUS_STATUS_TEXT);
    toast.success(`집중 모드 시작 — ${minutes}분`);
    setShowUserMenu(false);
  }

  function stopFocus(): void {
    const { prevStatus, prevStatusText } = useFocusModeStore.getState();
    setUserStatus(prevStatus ?? 'online', prevStatusText ?? undefined);
    clearFocus();
    toast('집중 모드 종료');
  }

  function focusRemaining(): string {
    if (!focusEndsAt) return '';
    const ms = Math.max(0, focusEndsAt - Date.now());
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
          {(['channels', 'dm', 'friends', 'docs', 'tasks', 'mentions'] as Tab[]).map((tab) => (
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
              {/* Header */}
              <div className="px-3 mb-1 flex items-center justify-between">
                <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">채널</span>
                <div className="flex items-center gap-1.5">
                  {onlineCount > 0 && (
                    <span className="text-white/30 text-xs">{onlineCount}명 온라인</span>
                  )}
                  <button
                    onClick={() => setShowNewCategory((v) => !v)}
                    className="text-white/30 hover:text-white text-xs px-1"
                    title="카테고리 추가"
                  >
                    ⊞
                  </button>
                  <button
                    onClick={onCreateChannel}
                    className="text-white/30 hover:text-white text-base leading-none w-4 h-4 flex items-center justify-center"
                    title="채널 만들기"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* New category input */}
              {showNewCategory && (
                <div className="px-2 mb-1 flex gap-1">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreateCategory();
                      if (e.key === 'Escape') setShowNewCategory(false);
                    }}
                    placeholder="카테고리 이름..."
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-accent/50"
                  />
                  <button
                    onClick={() => void handleCreateCategory()}
                    className="px-2 py-1 bg-accent/80 hover:bg-accent text-white text-xs rounded"
                  >
                    추가
                  </button>
                </div>
              )}

              {/* DnD context wraps all sortable channel items */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortedChannels.map((c) => c.id)} strategy={verticalListSortingStrategy}>

                  {/* Favorites section */}
                  {favoriteChannels.length > 0 && (
                    <div className="mb-1">
                      <button
                        onClick={() => setFavoritesCollapsed((v) => !v)}
                        className="w-full px-3 py-0.5 flex items-center gap-1 text-[10px] text-yellow-400/70 hover:text-yellow-400 uppercase tracking-wider font-semibold transition-colors"
                      >
                        <span className={`transition-transform ${favoritesCollapsed ? '-rotate-90' : ''}`}>▾</span>
                        즐겨찾기
                      </button>
                      {!favoritesCollapsed && favoriteChannels.map((ch) => (
                        <SortableChannelItem
                          key={ch.id}
                          ch={ch}
                          activeChannelId={activeChannelId}
                          unread={unreadCounts[ch.id] ?? 0}
                          isFav={true}
                          onSelect={() => { setActive(ch.id); onTabChange('channels'); }}
                          onToggleFav={() => void toggleFavorite(workspaceId, ch.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Categories */}
                  {categories.map((cat) => {
                    const catChannels = nonFavChannels.filter((c) => c.categoryId === cat.id);
                    const collapsed = collapsedCategories.has(cat.id);
                    return (
                      <div key={cat.id} className="mb-1">
                        <div className="flex items-center group/cat px-1">
                          <button
                            onClick={() => toggleCategory(cat.id)}
                            className="flex-1 flex items-center gap-1 px-2 py-0.5 text-[10px] text-white/40 hover:text-white/70 uppercase tracking-wider font-semibold transition-colors"
                          >
                            <span className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}>▾</span>
                            {cat.name}
                          </button>
                          <button
                            onClick={() => void deleteCategory(cat.id)}
                            className="opacity-0 group-hover/cat:opacity-100 px-1 text-white/20 hover:text-red-400 text-xs transition-all"
                            title="카테고리 삭제"
                          >
                            ×
                          </button>
                        </div>
                        {!collapsed && catChannels.map((ch) => (
                          <SortableChannelItem
                            key={ch.id}
                            ch={ch}
                            activeChannelId={activeChannelId}
                            unread={unreadCounts[ch.id] ?? 0}
                            isFav={isFavorite(workspaceId, ch.id)}
                            onSelect={() => { setActive(ch.id); onTabChange('channels'); }}
                            onToggleFav={() => void toggleFavorite(workspaceId, ch.id)}
                          />
                        ))}
                        {!collapsed && catChannels.length === 0 && (
                          <div className="px-6 py-0.5 text-[10px] text-white/20">채널 없음</div>
                        )}
                      </div>
                    );
                  })}

                  {/* Uncategorized channels */}
                  {nonFavChannels.filter((c) => !c.categoryId).length > 0 && (
                    <div className="mb-1">
                      {categories.length > 0 && (
                        <div className="px-3 py-0.5 text-[10px] text-white/25 uppercase tracking-wider font-semibold">기타</div>
                      )}
                      {nonFavChannels.filter((c) => !c.categoryId).map((ch) => (
                        <SortableChannelItem
                          key={ch.id}
                          ch={ch}
                          activeChannelId={activeChannelId}
                          unread={unreadCounts[ch.id] ?? 0}
                          isFav={isFavorite(workspaceId, ch.id)}
                          onSelect={() => { setActive(ch.id); onTabChange('channels'); }}
                          onToggleFav={() => void toggleFavorite(workspaceId, ch.id)}
                        />
                      ))}
                    </div>
                  )}

                </SortableContext>
              </DndContext>

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
                  <div className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wide border-t border-white/5 mt-1">상태 메시지</div>
                  <div className="px-3 pb-2 flex flex-wrap gap-1">
                    {STATUS_PRESETS.map((p) => (
                      <button
                        key={`${p.status}-${p.text}`}
                        onClick={() => changeStatus(p.status, p.text)}
                        className="px-2 py-0.5 text-[10px] bg-white/5 hover:bg-white/15 rounded-full text-white/60 hover:text-white transition-colors"
                      >
                        {p.emoji} {p.text}
                      </button>
                    ))}
                  </div>
                  <div className="px-3 pb-2">
                    <input
                      type="text"
                      placeholder="직접 입력..."
                      maxLength={60}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-accent/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const t = (e.target as HTMLInputElement).value.trim();
                          if (t) changeStatus(user?.status ?? 'online', t);
                        }
                      }}
                    />
                  </div>
                  {/* Focus mode */}
                  <div className="px-3 py-1.5 text-[10px] text-white/30 uppercase tracking-wide border-t border-white/5 mt-1">집중 모드</div>
                  {focusActive ? (
                    <div className="px-3 pb-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-white/80">🎯 집중 중</span>
                        <span className="text-xs font-mono text-accent tabular-nums">{focusRemaining()}</span>
                      </div>
                      <button
                        onClick={stopFocus}
                        className="w-full py-1 text-xs bg-white/5 hover:bg-white/15 rounded text-white/70 hover:text-white transition-colors"
                      >
                        집중 모드 종료
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 pb-2">
                      <div className="flex gap-1 mb-1.5">
                        {[25, 45, 90].map((m) => (
                          <button
                            key={m}
                            onClick={() => setFocusDuration(m)}
                            className={`flex-1 py-0.5 text-[10px] rounded transition-colors ${
                              focusDuration === m && !focusCustomMin
                                ? 'bg-accent text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            {m}분
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={600}
                          value={focusCustomMin}
                          onChange={(e) => setFocusCustomMin(e.target.value)}
                          placeholder="직접"
                          className="w-12 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white placeholder-white/30 outline-none focus:border-accent/50"
                        />
                      </div>
                      <button
                        onClick={() => startFocus(focusCustomMin ? parseInt(focusCustomMin, 10) : focusDuration)}
                        className="w-full py-1 text-xs bg-accent/80 hover:bg-accent rounded text-white transition-colors"
                      >
                        집중 모드 시작
                      </button>
                    </div>
                  )}

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
