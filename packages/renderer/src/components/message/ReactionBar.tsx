import React, { useState, useRef } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import type { Reaction } from '../../store/messages';
import api from '../../lib/api';

interface EmojiData {
  native: string;
}

interface Props {
  messageId: string;
  reactions: Reaction[];
  currentUserId: string;
  showAddButton?: boolean;
}

export function ReactionBar({ messageId, reactions, currentUserId, showAddButton = false }: Props): React.ReactElement | null {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const grouped = reactions.reduce<Record<string, Reaction[]>>((acc, r) => {
    acc[r.emoji] = acc[r.emoji] ?? [];
    acc[r.emoji].push(r);
    return acc;
  }, {});

  async function toggle(emoji: string): Promise<void> {
    try {
      const hasReacted = grouped[emoji]?.some((r) => r.userId === currentUserId);
      if (hasReacted) {
        await api.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      } else {
        await api.post(`/messages/${messageId}/reactions`, { emoji });
      }
    } catch {
      // toast shown by api interceptor
    }
  }

  async function addEmoji(emojiData: EmojiData): Promise<void> {
    setShowPicker(false);
    try {
      await api.post(`/messages/${messageId}/reactions`, { emoji: emojiData.native });
    } catch {
      // toast shown by api interceptor
    }
  }

  if (!reactions.length && !showAddButton) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {Object.entries(grouped).map(([emoji, rs]) => {
        const hasReacted = rs.some((r) => r.userId === currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => void toggle(emoji)}
            title={rs.map((r) => r.user.displayName).join(', ')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors
              ${hasReacted ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-white/5 text-white/70 hover:border-accent/50'}`}
          >
            <span>{emoji}</span>
            <span>{rs.length}</span>
          </button>
        );
      })}

      {showAddButton && (
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center justify-center w-6 h-6 rounded-full border border-white/20 text-white/40 hover:border-accent/50 hover:text-white text-xs transition-colors"
            title="리액션 추가"
          >
            +
          </button>
          {showPicker && (
            <div className="absolute bottom-8 left-0 z-50" onClick={(e) => e.stopPropagation()}>
              <Picker
                data={data}
                onEmojiSelect={(e: EmojiData) => void addEmoji(e)}
                theme="dark"
                locale="ko"
                previewPosition="none"
                skinTonePosition="none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
