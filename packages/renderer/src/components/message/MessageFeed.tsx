import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import { useMessagesStore } from '../../store/messages';
import { useAuthStore } from '../../store/auth';
import { useChannelsStore } from '../../store/channels';
import { useChannelSoundsStore } from '../../store/channelSounds';
import { SOUND_OPTIONS, playSound } from '../../lib/sounds';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { PinnedBanner } from './PinnedBanner';
import { PinnedMessagesPanel } from './PinnedMessagesPanel';
import { AttachmentGallery } from './AttachmentGallery';
import type { Message } from '../../store/messages';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';

type ListItem = Message | { _isDivider: true };

interface Props {
  channelId: string;
  onOpenThread(msg: Message): void;
}

import type { Channel } from '../../store/channels';

function ForwardModal({
  channels,
  currentChannelId,
  onForward,
  onClose,
}: {
  channels: Channel[];
  currentChannelId: string;
  onForward(channelId: string): void;
  onClose(): void;
}): React.ReactElement {
  const targets = channels.filter((c) => c.id !== currentChannelId && !c.isArchived);
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-sm max-h-[60vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
          <span className="font-semibold text-sm">메시지 전달</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {targets.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-6">전달할 채널이 없습니다.</p>
          ) : targets.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onForward(ch.id)}
              className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
            >
              <span className="text-white/40">#</span>
              {ch.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonMessage(): React.ReactElement {
  return (
    <div className="flex gap-3 px-4 py-1.5 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex gap-2">
          <div className="h-3 w-24 bg-white/10 rounded" />
          <div className="h-3 w-16 bg-white/5 rounded" />
        </div>
        <div className="h-3 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  );
}

function MessageSearchBar({
  value,
  onChange,
  onClose,
  matchCount,
}: {
  value: string;
  onChange(v: string): void;
  onClose(): void;
  matchCount: number;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-white/10 text-sm">
      <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="채널 내 검색..."
        className="flex-1 bg-transparent outline-none text-white placeholder-white/40"
      />
      {value && (
        <span className="text-white/40 text-xs">{matchCount}개 결과</span>
      )}
      <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
    </div>
  );
}

export function MessageFeed({ channelId, onOpenThread }: Props): React.ReactElement {
  const { messages, fetchMessages, pinnedMessages, setPinned, loaded, clearLoaded, deleteMessage } = useMessagesStore();
  const { user } = useAuthStore();
  const { channels, updateChannelRules } = useChannelsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [showPinsPanel, setShowPinsPanel] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [jumpActive, setJumpActive] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [rulesDismissed, setRulesDismissed] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [rulesInput, setRulesInput] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [unreadCutoff, setUnreadCutoff] = useState<string | null>(null);

  const { sounds, setSound } = useChannelSoundsStore();
  const currentSound = sounds[channelId] ?? 'default';

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const prevMsgCount = useRef(0);
  const channelsRef = useRef(channels);
  const seenChannelsRef = useRef<Set<string>>(new Set());
  useEffect(() => { channelsRef.current = channels; }, [channels]);

  const channel = channels.find((c) => c.id === channelId);
  const pinned = pinnedMessages[channelId] ?? null;

  // Filter empty non-deleted messages
  let msgs = (messages[channelId] ?? []).filter(
    (m) => m.isDeleted || m.content.trim().length > 0 || (m.attachments?.length ?? 0) > 0
  );

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    msgs = msgs.filter((m) => m.content.toLowerCase().includes(q));
  }

  // Filter by build tag
  if (tagFilter) {
    msgs = msgs.filter((m) => (m.metadata as Record<string, unknown>).buildTag === tagFilter);
  }

  // Collect available build tags from all (unfiltered) messages
  const allMsgs = (messages[channelId] ?? []).filter(
    (m) => m.isDeleted || m.content.trim().length > 0 || (m.attachments?.length ?? 0) > 0
  );
  const availableTags = useMemo(
    () => [...new Set(allMsgs.flatMap((m) => {
      const tag = (m.metadata as Record<string, unknown>).buildTag as string | undefined;
      return tag ? [tag] : [];
    }))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, channelId]
  );

  // Build list items with optional unread divider
  const listItems = useMemo<ListItem[]>(() => {
    if (!unreadCutoff) return msgs as ListItem[];
    const cutoff = new Date(unreadCutoff).getTime();
    const dividerIdx = msgs.findIndex((m) => new Date(m.createdAt).getTime() > cutoff);
    if (dividerIdx <= 0) return msgs as ListItem[];
    const result: ListItem[] = [...msgs] as ListItem[];
    result.splice(dividerIdx, 0, { _isDivider: true });
    return result;
  }, [msgs, unreadCutoff]);

  // Consecutive same-sender messages within 5 minutes → grouped (no avatar/header)
  const groupedSet = new Set<string>();
  for (let i = 1; i < msgs.length; i++) {
    const prev = msgs[i - 1];
    const curr = msgs[i];
    if (
      !prev.isDeleted &&
      !curr.isDeleted &&
      prev.senderId === curr.senderId &&
      new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
    ) {
      groupedSet.add(curr.id);
    }
  }

  useEffect(() => {
    const alreadyCached = loaded[channelId];
    if (!alreadyCached) setIsLoading(true);
    prevMsgCount.current = 0;
    setNewMessageCount(0);
    setRulesDismissed(false);
    setEditingRules(false);
    fetchMessages(channelId)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [channelId, fetchMessages, loaded]);

  // Capture lastReadAt on channel switch (before new messages mark it as read)
  useEffect(() => {
    if (seenChannelsRef.current.has(channelId)) {
      setUnreadCutoff(null);
      return;
    }
    const ch = channelsRef.current.find((c) => c.id === channelId);
    setUnreadCutoff(ch?.lastReadAt ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Mark read + remove divider when user reaches bottom
  useEffect(() => {
    if (atBottom && unreadCutoff) {
      setUnreadCutoff(null);
      seenChannelsRef.current.add(channelId);
    }
  }, [atBottom, unreadCutoff, channelId]);

  // Track new messages arriving while scrolled up
  useEffect(() => {
    const current = (messages[channelId] ?? []).length;
    if (current > prevMsgCount.current && prevMsgCount.current > 0 && !atBottom) {
      setNewMessageCount((n) => n + (current - prevMsgCount.current));
    }
    prevMsgCount.current = current;
  }, [messages, channelId, atBottom]);

  const loadOlder = useCallback(() => {
    const allMsgs = messages[channelId] ?? [];
    if (!allMsgs.length) return;
    void fetchMessages(channelId, allMsgs[0].createdAt);
  }, [channelId, messages, fetchMessages]);

  function scrollToBottom() {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
    setNewMessageCount(0);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  function handleJumpToDate(dateStr: string): void {
    setShowDatePicker(false);
    if (!dateStr) return;
    const after = new Date(dateStr).toISOString();
    clearLoaded(channelId);
    setIsLoading(true);
    setJumpActive(true);
    fetchMessages(channelId, undefined, after)
      .then(() => virtuosoRef.current?.scrollToIndex({ index: 0 }))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }

  function handleBackToLatest(): void {
    setJumpActive(false);
    clearLoaded(channelId);
    setIsLoading(true);
    fetchMessages(channelId)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }

  function handleGoToPin(messageId: string) {
    setShowPinsPanel(false);
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      virtuosoRef.current?.scrollToIndex({ index: idx, behavior: 'smooth' });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => api.delete(`/messages/${id}`)));
      ids.forEach((id) => deleteMessage(id, channelId));
      toast.success(`${ids.length}개 메시지 삭제됨`);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  }

  function forwardToChannel(targetChannelId: string) {
    const socket = getSocket();
    const selected = msgs.filter((m) => selectedIds.has(m.id));
    for (const msg of selected) {
      socket.emit('message:send', {
        contextType: 'channel',
        contextId: targetChannelId,
        content: `> **${msg.sender.displayName}** (전달)\n${msg.content}`,
      });
    }
    setShowForwardModal(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    toast.success(`${selected.length}개 메시지 전달됨`);
  }

  return (
    <div className="flex h-full overflow-hidden">
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <span className="text-white/40 text-lg">#</span>
        <span className="font-semibold">{channel?.name ?? channelId}</span>
        {channel?.description && (
          <>
            <span className="text-white/20">|</span>
            <span className="text-white/50 text-sm truncate">{channel.description}</span>
          </>
        )}
        <div className="ml-auto flex-shrink-0 flex items-center gap-1">
          {jumpActive && (
            <button
              onClick={handleBackToLatest}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-accent hover:bg-accent/10 transition-colors"
              title="최신으로 돌아가기"
            >
              ↓ 최신
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                showDatePicker || jumpActive ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
              title="날짜로 이동"
            >
              📅
            </button>
            {showDatePicker && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-white/20 rounded-lg shadow-xl p-2">
                <input
                  type="date"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-accent/50"
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => handleJumpToDate(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowSoundPicker((v) => !v); setShowDatePicker(false); }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                showSoundPicker ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
              title="알림 소리 설정"
            >
              🔔
            </button>
            {showSoundPicker && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-white/20 rounded-lg shadow-xl py-1 min-w-[120px]">
                {SOUND_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      void setSound(channelId, opt.id);
                      if (opt.id !== 'none') playSound(opt.id);
                      setShowSoundPicker(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors flex items-center justify-between gap-2 ${
                      currentSound === opt.id ? 'text-accent' : 'text-white/70'
                    }`}
                  >
                    {opt.label}
                    {currentSound === opt.id && <span className="text-accent">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => { setRulesInput(channel?.rules ?? ''); setEditingRules(true); setRulesDismissed(false); }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              editingRules ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            title="채널 규칙 편집"
          >
            📋
          </button>
          <button
            onClick={() => setShowGallery((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              showGallery ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            title="첨부 파일 갤러리"
          >
            🖼️
          </button>
          <button
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelectedIds(new Set());
                return !v;
              });
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              selectMode ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            title="메시지 선택"
          >
            ☑
          </button>
          <button
            onClick={() => setShowPinsPanel((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              showPinsPanel ? 'bg-accent/20 text-accent' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
            title="고정된 메시지"
          >
            📌
          </button>
        </div>
      </div>

      {/* Pinned banner */}
      {pinned && (
        <PinnedBanner message={pinned} onDismiss={() => setPinned(channelId, null)} />
      )}

      {/* Channel rules banner */}
      {channel?.rules && !rulesDismissed && !editingRules && (
        <div className="flex items-start gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex-shrink-0 text-xs text-yellow-200/80">
          <span className="text-yellow-400 flex-shrink-0 mt-0.5">📋</span>
          <span className="flex-1 whitespace-pre-wrap">{channel.rules}</span>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => { setRulesInput(channel.rules ?? ''); setEditingRules(true); }}
              className="text-yellow-400/60 hover:text-yellow-400 px-1"
              title="수정"
            >
              ✏️
            </button>
            <button onClick={() => setRulesDismissed(true)} className="text-yellow-400/60 hover:text-yellow-400 px-1">×</button>
          </div>
        </div>
      )}
      {editingRules && (
        <div className="flex items-start gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex-shrink-0">
          <textarea
            autoFocus
            value={rulesInput}
            onChange={(e) => setRulesInput(e.target.value)}
            rows={3}
            className="flex-1 bg-white/5 border border-yellow-500/30 rounded px-2 py-1 text-xs text-white/90 outline-none resize-none focus:border-yellow-500/60"
            placeholder="채널 규칙 및 설명..."
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                void updateChannelRules(channelId, rulesInput.trim() || null);
                setEditingRules(false);
              }}
              className="px-2 py-1 bg-yellow-500/80 hover:bg-yellow-500 text-black text-xs rounded font-medium"
            >
              저장
            </button>
            <button onClick={() => setEditingRules(false)} className="px-2 py-1 text-white/40 hover:text-white text-xs">취소</button>
          </div>
        </div>
      )}
      {/* Search bar */}
      {searchOpen && (
        <MessageSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
          matchCount={searchQuery ? msgs.length : 0}
        />
      )}

      {/* Build tag filter bar */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-surface border-b border-white/10 flex-shrink-0 overflow-x-auto">
          <span className="text-[10px] text-white/40 flex-shrink-0">태그:</span>
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white/60 hover:bg-white/15 flex-shrink-0"
            >
              ✕ 전체
            </button>
          )}
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors flex-shrink-0 ${
                tagFilter === tag
                  ? 'bg-accent/30 text-accent border border-accent/40'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
            >
              🏷️ {tag}
            </button>
          ))}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonMessage key={i} />)}
          </div>
        ) : msgs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-white/40">
            <span className="text-4xl">👋</span>
            <p className="text-sm">
              {searchQuery
                ? '검색 결과가 없습니다.'
                : `#${channel?.name ?? channelId} 채널의 시작입니다.\n아직 메시지가 없어요!`}
            </p>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%' }}
            data={listItems}
            startReached={loadOlder}
            followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
            atBottomStateChange={setAtBottom}
            itemContent={(_, item) => {
              if ('_isDivider' in item) {
                return (
                  <div className="flex items-center gap-3 px-4 py-2 select-none">
                    <div className="flex-1 h-px bg-red-400/40" />
                    <span className="text-[10px] text-red-400/80 font-medium whitespace-nowrap">읽지 않은 메시지</span>
                    <div className="flex-1 h-px bg-red-400/40" />
                  </div>
                );
              }
              return (
                <MessageItem
                  key={item.id}
                  message={item}
                  onReply={onOpenThread}
                  isGrouped={groupedSet.has(item.id)}
                  selectMode={selectMode}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={toggleSelect}
                />
              );
            }}
          />
        )}

        {/* Jump to latest button */}
        {!atBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-accent text-white text-xs rounded-full shadow-lg hover:bg-accent/80 transition-colors z-10"
          >
            <span>↓</span>
            {newMessageCount > 0 && <span>새 메시지 {newMessageCount}개</span>}
          </button>
        )}
      </div>

      {/* Multi-select action bar */}
      {selectMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-surface border-t border-white/10 flex-shrink-0 text-sm">
          <span className="text-white/60 text-xs">{selectedIds.size}개 선택됨</span>
          <button
            onClick={() => setSelectedIds(new Set(msgs.map((m) => m.id)))}
            className="px-2 py-1 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded"
          >
            전체 선택
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowForwardModal(true)}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white/80 rounded disabled:opacity-40"
            >
              전달
            </button>
            <button
              onClick={() => void handleBulkDelete()}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded disabled:opacity-40"
            >
              삭제 ({selectedIds.size})
            </button>
            <button
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {user && (
        <TypingIndicator contextId={channelId} currentUserId={user.id} />
      )}

      {/* Input */}
      <MessageInput contextType="channel" contextId={channelId} />

      {/* Forward channel picker */}
      {showForwardModal && (
        <ForwardModal
          channels={channels}
          currentChannelId={channelId}
          onForward={forwardToChannel}
          onClose={() => setShowForwardModal(false)}
        />
      )}
    </div>
    {showPinsPanel && (
      <PinnedMessagesPanel
        channelId={channelId}
        onClose={() => setShowPinsPanel(false)}
        onGoTo={handleGoToPin}
      />
    )}
    {showGallery && (
      <AttachmentGallery
        channelId={channelId}
        onClose={() => setShowGallery(false)}
      />
    )}
    </div>
  );
}
