export type SocialBadgeType = 'helpful' | 'great_review' | 'team_player' | 'creative' | 'mentor';

export interface SocialBadge {
  id: string;
  type: SocialBadgeType;
  message?: string | null;
  createdAt: string;
  fromUser: { id: string; displayName: string; avatarUrl?: string | null };
}

interface BadgeMeta {
  type: SocialBadgeType;
  label: string;
  emoji: string;
  /** tailwind classes for a colored chip */
  chip: string;
}

export const BADGE_META: Record<SocialBadgeType, BadgeMeta> = {
  helpful: {
    type: 'helpful',
    label: '도움이 됨',
    emoji: '🤝',
    chip: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  },
  great_review: {
    type: 'great_review',
    label: '훌륭한 리뷰',
    emoji: '🔍',
    chip: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
  },
  team_player: {
    type: 'team_player',
    label: '팀 플레이어',
    emoji: '🧩',
    chip: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
  },
  creative: {
    type: 'creative',
    label: '창의적',
    emoji: '🎨',
    chip: 'bg-pink-500/15 border-pink-500/40 text-pink-300',
  },
  mentor: {
    type: 'mentor',
    label: '멘토',
    emoji: '🧭',
    chip: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  },
};

export const BADGE_LIST: BadgeMeta[] = Object.values(BADGE_META);
