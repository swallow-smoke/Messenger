import React, { useEffect, useCallback, useRef, useState } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import { useMessagesStore } from '../../store/messages';
import { useAuthStore } from '../../store/auth';
import { useChannelsStore } from '../../store/channels';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { PinnedBanner } from './PinnedBanner';
import type { Message } from '../../store/messages';

interface Props {
  channelId: string;
  onOpenThread(msg: Message): void;
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
  const { messages, fetchMessages, pinnedMessages, setPinned, loaded } = useMessagesStore();
  const { user } = useAuthStore();
  const { channels } = useChannelsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const prevMsgCount = useRef(0);

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
    fetchMessages(channelId)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [channelId, fetchMessages, loaded]);

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

  return (
    <div className="flex flex-col h-full">
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
      </div>

      {/* Pinned banner */}
      {pinned && (
        <PinnedBanner message={pinned} onDismiss={() => setPinned(channelId, null)} />
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
            data={msgs}
            startReached={loadOlder}
            followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
            atBottomStateChange={setAtBottom}
            itemContent={(_, msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                onReply={onOpenThread}
                isGrouped={groupedSet.has(msg.id)}
              />
            )}
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

      {/* Typing indicator */}
      {user && (
        <TypingIndicator contextId={channelId} currentUserId={user.id} />
      )}

      {/* Input */}
      <MessageInput contextType="channel" contextId={channelId} />
    </div>
  );
}
