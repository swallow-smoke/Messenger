import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuthStore } from '../store/auth';
import { useSettingsStore, ACCENT_PRESETS, BG_GRADIENTS, resolveTheme } from '../store/settings';
import type { AppSettings, Theme, FontSize, Density, BgType } from '../store/settings';
import { usePreferencesStore } from '../store/preferences';
import api from '../lib/api';
import toast from 'react-hot-toast';

type Section = 'account' | 'appearance' | 'notifications' | 'shortcuts' | 'preferences';

const STATUS_LABELS: Record<string, string> = {
  online: '온라인',
  away: '자리 비움',
  dnd: '방해 금지',
  offline: '오프라인',
};

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  away: '#facc15',
  dnd: '#ef4444',
  offline: '#6b7280',
};

const STATUS_PRESETS: Array<{ icon: string; label: string; text: string; status?: string }> = [
  { icon: '🗓️', label: '회의 중', text: '회의 중', status: 'away' },
  { icon: '🐛', label: '디버깅 중', text: '디버깅 중' },
  { icon: '🎮', label: '게임 개발 중', text: '게임 개발 중' },
  { icon: '🚫', label: '방해 금지', text: '방해 금지', status: 'dnd' },
];

interface Props {
  onClose(): void;
}

export function SettingsPage({ onClose }: Props): React.ReactElement {
  const { settings, update } = useSettingsStore();
  const [section, setSection] = useState<Section>('account');

  const resolved = resolveTheme(settings.theme);

  const sections: { id: Section; label: string }[] = [
    { id: 'account',       label: '내 계정' },
    { id: 'appearance',    label: '외관' },
    { id: 'notifications', label: '알림' },
    { id: 'preferences',   label: '기능' },
    { id: 'shortcuts',     label: '단축키' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-3xl h-[640px] flex overflow-hidden shadow-2xl">
        {/* Nav sidebar */}
        <div className="w-48 flex-shrink-0 bg-white/5 border-r border-white/10 flex flex-col py-4">
          <div className="px-4 mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-sm">설정</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
          </div>
          <nav className="flex-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  section === s.id
                    ? 'bg-accent/20 text-white font-medium border-r-2 border-accent'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="px-4 pt-4 border-t border-white/10">
            <div className="text-[10px] text-white/20 text-center">GameDev Messenger</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {section === 'account' && (
            <AccountSection />
          )}
          {section === 'appearance' && (
            <AppearanceSection settings={settings} update={update} resolved={resolved} />
          )}
          {section === 'notifications' && (
            <NotificationsSection settings={settings} update={update} />
          )}
          {section === 'preferences' && (
            <PreferencesSection />
          )}
          {section === 'shortcuts' && (
            <ShortcutsSection />
          )}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   ACCOUNT SECTION
   ===================================================================== */

function AccountSection(): React.ReactElement {
  const { user, updateStatus } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [statusText, setStatusText] = useState(user?.statusText ?? '');
  const [saving, setSaving] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const avatarUrl = (data as { presignedFileUrl?: string; fileUrl?: string }).presignedFileUrl ?? (data as { fileUrl: string }).fileUrl;
      await api.patch('/auth/me', { avatarUrl });
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, avatarUrl } : s.user }));
      toast.success('아바타가 변경되었습니다');
    } catch {
      toast.error('아바타 업로드 실패');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveProfile(): Promise<void> {
    if (!displayName.trim()) { toast.error('이름을 입력하세요'); return; }
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/me', {
        displayName: displayName.trim(),
        statusText: statusText.trim() || null,
      });
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, ...(data as object) } : s.user }));
      toast.success('저장되었습니다');
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(): Promise<void> {
    if (!currentPw || !newPw) { toast.error('비밀번호를 입력하세요'); return; }
    if (newPw.length < 8) { toast.error('새 비밀번호는 8자 이상이어야 합니다'); return; }
    if (newPw !== confirmPw) { toast.error('새 비밀번호가 일치하지 않습니다'); return; }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      toast.success('비밀번호가 변경되었습니다');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowPwForm(false);
    } catch {
      toast.error('비밀번호 변경 실패');
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <h3 className="text-base font-semibold">내 계정</h3>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-full overflow-hidden bg-accent/40 flex items-center justify-center text-2xl font-bold relative group"
            disabled={uploadingAvatar}
            title="아바타 변경"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{(user?.displayName?.[0] ?? '?').toUpperCase()}</span>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors rounded-full">
              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? '...' : '변경'}
              </span>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleAvatarUpload(e)}
          />
        </div>
        <div>
          <div className="font-medium">{user?.displayName}</div>
          <div className="text-sm text-white/50">{user?.email}</div>
        </div>
      </div>

      {/* Display name */}
      <div>
        <label className="block text-sm text-white/60 mb-1">표시 이름</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Status presets */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">빠른 상태</label>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setStatusText(p.text); if (p.status) void updateStatus(p.status); }}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                statusText === p.text
                  ? 'bg-accent/20 border-accent/40 text-white'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70'
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
          {statusText && (
            <button
              type="button"
              onClick={() => setStatusText('')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-white/40 rounded-full transition-colors"
            >
              ✕ 지우기
            </button>
          )}
        </div>
      </div>

      {/* Status text */}
      <div>
        <label className="block text-sm text-white/60 mb-1">상태 메시지</label>
        <input
          value={statusText}
          onChange={(e) => setStatusText(e.target.value)}
          placeholder="지금 하고 있는 일..."
          maxLength={100}
          className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-sm text-white/60 mb-1">이메일 (변경 불가)</label>
        <input
          value={user?.email ?? ''}
          readOnly
          className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white/40 cursor-not-allowed"
        />
      </div>

      {/* Status selector */}
      <div>
        <label className="block text-sm text-white/60 mb-2">현재 상태</label>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABELS).map(([s, label]) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                user?.status === s
                  ? 'border-white/40 bg-white/15'
                  : 'border-white/10 hover:border-white/25'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => void saveProfile()}
        disabled={saving}
        className="px-5 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
      >
        {saving ? '저장 중...' : '저장'}
      </button>

      {/* Password change */}
      <div className="border-t border-white/10 pt-4">
        <button
          onClick={() => setShowPwForm((v) => !v)}
          className="text-sm text-white/60 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${showPwForm ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          비밀번호 변경
        </button>
        {showPwForm && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">현재 비밀번호</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">새 비밀번호 (최소 8자)</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              onClick={() => void changePassword()}
              disabled={savingPw}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-sm transition-colors"
            >
              {savingPw ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   APPEARANCE SECTION
   ===================================================================== */

interface AppearanceProps {
  settings: AppSettings;
  update(partial: Partial<AppSettings>): void;
  resolved: 'light' | 'dark';
}

function AppearanceSection({ settings, update, resolved }: AppearanceProps): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);

  const THEMES: { id: Theme; label: string; icon: string }[] = [
    { id: 'light',  label: '라이트',  icon: '☀️' },
    { id: 'dark',   label: '다크',    icon: '🌙' },
    { id: 'system', label: '시스템',  icon: '🖥️' },
  ];

  const FONT_SIZES: { id: FontSize; label: string; size: string }[] = [
    { id: 'small',  label: '작게',  size: '13' },
    { id: 'normal', label: '보통',  size: '15' },
    { id: 'large',  label: '크게',  size: '17' },
  ];

  const DENSITIES: { id: Density; label: string; desc: string }[] = [
    { id: 'comfortable', label: '넓게',  desc: '아바타와 간격 표시' },
    { id: 'compact',     label: '좁게',  desc: '더 많은 메시지 표시' },
  ];

  const BG_TYPES: { id: BgType; label: string }[] = [
    { id: 'default',  label: '기본' },
    { id: 'gradient', label: '그라데이션' },
    { id: 'image',    label: '이미지' },
  ];

  async function handleBgImage(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ bgType: 'image', bgImage: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-7 max-w-md">
      <h3 className="text-base font-semibold">외관</h3>

      {/* Theme */}
      <div>
        <label className="block text-sm text-white/60 mb-2">테마</label>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => update({ theme: t.id })}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-sm transition-all ${
                settings.theme === t.id
                  ? 'border-accent bg-accent/15 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/25'
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
        {settings.theme === 'system' && (
          <p className="text-xs text-white/30 mt-1.5">
            현재: {resolved === 'dark' ? '다크' : '라이트'} 모드
          </p>
        )}
      </div>

      {/* Accent colors */}
      <div>
        <label className="block text-sm text-white/60 mb-2">강조 색상</label>
        <div className="flex gap-2 flex-wrap">
          {ACCENT_PRESETS.map((a) => (
            <button
              key={a.hex}
              onClick={() => update({ accentColor: a.hex, accentRgb: a.rgb })}
              title={a.name}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                settings.accentColor === a.hex ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: a.hex }}
            />
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <label className="block text-sm text-white/60 mb-2">메시지 폰트 크기</label>
        <div className="flex gap-2">
          {FONT_SIZES.map((f) => (
            <button
              key={f.id}
              onClick={() => update({ messageFontSize: f.id })}
              className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                settings.messageFontSize === f.id
                  ? 'border-accent bg-accent/15 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/25'
              }`}
              style={{ fontSize: `${f.size}px` }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message density */}
      <div>
        <label className="block text-sm text-white/60 mb-2">메시지 간격</label>
        <div className="flex gap-2">
          {DENSITIES.map((d) => (
            <button
              key={d.id}
              onClick={() => update({ messageDensity: d.id })}
              className={`flex-1 py-2.5 px-3 rounded-xl border text-left transition-all ${
                settings.messageDensity === d.id
                  ? 'border-accent bg-accent/15 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/25'
              }`}
            >
              <div className="text-sm font-medium">{d.label}</div>
              <div className="text-[11px] text-white/30 mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Avatar display */}
      <div>
        <ToggleRow
          label="연속 메시지 아바타 숨김"
          description="같은 사람이 연달아 보낸 메시지에서 아바타를 숨깁니다"
          checked={settings.hideConsecutiveAvatars}
          onChange={(v) => update({ hideConsecutiveAvatars: v })}
        />
      </div>

      {/* Background */}
      <div>
        <label className="block text-sm text-white/60 mb-2">배경</label>
        <div className="flex gap-2 mb-3">
          {BG_TYPES.map((b) => (
            <button
              key={b.id}
              onClick={() => update({ bgType: b.id })}
              className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                settings.bgType === b.id
                  ? 'border-accent bg-accent/15 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/25'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {settings.bgType === 'gradient' && (
          <div className="flex gap-2 flex-wrap">
            {BG_GRADIENTS.map((g, i) => (
              <button
                key={i}
                onClick={() => update({ bgGradient: i })}
                className={`w-12 h-12 rounded-lg border-2 transition-all hover:scale-105 ${
                  settings.bgGradient === i ? 'border-white' : 'border-transparent'
                }`}
                style={{ background: g }}
              />
            ))}
          </div>
        )}

        {settings.bgType === 'image' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-sm transition-colors"
              >
                이미지 선택
              </button>
              {settings.bgImage && (
                <button
                  onClick={() => update({ bgImage: null, bgType: 'default' })}
                  className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
                >
                  제거
                </button>
              )}
            </div>
            {settings.bgImage && (
              <div
                className="w-full h-20 rounded-lg bg-cover bg-center border border-white/10"
                style={{ backgroundImage: `url(${settings.bgImage})` }}
              />
            )}
            <div>
              <label className="block text-xs text-white/50 mb-1">밝기: {settings.bgBrightness}%</label>
              <input
                type="range"
                min={20}
                max={100}
                value={settings.bgBrightness}
                onChange={(e) => update({ bgBrightness: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleBgImage(e)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   NOTIFICATIONS SECTION
   ===================================================================== */

interface NotifProps {
  settings: AppSettings;
  update(partial: Partial<AppSettings>): void;
}

function NotificationsSection({ settings, update }: NotifProps): React.ReactElement {
  const [keyword, setKeyword] = useState('');
  const { prefs, update: updatePrefs } = usePreferencesStore();

  function addKeyword(): void {
    const kw = keyword.trim();
    if (!kw || prefs.keywords.includes(kw)) return;
    void updatePrefs({ keywords: [...prefs.keywords, kw] });
    setKeyword('');
  }

  function removeKeyword(kw: string): void {
    void updatePrefs({ keywords: prefs.keywords.filter((k) => k !== kw) });
  }

  return (
    <div className="space-y-5 max-w-md">
      <h3 className="text-base font-semibold">알림 설정</h3>

      <ToggleRow
        label="데스크탑 알림"
        description="앱이 백그라운드일 때 시스템 알림을 표시합니다"
        checked={settings.notifDesktop}
        onChange={(v) => update({ notifDesktop: v })}
      />
      <ToggleRow
        label="@멘션 알림"
        description="내 이름이 언급되면 알림을 표시합니다"
        checked={settings.notifMention}
        onChange={(v) => update({ notifMention: v })}
      />
      <ToggleRow
        label="DM 알림"
        description="새 다이렉트 메시지에 알림을 표시합니다"
        checked={settings.notifDm}
        onChange={(v) => update({ notifDm: v })}
      />
      <ToggleRow
        label="소리 알림"
        description="새 메시지 수신 시 효과음을 재생합니다"
        checked={settings.notifSound}
        onChange={(v) => update({ notifSound: v })}
      />

      <div className="border-t border-white/10 pt-5">
        <label className="block text-sm font-medium mb-1">키워드 알림</label>
        <p className="text-xs text-white/40 mb-3">특정 단어가 포함된 메시지에 알림을 받습니다</p>
        <div className="flex gap-2 mb-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addKeyword(); }}
            placeholder="키워드 추가..."
            className="flex-1 bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent placeholder-white/30"
          />
          <button
            onClick={addKeyword}
            className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-sm transition-colors"
          >
            추가
          </button>
        </div>
        {prefs.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {prefs.keywords.map((kw) => (
              <span
                key={kw}
                className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 text-xs"
              >
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-white/40 hover:text-white leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        {prefs.keywords.length === 0 && (
          <p className="text-xs text-white/25">키워드를 추가하면 해당 단어가 포함된 메시지에 알림을 받습니다</p>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   PREFERENCES SECTION
   ===================================================================== */

function PreferencesSection(): React.ReactElement {
  const { prefs, update } = usePreferencesStore();

  return (
    <div className="space-y-5 max-w-md">
      <h3 className="text-base font-semibold">기능 설정</h3>
      <ToggleRow
        label="코드 구문 강조"
        description="메시지의 코드 블록과 코드 파일 첨부에 구문 강조를 적용합니다"
        checked={prefs.enableCodeHighlight}
        onChange={(v) => void update({ enableCodeHighlight: v })}
      />
      <ToggleRow
        label="3D 파일 미리보기"
        description=".glb/.fbx/.gltf 파일에 썸네일 미리보기를 표시합니다"
        checked={prefs.enable3DPreview}
        onChange={(v) => void update({ enable3DPreview: v })}
      />
    </div>
  );
}

/* =====================================================================
   SHORTCUTS SECTION
   ===================================================================== */

function ShortcutsSection(): React.ReactElement {
  const groups = [
    {
      title: '탐색',
      items: [
        ['Ctrl + K', '빠른 탐색 (채널/DM 전환)'],
        ['Ctrl + /', '단축키 목록 보기'],
        ['Escape', '모달 닫기 / 편집 취소'],
      ],
    },
    {
      title: '메시지',
      items: [
        ['Enter', '메시지 전송'],
        ['Shift + Enter', '줄바꿈'],
        ['↑', '마지막 메시지 편집 시작'],
        ['Ctrl + B', '볼드 서식'],
        ['Ctrl + I', '이탤릭 서식'],
      ],
    },
    {
      title: '앱',
      items: [
        ['Ctrl + Shift + G', '앱 창 표시/숨김'],
        ['Ctrl + ,', '설정 열기'],
        ['Ctrl + F', '메시지 검색'],
        ['Ctrl + = / -', 'UI 확대 / 축소'],
        ['Ctrl + 0', 'UI 크기 초기화'],
      ],
    },
    {
      title: '문서 편집기',
      items: [
        ['Ctrl + S', '저장'],
        ['Ctrl + Z', '실행 취소'],
        ['Ctrl + Shift + F', '전체화면'],
        ['Ctrl + E', '.md 내보내기'],
      ],
    },
  ];

  return (
    <div className="max-w-md space-y-6">
      <h3 className="text-base font-semibold">키보드 단축키</h3>
      {groups.map((group) => (
        <div key={group.title}>
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{group.title}</div>
          <div className="space-y-1">
            {group.items.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-white/70">{desc}</span>
                <kbd className="text-[11px] bg-white/10 border border-white/20 px-2 py-0.5 rounded font-mono whitespace-nowrap ml-4">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   ROLES SECTION
   ===================================================================== */

interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  manageChannels: boolean;
  manageRoles: boolean;
  manageMembers: boolean;
  kickMembers: boolean;
  banMembers: boolean;
  deleteAnyMessage: boolean;
  manageWebhooks: boolean;
}

interface WorkspaceMemberEntry {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  memberId: string;
  roles: Array<{ id: string; name: string; color: string; position: number }>;
}

const PERMISSION_LABELS: Array<{ key: keyof Omit<Role, 'id' | 'name' | 'color' | 'position'>; label: string }> = [
  { key: 'manageChannels',   label: '채널 관리' },
  { key: 'manageRoles',      label: '역할 관리' },
  { key: 'manageMembers',    label: '멤버 역할 관리' },
  { key: 'kickMembers',      label: '멤버 추방' },
  { key: 'banMembers',       label: '멤버 차단' },
  { key: 'deleteAnyMessage', label: '메시지 삭제' },
  { key: 'manageWebhooks',   label: '웹훅 관리' },
];

function SortableRoleRow({
  role,
  selected,
  onSelect,
}: {
  role: Role;
  selected: boolean;
  onSelect(): void;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: role.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        selected ? 'bg-accent/20 border border-accent/40' : 'border border-white/5 hover:bg-white/5'
      }`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-white/25 hover:text-white/50 cursor-grab active:cursor-grabbing px-0.5"
        onClick={(e) => e.stopPropagation()}
        title="드래그하여 순서 변경"
      >
        ⠿
      </button>
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
      <span className="flex-1 text-sm truncate">{role.name}</span>
    </div>
  );
}

export function RolesModal({ workspaceId, initialTab, onClose }: { workspaceId: string; initialTab?: 'roles' | 'members'; onClose(): void }): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl h-[580px] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
          <h2 className="font-semibold text-sm">역할 & 멤버 관리</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <RolesSection workspaceId={workspaceId} initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
}

function RolesSection({ workspaceId, initialTab = 'roles' }: { workspaceId: string; initialTab?: 'roles' | 'members' }): React.ReactElement {
  const [subTab, setSubTab] = useState<'roles' | 'members'>(initialTab);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#818cf8');
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    void loadData();
  }, [workspaceId]);

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const [rolesRes, membersRes] = await Promise.all([
        api.get<Role[]>(`/workspaces/${workspaceId}/roles`),
        api.get<WorkspaceMemberEntry[]>(`/workspaces/${workspaceId}/members`),
      ]);
      setRoles(rolesRes.data);
      setMembers(membersRes.data);
    } catch {
      toast.error('역할 로드 실패');
    } finally {
      setLoading(false);
    }
  }

  function openRole(role: Role): void {
    setCreating(false);
    setSelectedRoleId(role.id);
    setEditName(role.name);
    setEditColor(role.color);
    setEditPerms({
      manageChannels: role.manageChannels,
      manageRoles: role.manageRoles,
      manageMembers: role.manageMembers,
      kickMembers: role.kickMembers,
      banMembers: role.banMembers,
      deleteAnyMessage: role.deleteAnyMessage,
      manageWebhooks: role.manageWebhooks,
    });
  }

  function openNew(): void {
    setSelectedRoleId(null);
    setCreating(true);
    setEditName('');
    setEditColor('#818cf8');
    setEditPerms({ manageChannels: false, manageRoles: false, manageMembers: false, kickMembers: false, banMembers: false, deleteAnyMessage: false, manageWebhooks: false });
  }

  async function saveRole(): Promise<void> {
    if (!editName.trim()) { toast.error('역할 이름을 입력하세요'); return; }
    setSaving(true);
    try {
      const body = { name: editName.trim(), color: editColor, ...editPerms };
      if (creating) {
        const { data } = await api.post<Role>(`/workspaces/${workspaceId}/roles`, { ...body, position: roles.length });
        setRoles((prev) => [...prev, data]);
        setCreating(false);
        setSelectedRoleId(data.id);
        toast.success('역할 생성됨');
      } else if (selectedRoleId) {
        const { data } = await api.patch<Role>(`/workspaces/${workspaceId}/roles/${selectedRoleId}`, body);
        setRoles((prev) => prev.map((r) => (r.id === selectedRoleId ? data : r)));
        toast.success('저장됨');
      }
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(roleId: string): Promise<void> {
    if (!confirm('이 역할을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/roles/${roleId}`);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedRoleId === roleId) { setSelectedRoleId(null); setCreating(false); }
      toast.success('역할 삭제됨');
    } catch {
      toast.error('삭제 실패');
    }
  }

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = roles.findIndex((r) => r.id === active.id);
    const newIndex = roles.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(roles, oldIndex, newIndex).map((r, i) => ({ ...r, position: i }));
    setRoles(reordered);
    await Promise.all(
      reordered.map((r) => api.patch(`/workspaces/${workspaceId}/roles/${r.id}`, { position: r.position }))
    ).catch(() => toast.error('순서 저장 실패'));
  }

  async function assignRole(userId: string, roleId: string): Promise<void> {
    try {
      await api.post(`/workspaces/${workspaceId}/members/${userId}/roles`, { roleId });
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id !== userId) return m;
          const role = roles.find((r) => r.id === roleId);
          if (!role || m.roles.some((r) => r.id === roleId)) return m;
          return { ...m, roles: [...m.roles, { id: role.id, name: role.name, color: role.color, position: role.position }] };
        })
      );
    } catch {
      toast.error('역할 할당 실패');
    }
  }

  async function removeRole(userId: string, roleId: string): Promise<void> {
    try {
      await api.delete(`/workspaces/${workspaceId}/members/${userId}/roles/${roleId}`);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === userId ? { ...m, roles: m.roles.filter((r) => r.id !== roleId) } : m
        )
      );
    } catch {
      toast.error('역할 제거 실패');
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const showEditPanel = creating || selectedRole !== null;

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-white/40 text-sm">불러오는 중...</div>;
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <h3 className="text-base font-semibold flex-shrink-0">역할 관리</h3>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-white/10 flex-shrink-0">
        {(['roles', 'members'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              subTab === t ? 'border-accent text-white' : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            {t === 'roles' ? '역할' : '멤버'}
          </button>
        ))}
      </div>

      {subTab === 'roles' && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Role list */}
          <div className="w-44 flex-shrink-0 flex flex-col gap-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
              <SortableContext items={roles.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1">
                  {roles.map((role) => (
                    <SortableRoleRow
                      key={role.id}
                      role={role}
                      selected={selectedRoleId === role.id}
                      onSelect={() => openRole(role)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button
              onClick={openNew}
              className="mt-1 text-xs text-accent hover:text-white/80 px-3 py-1.5 border border-dashed border-accent/40 rounded-lg transition-colors"
            >
              + 새 역할
            </button>
          </div>

          {/* Edit panel */}
          {showEditPanel && (
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
              <div>
                <label className="block text-xs text-white/50 mb-1">역할 이름</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
                  placeholder="역할 이름"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">색상</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/20"
                  />
                  <span className="text-sm font-mono text-white/60">{editColor}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-2">권한</div>
                <div className="space-y-1">
                  {PERMISSION_LABELS.map(({ key, label }) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={editPerms[key] ?? false}
                      onChange={(v) => setEditPerms((p) => ({ ...p, [key]: v }))}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => void saveRole()}
                  disabled={saving}
                  className="px-4 py-1.5 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                {selectedRole && (
                  <button
                    onClick={() => void deleteRole(selectedRole.id)}
                    className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          )}
          {!showEditPanel && (
            <div className="flex-1 flex items-center justify-center text-white/25 text-sm">
              역할을 선택하거나 새로 만드세요
            </div>
          )}
        </div>
      )}

      {subTab === 'members' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:bg-white/3">
              <div className="w-8 h-8 rounded-full bg-accent/30 flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (member.displayName[0] ?? '?').toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{member.displayName}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {member.roles.map((role) => (
                    <span
                      key={role.id}
                      className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border"
                      style={{ borderColor: role.color + '66', color: role.color }}
                    >
                      {role.name}
                      <button
                        onClick={() => void removeRole(member.id, role.id)}
                        className="opacity-60 hover:opacity-100 leading-none"
                        title="역할 제거"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  <select
                    className="text-[11px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/50 hover:text-white cursor-pointer outline-none"
                    value=""
                    onChange={(e) => { if (e.target.value) void assignRole(member.id, e.target.value); }}
                  >
                    <option value="">+ 역할 추가</option>
                    {roles
                      .filter((r) => !member.roles.some((mr) => mr.id === r.id))
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="text-center text-white/30 text-sm py-10">멤버가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   SHARED: TOGGLE ROW
   ===================================================================== */

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange(value: boolean): void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps): React.ReactElement {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer py-2 border-b border-white/5">
      <div>
        <div className="text-sm">{label}</div>
        {description && <div className="text-xs text-white/40 mt-0.5">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex-shrink-0 w-10 h-5 rounded-full transition-colors flex items-center px-0.5 mt-0.5 ${
          checked ? 'bg-accent' : 'bg-white/20'
        }`}
      >
        <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}
