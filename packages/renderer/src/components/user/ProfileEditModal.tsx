import React, { useState, useRef } from 'react';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  onClose(): void;
}

export function ProfileEditModal({ onClose }: Props): React.ReactElement {
  const { user, updateStatus } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [statusText, setStatusText] = useState(user?.statusText ?? '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      // Update auth store user
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, ...data } : s.user }));
      toast.success('프로필이 저장되었습니다');
      onClose();
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  }

  const initials = displayName.charAt(0).toUpperCase() || '?';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">프로필 편집</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
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
      </div>
    </div>
  );
}
