import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { MarkdownContent } from '../message/MarkdownContent';
import { ProviderIcon, PROVIDER_LABEL, type ConnectedAccount } from './connectedAccounts';
import { SocialBadgeRow } from './SocialBadgeRow';
import type { SocialBadge } from './socialBadges';

interface ProfileData {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  status?: string;
  statusText?: string | null;
  profileReadme?: string | null;
  connectedAccounts: ConnectedAccount[];
  receivedBadges?: SocialBadge[];
}

interface Props {
  userId: string;
  onClose(): void;
}

function openExternal(url: string): void {
  if (window.electron?.shell) void window.electron.shell.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function UserProfileModal({ userId, onClose }: Props): React.ReactElement {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/users/${userId}/profile`)
      .then(({ data }) => { if (active) setProfile(data as ProfileData); })
      .catch(() => { /* handled by interceptor */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const initials = profile?.displayName.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-lg font-semibold">프로필</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        ) : !profile ? (
          <div className="py-16 text-center text-sm text-white/40">프로필을 불러올 수 없습니다.</div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-2xl font-bold">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-base truncate">{profile.displayName}</div>
                {profile.statusText && (
                  <div className="text-sm text-white/60 truncate">{profile.statusText}</div>
                )}
              </div>
            </div>

            {/* Connected accounts */}
            {profile.connectedAccounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.connectedAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => openExternal(acc.url)}
                    title={`${PROVIDER_LABEL[acc.provider]} · ${acc.displayName}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors"
                  >
                    <ProviderIcon provider={acc.provider} />
                    <span className="truncate max-w-[140px]">{acc.displayName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Received social badges */}
            {profile.receivedBadges && profile.receivedBadges.length > 0 && (
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wide mb-1.5">받은 배지</div>
                <SocialBadgeRow badges={profile.receivedBadges} />
              </div>
            )}

            {/* README */}
            {profile.profileReadme?.trim() ? (
              <div className="border-t border-white/10 pt-4">
                <MarkdownContent content={profile.profileReadme} />
              </div>
            ) : (
              <div className="border-t border-white/10 pt-4 text-sm text-white/30">
                아직 소개가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
