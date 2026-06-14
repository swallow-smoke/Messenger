import React, { useEffect } from 'react';
import { useMessagesStore } from '../../store/messages';
import type { Message } from '../../store/messages';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';

interface Props {
  parentId: string;
  contextId: string;
  onClose(): void;
  parentMessage?: Message;
}

export function ThreadPanel({ parentId, contextId, onClose, parentMessage }: Props): React.ReactElement {
  const { threads, fetchThread } = useMessagesStore();
  const replies = threads[parentId] ?? [];

  useEffect(() => {
    void fetchThread(parentId);
  }, [parentId, fetchThread]);

  return (
    <div className="w-80 flex flex-col border-l border-white/10 bg-surface h-full flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <span className="font-semibold">스레드</span>
        <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {parentMessage && (
          <>
            <MessageItem message={parentMessage} onReply={() => {}} />
            <div className="flex items-center gap-2 px-4 py-2">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/40 flex-shrink-0">
                {replies.length > 0 ? `답글 ${replies.length}개` : '답글'}
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          </>
        )}
        {replies.map((msg) => (
          <MessageItem key={msg.id} message={msg} onReply={() => {}} />
        ))}
      </div>
      <MessageInput contextType="channel" contextId={contextId} parentId={parentId} placeholder="답글 달기..." />
    </div>
  );
}
