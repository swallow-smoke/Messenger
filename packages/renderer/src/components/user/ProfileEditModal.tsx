import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { MarkdownContent } from '../message/MarkdownContent';
import {
  PROVIDERS,
  PROVIDER_LABEL,
  ProviderIcon,
  type ConnectedAccount,
  type ConnectedAccountProvider,
} from './connectedAccounts';

interface Props {
  onClose(): void;
}

type Tab = 'profile' | 'readme' | 'accounts';

const README_MAX = 2000;

export function ProfileEditModal({ onClose }: Props): React.ReactElement {
  const { user, updateStatus } = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');

  // Profile tab
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [statusText, setStatusText] = useState(user?.statusText ?? '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // README tab
  const [readme, setReadme] = useState('');
  const [readmePreview, setReadmePreview] = useState(false);
  const [savingReadme, setSavingReadme] = useState(false);

  // Connected accounts tab
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [addProvider, setAddProvider] = useState<ConnectedAccountProvider>('github');
  const [addUrl, setAddUrl] = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  // Private profile stats
  const [viewCount, setViewCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    api
      .get(`/users/${user.id}/profile`)
      .then(({ data }) => {
        if (!active) return;
        const d = data as {
          profileReadme?: string | null;
          connectedAccounts?: ConnectedAccount[];
          profileViewCount?: number;
        };
        setReadme(d.profileReadme ?? '');
        setAccounts(d.connectedAccounts ?? []);
        setViewCount(d.profileViewCount ?? 0);
      })
      .catch(() => { /* handled by interceptor */ });
    return () => { active = false; };
  }, [user?.id]);

  async function uploadAvatar(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (data as { url: string }).url;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    const local = URL.createObjectURL(file);
    setAvatarPreview(local);
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarPreview(url);
    } catch {
      toast.error('아바타 업로드 실패');
      setAvatarPreview(user?.avatarUrl ?? '');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!displayName.trim()) { toast.error('이름을 입력하세요'); return; }
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/me', {
        displayName: displayName.trim(),
        statusText: statusText.trim() || null,
        avatarUrl: avatarPreview || null,
      });
      updateStatus((data as { status: string }).status, (data as { statusText?: string }).statusText);
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, ...data } : s.user }));
      toast.success('프로필이 저장되었습니다');
      onClose();
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveReadme(): Promise<void> {
    setSavingReadme(true);
    try {
      await api.patch('/users/me/profile', { profileReadme: readme.trim() || null });
      toast.success('README가 저장되었습니다');
    } catch {
      toast.error('저장 실패');
    } finally {
      setSavingReadme(false);
    }
  }

  async function handleAddAccount(): Promise<void> {
    if (!addUrl.trim() || !addDisplayName.trim()) {
      toast.error('URL과 표시 이름을 입력하세요');
      return;
    }
    setAddingAccount(true);
    try {
      const { data } = await api.post('/users/me/connected-accounts', {
        provider: addProvider,
        url: addUrl.trim(),
        displayName: addDisplayName.trim(),
      });
      setAccounts((prev) => [...prev, data as ConnectedAccount]);
      setAddUrl('');
      setAddDisplayName('');
      toast.success('계정이 추가되었습니다');
    } catch {
      toast.error('추가 실패 (URL을 확인하세요)');
    } finally {
      setAddingAccount(false);
    }
  }

  async function handleRemoveAccount(id: string): Promise<void> {
    try {
      await api.delete(`/users/me/connected-accounts/${id}`);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error('삭제 실패');
    }
  }

  const initials = displayName.charAt(0).toUpperCase() || '?';

  const tabBtn = (id: Tab, label: string): React.ReactElement => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
        tab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">프로필 편집</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {viewCount !== null && (
          <div className="mb-4 text-xs text-white/40">👁 {viewCount} 프로필 조회</div>
        )}

        <div className="flex gap-1 mb-5 border-b border-white/10 pb-3">
          {tabBtn('profile', '프로필')}
          {tabBtn('readme', 'README')}
          {tabBtn('accounts', '연결된 계정')}
        </div>

        {tab === 'profile' && (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer group"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-accent flex items-center justify-center text-2xl font-bold">
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs text-white">
                  {uploading ? '업로드 중...' : '변경'}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFileChange(e)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs text-accent hover:text-accent/80"
              >
                이미지 변경
              </button>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">이름 *</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="표시 이름"
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">상태 메시지</label>
              <input
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="지금 무슨 일을 하고 있나요?"
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
                maxLength={100}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex-1 py-2 text-sm bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        )}

        {tab === 'readme' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/60">자기소개 (Markdown)</label>
              <button
                type="button"
                onClick={() => setReadmePreview((p) => !p)}
                className="text-xs text-accent hover:text-accent/80"
              >
                {readmePreview ? '편집' : '미리보기'}
              </button>
            </div>

            {readmePreview ? (
              <div className="min-h-[12rem] bg-white/5 border border-white/10 rounded-lg p-3">
                {readme.trim() ? (
                  <MarkdownContent content={readme} />
                ) : (
                  <span className="text-sm text-white/30">미리볼 내용이 없습니다.</span>
                )}
              </div>
            ) : (
              <textarea
                value={readme}
                onChange={(e) => setReadme(e.target.value.slice(0, README_MAX))}
                placeholder={'# 안녕하세요\n\n게임 개발자입니다. **마크다운**을 지원합니다.'}
                className="w-full h-48 bg-white/10 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-accent placeholder-white/30 resize-y"
              />
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30">{readme.length} / {README_MAX}</span>
              <button
                type="button"
                onClick={() => void handleSaveReadme()}
                disabled={savingReadme}
                className="px-4 py-2 text-sm bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {savingReadme ? '저장 중...' : 'README 저장'}
              </button>
            </div>
          </div>
        )}

        {tab === 'accounts' && (
          <div className="space-y-4">
            {/* Existing accounts */}
            <div className="space-y-2">
              {accounts.length === 0 ? (
                <div className="text-sm text-white/30 py-2">연결된 계정이 없습니다.</div>
              ) : (
                accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                  >
                    <span className="text-white/60"><ProviderIcon provider={acc.provider} size={18} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/80 truncate">{acc.displayName}</div>
                      <div className="text-xs text-white/40 truncate">{PROVIDER_LABEL[acc.provider]} · {acc.url}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveAccount(acc.id)}
                      className="text-xs text-white/40 hover:text-red-400 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add new */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <label className="block text-sm text-white/60">계정 추가</label>
              <div className="flex gap-2">
                <select
                  value={addProvider}
                  onChange={(e) => setAddProvider(e.target.value as ConnectedAccountProvider)}
                  className="bg-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value} className="bg-surface">{p.label}</option>
                  ))}
                </select>
                <input
                  value={addDisplayName}
                  onChange={(e) => setAddDisplayName(e.target.value)}
                  placeholder="표시 이름"
                  className="flex-1 min-w-0 bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
                  maxLength={100}
                />
              </div>
              <input
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="https://github.com/username"
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
              />
              <button
                type="button"
                onClick={() => void handleAddAccount()}
                disabled={addingAccount}
                className="w-full py-2 text-sm bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg transition-colors"
              >
                {addingAccount ? '추가 중...' : '+ 계정 추가'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
