import React from 'react';
import { usePresenceStore } from '../../store/presence';

interface Props {
  contextId: string;
  currentUserId: string;
}

export function TypingIndicator({ contextId, currentUserId }: Props): React.ReactElement | null {
  const typingUsers = usePresenceStore((s) => s.typingUsers[contextId] ?? []);
  const typingMeta = usePresenceStore((s) => s.typingMeta);
  const others = typingUsers.filter((id) => id !== currentUserId);

  if (!others.length) return null;

  let label: string;
  if (others.length === 1) {
    const meta = typingMeta[others[0]];
    // Use the user's custom typing text if set; otherwise fall back to the default.
    label = meta?.customTypingText?.trim()
      ? meta.customTypingText
      : `${meta?.displayName ?? '누군가'} 님이 입력 중...`;
  } else {
    label = `${others.length}명이 입력 중...`;
  }

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
