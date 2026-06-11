import React from 'react';
import { usePresenceStore } from '../../store/presence';

interface Props {
  contextId: string;
  currentUserId: string;
}

export function TypingIndicator({ contextId, currentUserId }: Props): React.ReactElement | null {
  const typingUsers = usePresenceStore((s) => s.typingUsers[contextId] ?? []);
  const others = typingUsers.filter((id) => id !== currentUserId);

  if (!others.length) return null;

  const label =
    others.length === 1
      ? `${others[0]} 님이 입력 중...`
      : `${others.length}명이 입력 중...`;

  return (
    <div className="px-4 pb-1 flex items-center gap-2 text-xs text-white/50">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 bg-white/40 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
