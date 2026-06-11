import React from 'react';
import type { Message } from '../../store/messages';

interface Props {
  message: Message;
  onDismiss(): void;
}

export function PinnedBanner({ message, onDismiss }: Props): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border-b border-accent/20 text-xs">
      <svg className="w-3.5 h-3.5 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a1 1 0 011 1v1.5l4 2V10a1 1 0 01-1 1H6a1 1 0 01-1-1V6.5l4-2V3a1 1 0 011-1z" />
      </svg>
      <span className="text-white/60">고정 메시지:</span>
      <span className="text-white/80 truncate flex-1">{message.content}</span>
      <button
        onClick={onDismiss}
        className="text-white/30 hover:text-white/70 flex-shrink-0 leading-none"
      >
        &times;
      </button>
    </div>
  );
}
