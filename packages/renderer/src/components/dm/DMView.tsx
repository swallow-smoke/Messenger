import React, { useEffect, useRef, useState } from 'react';
import { useDMStore } from '../../store/dm';
import { useAuthStore } from '../../store/auth';
import { getSocket } from '../../lib/socket';
import { LinkPreviewCard, type LinkPreviewData } from '../message/LinkPreviewCard';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface Props {
  conversationId: string;
}

export function DMView({ conversationId }: Props): React.ReactElement {
  const { messages, fetchMessages, conversations } = useDMStore();
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs = messages[conversationId] ?? [];
  const conv = conversations.find((c) => c.id === conversationId);
  const otherParticipants = conv?.members.filter((m) => m.user.id !== user?.id).map((m) => m.user) ?? [];
  const title = conv?.name ?? otherParticipants.map((p) => p.displayName).join(', ') ?? 'DM';

  useEffect(() => {
    void fetchMessages(conversationId);
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  async function sendMessage(): Promise<void> {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      getSocket().emit('message:send', { contextType: 'dm', contextId: conversationId, content });
    } catch {
      toast.error('메시지 전송 실패');
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-3 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
        <div className="flex -space-x-2">
          {otherParticipants.slice(0, 3).map((p) => (
            <div key={p.id} className="w-7 h-7 rounded-full bg-accent/70 flex items-center justify-center text-xs border-2 border-surface font-semibold">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full rounded-full object-cover" />
              ) : (
                p.displayName.charAt(0).toUpperCase()
              )}
            </div>
          ))}
        </div>
        <span className="font-semibold text-sm">{title}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2">
            <span className="text-4xl">💬</span>
            <p className="text-sm">대화를 시작하세요</p>
          </div>
        )}
        {msgs.map((msg) => {
          const isOwn = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isOwn && (
                <div className="w-7 h-7 rounded-full bg-white/20 flex-shrink-0 flex items-center justify-center text-xs font-semibold">
                  {msg.sender.avatarUrl ? (
                    <img src={msg.sender.avatarUrl} alt={msg.sender.displayName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    msg.sender.displayName.charAt(0).toUpperCase()
                  )}
                </div>
              )}
              <div className={`max-w-sm ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isOwn && (
                  <span className="text-xs text-white/40">{msg.sender.displayName}</span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm break-words ${
                    isOwn
                      ? 'bg-accent text-white rounded-tr-sm'
                      : 'bg-white/10 text-white/90 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                {(() => {
                  const p = msg.metadata?.linkPreview as LinkPreviewData | undefined;
                  return p ? <LinkPreviewCard preview={p} /> : null;
                })()}
                <span className="text-[10px] text-white/30">
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ko })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-end gap-2 bg-white/10 rounded-xl px-4 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={`${title}에게 메시지 보내기`}
            className="flex-1 bg-transparent text-sm resize-none outline-none placeholder-white/30 max-h-32 min-h-[20px]"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || sending}
            className="text-accent disabled:text-white/20 hover:text-accent/70 transition-colors pb-0.5"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
