import React from 'react';
import { usePresenceStore } from '../../store/presence';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

interface Props {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

const SIZE = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

const DOT_SIZE = {
  xs: 'w-1.5 h-1.5 -bottom-0.5 -right-0.5',
  sm: 'w-2 h-2 -bottom-0.5 -right-0.5',
  md: 'w-2.5 h-2.5 bottom-0 right-0',
  lg: 'w-3 h-3 bottom-0 right-0',
};

export function UserAvatar({ userId, displayName, avatarUrl, size = 'md', showStatus = false }: Props): React.ReactElement {
  const status = usePresenceStore((s) => s.getStatus(userId));
  const initial = (displayName?.[0] ?? '?').toUpperCase();

  return (
    <div className={`relative flex-shrink-0 ${SIZE[size]} rounded-full overflow-visible`}>
      <div className={`${SIZE[size]} rounded-full overflow-hidden bg-accent/40 flex items-center justify-center font-semibold text-white`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {showStatus && (
        <span
          className={`absolute ${DOT_SIZE[size]} ${STATUS_COLORS[status] ?? STATUS_COLORS.offline} rounded-full border-2 border-surface`}
          title={status}
        />
      )}
    </div>
  );
}
