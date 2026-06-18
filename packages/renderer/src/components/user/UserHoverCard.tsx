import React, { useEffect, useState } from 'react';
import { usePresenceStore } from '../../store/presence';
import { useAuthStore } from '../../store/auth';
import { useFriendsStore } from '../../store/friends';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { MarkdownContent } from '../message/MarkdownContent';
import { ProviderIcon, PROVIDER_LABEL, type ConnectedAccount } from './connectedAccounts';
import { UserProfileModal } from './UserProfileModal';
import { SocialBadgeRow } from './SocialBadgeRow';
import { GiveBadgeModal } from './GiveBadgeModal';
import type { SocialBadge } from './socialBadges';

function openExternal(url: string): void {
  if (window.electron?.shell) void window.electron.shell.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

interface Props {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  workspaceId?: string;
  onClose(): void;
  onOpenDM?(userId: string): void;
  style?: React.CSSProperties;
}

const STATUS_LABEL: Record<string, string> = {
  online: '온라인',
  away: '자리 비움',
  dnd: '방해 금지',
  offline: '오프라인',
};

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-400',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export function UserHoverCard({ userId, displayName, avatarUrl, email, workspaceId, onClose, onOpenDM, style }: Props): React.ReactElement {
  const getStatus = usePresenceStore((s) => s.getStatus);
  const presences = usePresenceStore((s) => s.presences);
  const status = getStatus(userId);
  const statusText = presences[userId]?.statusText;
  const { user } = useAuthStore();
  const { getRelationship, sendRequest, removeFriend, acceptRequest } = useFriendsStore();
  const [loading, setLoading] = useState(false);
  const [readme, setReadme] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [badges, setBadges] = useState<SocialBadge[]>([]);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [showGiveBadge, setShowGiveBadge] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get(`/users/${userId}/profile`)
      .then(({ data }) => {
        if (!active) return;
        setReadme((data as { profileReadme?: string | null }).profileReadme ?? null);
        setAccounts((data as { connectedAccounts?: ConnectedAccount[] }).connectedAccounts ?? []);
        setBadges((data as { receivedBadges?: SocialBadge[] }).receivedBadges ?? []);
      })
      .catch(() => { /* handled by interceptor */ });
    return () => { active = false; };
  }, [userId]);

  const initials = displayName.charAt(0).toUpperCase();
  const isSelf = user?.id === userId;
  const rel = isSelf ? null : getRelationship(userId, user?.id ?? '');

  async function handleFriendAction(): Promise<void> {
    if (!rel) return;
    setLoading(true);
    try {
      if (rel.status === 'none') {
        await sendRequest(userId);
        toast.success('친구 요청을 보냈습니다');
      } else if (rel.status === 'accepted' && rel.id) {
        await removeFriend(rel.id);
        toast.success('친구가 삭제되었습니다');
      } else if (rel.status === 'pending_received' && rel.id) {
        await acceptRequest(rel.id);
        toast.success('친구 요청을 수락했습니다');
      }
    } finally {
      setLoading(false);
    }
  }

  function getFriendButton(): { label: string; disabled: boolean; variant: 'primary' | 'secondary' | 'ghost' } | null {
    if (!rel) return null;
    if (rel.status === 'none') return { label: '친구 추가', disabled: false, variant: 'primary' };
    if (rel.status === 'pending_sent') return { label: '친구 요청 보냄', disabled: true, variant: 'ghost' };
    if (rel.status === 'pending_received') return { label: '요청 수락', disabled: false, variant: 'primary' };
    if (rel.status === 'accepted') return { label: '친구 삭제', disabled: false, variant: 'secondary' };
    if (rel.status === 'blocked') return { label: '차단됨', disabled: true, variant: 'ghost' };
    return null;
  }

  const friendBtn = getFriendButton();

  return (
    <div
      className="absolute z-50 bg-surface border border-white/15 rounded-xl shadow-2xl p-4 w-64"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-2 right-2 text-white/30 hover:text-white text-sm">&times;</button>
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-bold">
              {initials}
            </div>
          )}
          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-surface ${STATUS_COLOR[status]}`} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{displayName}</div>
          {email && <div className="text-xs text-white/40 truncate">{email}</div>}
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[status]}`} />
            <span className="text-xs text-white/50">{STATUS_LABEL[status] ?? status}</span>
          </div>
          {statusText && <div className="text-xs text-white/60 mt-0.5 truncate">{statusText}</div>}
        </div>
      </div>

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => openExternal(acc.url)}
              title={`${PROVIDER_LABEL[acc.provider]} · ${acc.displayName}`}
              className="inline-flex items-center justify-center w-7 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-white/60 hover:text-white transition-colors"
            >
              <ProviderIcon provider={acc.provider} />
            </button>
          ))}
        </div>
      )}

      {/* Received social badges */}
      {badges.length > 0 && (
        <div className="mb-3">
          <SocialBadgeRow badges={badges} size="sm" />
        </div>
      )}

      {/* README preview (capped to ~3 lines) */}
      {readme?.trim() && (
        <div className="mb-3">
          <div className="relative max-h-[4.2rem] overflow-hidden text-white/70">
            <MarkdownContent content={readme} />
            <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
          </div>
          <button
            onClick={() => setShowFullProfile(true)}
            className="mt-1 text-xs text-accent hover:underline"
          >
            더 보기
          </button>
        </div>
      )}

      {showFullProfile && (
        <UserProfileModal userId={userId} onClose={() => setShowFullProfile(false)} />
      )}

      {!isSelf && (
        <div className="flex gap-2">
          {onOpenDM && rel?.status === 'accepted' && (
            <button
              onClick={() => { onOpenDM(userId); onClose(); }}
              className="flex-1 py-1.5 text-xs bg-accent hover:bg-accent/80 rounded-lg transition-colors"
            >
              DM 보내기
            </button>
          )}
          {friendBtn && (
            <button
              onClick={() => void handleFriendAction()}
              disabled={friendBtn.disabled || loading}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                friendBtn.variant === 'primary'
                  ? 'bg-accent hover:bg-accent/80'
                  : friendBtn.variant === 'secondary'
                  ? 'bg-white/10 hover:bg-white/20 text-white/80'
                  : 'bg-white/5 text-white/30 cursor-default'
              }`}
            >
              {loading ? '...' : friendBtn.label}
            </button>
          )}
          {onOpenDM && rel?.status !== 'accepted' && (
            <button
              onClick={() => { onOpenDM(userId); onClose(); }}
              className="flex-1 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              메시지 보내기
            </button>
          )}
        </div>
      )}

      {!isSelf && workspaceId && (
        <button
          onClick={() => setShowGiveBadge(true)}
          className="mt-2 w-full py-1.5 text-xs bg-white/5 hover:bg-white/15 rounded-lg text-white/70 hover:text-white transition-colors"
        >
          🏅 배지 주기
        </button>
      )}

      {showGiveBadge && workspaceId && (
        <GiveBadgeModal
          workspaceId={workspaceId}
          toUserId={userId}
          toDisplayName={displayName}
          onClose={() => setShowGiveBadge(false)}
        />
      )}
    </div>
  );
}
