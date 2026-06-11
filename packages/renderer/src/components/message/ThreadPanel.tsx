import React, { useEffect } from 'react';
import { useMessagesStore } from '../../store/messages';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';

interface Props {
  parentId: string;
  contextId: string;
  onClose(): void;
}

export function ThreadPanel({ parentId, contextId, onClose }: Props): React.ReactElement {
  const { threads, fetchThread } = useMessagesStore();
  const replies = threads[parentId] ?? [];

  useEffect(() => {
    void fetchThread(parentId);
  }, [parentId, fetchThread]);

  return (
    <div className="w-80 flex flex-col border-l border-white/10 bg-surface h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-semibold">Thread</span>
        <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {replies.map((msg) => (
          <MessageItem key={msg.id} message={msg} onReply={() => {}} />
        ))}
      </div>
      <MessageInput contextType="channel" contextId={contextId} parentId={parentId} placeholder="Reply..." />
    </div>
  );
}
