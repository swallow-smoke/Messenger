import React from 'react';
import { BADGE_META, type SocialBadge } from './socialBadges';

interface Props {
  badges: SocialBadge[];
  size?: 'sm' | 'md';
}

// Renders received social badges as colored icon chips. The giver name and
// optional message are shown in a native tooltip on hover.
export function SocialBadgeRow({ badges, size = 'md' }: Props): React.ReactElement | null {
  if (!badges.length) return null;

  const dim = size === 'sm' ? 'w-6 h-6 text-sm' : 'w-7 h-7 text-base';

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const meta = BADGE_META[b.type];
        if (!meta) return null;
        const tooltip = `${meta.label} · ${b.fromUser.displayName}${b.message ? `\n"${b.message}"` : ''}`;
        return (
          <span
            key={b.id}
            title={tooltip}
            className={`inline-flex items-center justify-center rounded-full border cursor-default ${dim} ${meta.chip}`}
          >
            {meta.emoji}
          </span>
        );
      })}
    </div>
  );
}
